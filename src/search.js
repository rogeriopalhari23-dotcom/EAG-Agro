// Buscas nacionais versionadas e particionadas (P2-T4; R11, R13).
import { bodyJson, fail, str, number, requireRole, page as pageOf, WRITE_ROLES, APPROVER_ROLES } from "./http.js";
import { statement as s, commit, auditStatement, now, parameters, requireParameter, product } from "./store.js";
import { originPoint, municipalitiesWithin, haversineKm, classifyInsideRadius, rectDistances, normalizeName } from "./geo.js";
import { cnaesForSectors } from "./sectors.js";
import { searchEstablishments, SOURCE as CDD_SOURCE, PAGE_LIMIT, MAX_MUNICIPALITIES } from "./adapters/casadosdados.js";
import { AdapterError } from "./adapters/errors.js";
import { enqueueGeocoding, GEOCODE_ALL_UNDER_KM } from "./geocoding.js";

const LEASE_MS = 120000;
const MAX_ATTEMPTS = 3;
const CHUNK = 80;
const STOP_KINDS = new Set(["auth", "no_balance"]);

async function sha256(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const chunks = (list, n = CHUNK) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// Partição por UF quando o estado inteiro está dentro do raio; senão por município com alguma parte no raio.
export async function planPartitions(env, origin, radiusKm) {
  const inside = await municipalitiesWithin(env, origin.lat, origin.lon, radiusKm);
  const ufs = [...new Set(inside.map((m) => m.uf))];
  const all = (
    await s(env, `SELECT * FROM municipalities WHERE uf IN (${ufs.map(() => "?").join(",")})`, ...ufs).all()
  ).results;
  const plan = [];
  for (const uf of ufs.sort()) {
    const state = all.filter((m) => m.uf === uf);
    const whole = state.every((m) => rectDistances(origin.lat, origin.lon, m).max <= radiusKm);
    if (whole) plan.push({ scope: "uf", uf, municipality_key: "", names: null });
    else
      for (const group of chunks(inside.filter((x) => x.uf === uf), MAX_MUNICIPALITIES))
        plan.push({
          scope: "municipalities",
          uf,
          municipality_key: group.map((m) => m.ibge_code).join(","),
          names: group.map((m) => m.name),
        });
  }
  return plan;
}

async function enqueue(env, deps, partitionIds, delaySeconds = 0) {
  if (!partitionIds.length) return;
  const send = deps.enqueue ?? ((msgs) => env.ASYNC_QUEUE?.sendBatch(msgs));
  for (const group of chunks(partitionIds, 100))
    await send(
      group.map((id) => ({
        body: { type: "search_partition", partitionId: id },
        ...(delaySeconds ? { delaySeconds: Math.min(86400, Math.ceil(delaySeconds)) } : {}),
      })),
    );
}

export async function startSearch(request, env, actor, rid, deps = {}) {
  requireRole(actor, WRITE_ROLES);
  const i = await bodyJson(request);
  const c = await s(env, "SELECT * FROM campaigns WHERE tenant_id=? AND id=?", actor.tenant_id, str(i.campaignId, "campanha", 80)).first();
  if (!c) fail(404, "campaign_not_found", "Campanha não encontrada.");
  if (c.market !== "national") fail(422, "campaign_not_national", "Busca por raio só vale para campanha nacional.");
  if (c.status !== "active") fail(409, "campaign_not_active", "Ative a campanha antes de buscar.");
  const p = await product(env, actor.tenant_id, c.product_id);
  if (!p.active || p.identity_status !== "confirmed")
    fail(422, "product_identity_pending", "Identidade de produto pendente bloqueia a busca (R10.4).");
  const params = await parameters(env, actor.tenant_id);
  const radius = i.radiusKm === undefined ? c.radius_km : number(i.radiusKm, "raio", 1, 1500);
  if (!requireParameter(params, "radius_allowed_km:national").includes(radius))
    fail(422, "radius_not_allowed", "Raio fora da lista de raios permitidos.");
  const icp = await s(env, "SELECT user_sectors_json FROM campaign_icp WHERE campaign_id=?", c.id).first();
  if (!icp) fail(422, "icp_required", "ICP obrigatório.");
  const cnaes = await cnaesForSectors(env, actor.tenant_id, JSON.parse(icp.user_sectors_json));
  const origin = await originPoint(env, c.origin_city, c.origin_uf);
  const day = now().slice(0, 10);
  const requestKey = await sha256([c.id, radius, origin.ibge, cnaes.join(","), day].join("|"));
  const existing = await s(env, "SELECT id,version,status FROM searches WHERE tenant_id=? AND request_key=?", actor.tenant_id, requestKey).first();
  if (existing) return { searchId: existing.id, version: existing.version, status: existing.status, reused: true };
  const prev = await s(env, "SELECT id,version FROM searches WHERE campaign_id=? ORDER BY version DESC LIMIT 1", c.id).first();
  const plan = await planPartitions(env, origin, radius);
  const id = crypto.randomUUID();
  const version = (prev?.version ?? 0) + 1;
  const parts = plan.map((x) => ({ ...x, id: crypto.randomUUID() }));
  const sourceVersions = { municipalities: origin.sourceVersion, companies: CDD_SOURCE };
  await commit(env, [
    s(
      env,
      "INSERT INTO searches(id,tenant_id,campaign_id,version,parent_search_id,origin_ibge,origin_lat,origin_lon,origin_precision,radius_km,cnae_codes_json,source_versions_json,status,request_key,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'running',?,?)",
      id, actor.tenant_id, c.id, version, prev?.id ?? null, origin.ibge, origin.lat, origin.lon, origin.precision, radius,
      JSON.stringify(cnaes), JSON.stringify(sourceVersions), requestKey, actor.id,
    ),
    ...parts.map((x) =>
      s(
        env,
        "INSERT INTO search_partitions(id,search_id,scope,uf,municipality_key,municipality_names_json,page) VALUES (?,?,?,?,?,?,1)",
        x.id, id, x.scope, x.uf, x.municipality_key, x.names ? JSON.stringify(x.names) : null,
      ),
    ),
    auditStatement(env, actor, rid, "search.started", "search", id, {
      campaignId: c.id, version, radiusKm: radius, partitions: parts.length, cnaes,
    }),
  ]);
  await enqueue(env, deps, parts.map((x) => x.id));
  return { searchId: id, version, status: "running", partitions: parts.length };
}

// Aquisição atômica: só um consumidor processa a partição; lease vencido pode ser retomado.
async function acquire(env, partitionId, owner, at) {
  const until = new Date(Date.parse(at) + LEASE_MS).toISOString();
  const r = await env.DB.prepare(
    "UPDATE search_partitions SET status='leased',lease_owner=?,lease_until=?,lease_token=lease_token+1,attempts=attempts+1 WHERE id=? AND ((status='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?)) OR (status='leased' AND lease_until<?))",
  )
    .bind(owner, until, partitionId, at, at)
    .run();
  if (!r.meta.changes) return null;
  return env.DB.prepare("SELECT * FROM search_partitions WHERE id=?").bind(partitionId).first();
}

// Grava empresas, unidades e candidatos da página; repetir a mesma página produz o mesmo estado.
async function persistItems(env, search, tenant, items, at) {
  const muniCache = new Map();
  const needMuni = [...new Set(items.map((x) => x.municipalityIbge).filter(Boolean))];
  for (const group of chunks(needMuni))
    for (const m of (await s(env, `SELECT * FROM municipalities WHERE ibge_code IN (${group.map(() => "?").join(",")})`, ...group).all()).results)
      muniCache.set(m.ibge_code, m);
  for (const group of chunks(items)) {
    const roots = [...new Set(group.map((x) => x.cnpjRoot))];
    const cnpjs = group.map((x) => x.cnpj);
    const [byRoot, byName, units] = await env.DB.batch([
      s(env, `SELECT id,cnpj_root FROM companies WHERE tenant_id=? AND cnpj_root IN (${roots.map(() => "?").join(",")})`, tenant, ...roots),
      s(env, `SELECT legal_name,cnpj_root FROM companies WHERE tenant_id=? AND country_code='BR' AND legal_name IN (${group.map(() => "?").join(",")})`, tenant, ...group.map((x) => x.legalName)),
      s(env, `SELECT cnpj,geo_precision,lat,lon FROM company_units WHERE tenant_id=? AND cnpj IN (${cnpjs.map(() => "?").join(",")})`, tenant, ...cnpjs),
    ]);
    const known = new Set(byRoot.results.map((r) => r.cnpj_root));
    const takenNames = new Map(byName.results.map((r) => [r.legal_name, r.cnpj_root]));
    const unitGeo = new Map(units.results.map((u) => [u.cnpj, u]));
    const statements = [];
    const created = new Set();
    for (const x of group) {
      if (!known.has(x.cnpjRoot) && !created.has(x.cnpjRoot)) {
        created.add(x.cnpjRoot);
        // Mesmo nome com outra raiz (ou sem raiz) não é fusão (R1.1.4): nome distinguido pela raiz.
        const name = takenNames.has(x.legalName) && takenNames.get(x.legalName) !== x.cnpjRoot ? `${x.legalName} — CNPJ raiz ${x.cnpjRoot}` : x.legalName;
        statements.push(
          s(
            env,
            "INSERT INTO companies(id,tenant_id,legal_name,trade_name,country_code,cnpj_root,source_label,source_url,created_by) VALUES (?,?,?,?,'BR',?,'Casa dos Dados',NULL,'system-search') ON CONFLICT(tenant_id,cnpj_root) WHERE cnpj_root IS NOT NULL DO NOTHING",
            crypto.randomUUID(), tenant, name, x.tradeName, x.cnpjRoot,
          ),
        );
      }
      const muni = muniCache.get(x.municipalityIbge) || null;
      const prev = unitGeo.get(x.cnpj);
      const keepPrecise = prev && ["address", "manual"].includes(prev.geo_precision);
      const lat = keepPrecise ? prev.lat : muni?.lat ?? null;
      const lon = keepPrecise ? prev.lon : muni?.lon ?? null;
      const basis = keepPrecise ? "address" : muni ? "municipality_centroid" : "unknown";
      const distance = lat == null ? null : haversineKm(search.origin_lat, search.origin_lon, lat, lon);
      const inside = classifyInsideRadius({ basis, distanceKm: distance, radiusKm: search.radius_km, municipality: muni, originLat: search.origin_lat, originLon: search.origin_lon });
      statements.push(
        s(
          env,
          `INSERT INTO company_units(id,tenant_id,company_id,cnpj,unit_role,trade_name,street,street_number,district,postal_code,municipality_ibge,municipality_name,uf,lat,lon,geo_precision,geo_source,size_code,size_label,size_source,registration_status,source_label,source_ref,consulted_at)
           SELECT ?,?,c.id,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Casa dos Dados',?,? FROM companies c WHERE c.tenant_id=? AND c.cnpj_root=?
           ON CONFLICT(tenant_id,cnpj) DO UPDATE SET trade_name=excluded.trade_name,street=excluded.street,street_number=excluded.street_number,district=excluded.district,postal_code=excluded.postal_code,municipality_ibge=excluded.municipality_ibge,municipality_name=excluded.municipality_name,uf=excluded.uf,
             lat=CASE WHEN company_units.geo_precision IN ('address','manual') THEN company_units.lat ELSE excluded.lat END,
             lon=CASE WHEN company_units.geo_precision IN ('address','manual') THEN company_units.lon ELSE excluded.lon END,
             geo_precision=CASE WHEN company_units.geo_precision IN ('address','manual') THEN company_units.geo_precision ELSE excluded.geo_precision END,
             geo_source=CASE WHEN company_units.geo_precision IN ('address','manual') THEN company_units.geo_source ELSE excluded.geo_source END,
             size_code=excluded.size_code,size_label=excluded.size_label,size_source=excluded.size_source,registration_status=excluded.registration_status,
             source_ref=excluded.source_ref,consulted_at=excluded.consulted_at,updated_at=excluded.consulted_at`,
          crypto.randomUUID(), tenant, x.cnpj, x.headquarters ? "headquarters" : "unknown", x.tradeName, x.street, x.number, x.district, x.postalCode,
          muni ? muni.ibge_code : null, x.municipalityName, x.uf, muni ? muni.lat : null, muni ? muni.lon : null,
          muni ? "municipality_centroid" : "unknown", muni ? `IBGE centroide ${muni.source_version}` : null,
          x.sizeCode, x.sizeLabel, x.sizeCode ? CDD_SOURCE : null, x.status, `${CDD_SOURCE} busca ${search.id}`, at, tenant, x.cnpjRoot,
        ),
        s(
          env,
          `INSERT INTO search_candidates(search_id,unit_id,distance_km,distance_basis,inside_radius)
           SELECT ?,u.id,?,?,? FROM company_units u WHERE u.tenant_id=? AND u.cnpj=?
           ON CONFLICT(search_id,unit_id) DO UPDATE SET distance_km=excluded.distance_km,distance_basis=excluded.distance_basis,inside_radius=excluded.inside_radius`,
          search.id, distance, basis === "unknown" ? "unknown" : basis, inside, tenant, x.cnpj,
        ),
      );
    }
    await env.DB.batch(statements);
  }
}

export async function runPartition(env, partitionId, deps = {}) {
  const at = deps.now ?? now();
  const owner = deps.owner ?? crypto.randomUUID();
  const part = await acquire(env, partitionId, owner, at);
  if (!part) return { skipped: true };
  const search = await env.DB.prepare("SELECT * FROM searches WHERE id=?").bind(part.search_id).first();
  const fence = "id=? AND lease_owner=? AND lease_token=?";
  try {
    const result = await searchEstablishments(
      env,
      { cnaes: JSON.parse(search.cnae_codes_json), uf: part.uf, municipalities: part.municipality_names_json ? JSON.parse(part.municipality_names_json) : [], page: part.page },
      deps.fetchImpl,
    );
    await persistItems(env, search, search.tenant_id, result.items, at);
    if (search.radius_km <= GEOCODE_ALL_UNDER_KM && result.items.length) {
      const ids = [];
      for (const group of chunks(result.items.map((x) => x.cnpj)))
        ids.push(
          ...(
            await s(
              env,
              `SELECT id FROM company_units WHERE tenant_id=? AND street IS NOT NULL AND geo_precision NOT IN ('address','manual') AND cnpj IN (${group.map(() => "?").join(",")})`,
              search.tenant_id,
              ...group,
            ).all()
          ).results.map((r) => r.id),
        );
      await enqueueGeocoding(env, ids, deps.geocodeEnqueue ? { enqueue: deps.geocodeEnqueue } : deps);
    }
    const statements = [
      env.DB.prepare(`UPDATE search_partitions SET status='done',result_total=?,done_at=?,error_kind=NULL,error=NULL WHERE ${fence}`).bind(result.total, at, part.id, owner, part.lease_token),
      env.DB.prepare("UPDATE searches SET api_calls=api_calls+1 WHERE id=?").bind(search.id),
    ];
    let next = null;
    if (result.total > part.page * PAGE_LIMIT) {
      next = crypto.randomUUID();
      statements.push(
        env.DB.prepare("INSERT OR IGNORE INTO search_partitions(id,search_id,scope,uf,municipality_key,municipality_names_json,page) VALUES (?,?,?,?,?,?,?)").bind(
          next, search.id, part.scope, part.uf, part.municipality_key, part.municipality_names_json, part.page + 1,
        ),
      );
    }
    const done = await env.DB.batch(statements);
    if (!done[0].meta.changes) return { fenced: true };
    if (next) {
      const row = await env.DB.prepare("SELECT id FROM search_partitions WHERE search_id=? AND scope=? AND uf=? AND municipality_key=? AND page=?")
        .bind(search.id, part.scope, part.uf, part.municipality_key, part.page + 1).first();
      await enqueue(env, deps, [row.id]);
    }
  } catch (e) {
    if (!(e instanceof AdapterError)) throw e;
    const retry = e.retryable && part.attempts < MAX_ATTEMPTS;
    const wait = new Date(Date.parse(at) + 30000 * 2 ** part.attempts).toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE search_partitions SET status=?,next_attempt_at=?,error_kind=?,error=?,lease_owner=NULL,lease_until=NULL WHERE ${fence}`).bind(
        retry ? "pending" : "failed", retry ? wait : null, e.kind, e.message, part.id, owner, part.lease_token,
      ),
      env.DB.prepare("UPDATE searches SET api_calls=api_calls+1 WHERE id=?").bind(search.id),
      // Sem saldo ou chave inválida: as demais partições falhariam igual e gastariam chamadas.
      ...(STOP_KINDS.has(e.kind)
        ? [env.DB.prepare("UPDATE search_partitions SET status='failed',error_kind=?,error=? WHERE search_id=? AND status='pending'").bind(e.kind, e.message, search.id)]
        : []),
    ]);
    if (retry) await enqueue(env, deps, [part.id], (Date.parse(wait) - Date.parse(at)) / 1000);
  }
  await finalize(env, search.id, at);
  return { processed: true };
}

export async function finalize(env, searchId, at = now()) {
  const counts = await env.DB.prepare(
    "SELECT SUM(status IN ('pending','leased')) open, SUM(status='done') done, SUM(status='failed') failed FROM search_partitions WHERE search_id=?",
  ).bind(searchId).first();
  if (counts.open > 0) return null;
  const failed = (
    await env.DB.prepare("SELECT uf,municipality_names_json,page,error_kind FROM search_partitions WHERE search_id=? AND status='failed' ORDER BY uf,municipality_key").bind(searchId).all()
  ).results;
  const status = !counts.failed ? "complete" : counts.done ? "partial" : "failed";
  const note = failed.length
    ? "Sem resultado de: " + failed.map((f) => `${f.municipality_names_json ? JSON.parse(f.municipality_names_json).join(", ") : "toda a UF"}/${f.uf}${f.page > 1 ? ` (pág. ${f.page})` : ""} [${f.error_kind}]`).join("; ")
    : null;
  await env.DB.prepare(
    "UPDATE searches SET status=?,coverage_note=?,finished_at=?,candidates_count=(SELECT COUNT(*) FROM search_candidates WHERE search_id=?) WHERE id=? AND status IN ('running','partial','failed')",
  ).bind(status, note, at, searchId, searchId).run();
  return status;
}

export async function getSearch(env, actor, id) {
  const row = await s(env, "SELECT * FROM searches WHERE tenant_id=? AND id=?", actor.tenant_id, id).first();
  if (!row) fail(404, "search_not_found", "Busca não encontrada.");
  const parts = (
    await s(env, "SELECT scope,uf,municipality_names_json,page,status,attempts,error_kind,result_total FROM search_partitions WHERE search_id=? ORDER BY uf,municipality_key,page", id).all()
  ).results;
  return { search: row, partitions: parts };
}

// Retoma partições pendentes e reabre as que falharam por motivo temporário ou falta de saldo/chave já resolvida.
export async function resumeSearch(request, env, actor, rid, id, deps = {}) {
  requireRole(actor, APPROVER_ROLES);
  await getSearch(env, actor, id);
  await bodyJson(request);
  await commit(env, [
    s(env, "UPDATE search_partitions SET status='pending',attempts=0,next_attempt_at=NULL WHERE search_id=? AND status='failed' AND error_kind IN ('temporary','incomplete','no_balance','auth')", id),
    s(env, "UPDATE searches SET status='running',finished_at=NULL WHERE id=? AND tenant_id=?", id, actor.tenant_id),
    auditStatement(env, actor, rid, "search.resumed", "search", id),
  ]);
  const pending = (await s(env, "SELECT id FROM search_partitions WHERE search_id=? AND status='pending'", id).all()).results.map((r) => r.id);
  await enqueue(env, deps, pending);
  await finalize(env, id);
  return { searchId: id, requeued: pending.length };
}

// Sem perfil registrado, o porte da fonte dá uma ordem provisória (marcada como provisória).
const ICP_SQL = `COALESCE(icp,CASE WHEN size_code IN ('01','03') THEN 'out_small' ELSE 'pending_size' END)`;
const ICP_RANK_SQL = `CASE ${ICP_SQL} WHEN 'in_icp' THEN 0 WHEN 'pending_size' THEN 1 WHEN 'out_trader' THEN 2 WHEN 'out_giant' THEN 3 ELSE 4 END`;

export async function listCandidates(request, env, actor, id) {
  const { search } = await getSearch(env, actor, id);
  const { limit, offset } = pageOf(request);
  const order = new URL(request.url).searchParams.get("order") === "distance" ? "distance" : "icp";
  const camp = await s(env, "SELECT product_id FROM campaigns WHERE id=?", search.campaign_id).first();
  const byDistance = "distance_km IS NULL, distance_km, cnpj";
  const rows = (
    await s(
      env,
      `WITH base AS (
         SELECT sc.distance_km,sc.distance_basis,sc.inside_radius,u.id unit_id,u.cnpj,u.trade_name,u.municipality_name,u.uf,u.geo_precision,u.size_code,u.size_label,
                c.id company_id,c.legal_name,
                (SELECT bp.icp_status FROM buyer_profiles bp WHERE bp.tenant_id=c.tenant_id AND bp.company_id=c.id AND bp.product_id=? AND bp.unit_key IN ('',u.id) ORDER BY bp.unit_key DESC LIMIT 1) icp
         FROM search_candidates sc JOIN company_units u ON u.id=sc.unit_id JOIN companies c ON c.id=u.company_id
         WHERE sc.search_id=?)
       SELECT *, ${ICP_SQL} icp_status, icp IS NULL icp_provisional FROM base
       ORDER BY ${order === "distance" ? byDistance : `${ICP_RANK_SQL}, ${byDistance}`} LIMIT ? OFFSET ?`,
      camp.product_id,
      id,
      limit + 1,
      offset,
    ).all()
  ).results.map(({ icp, ...r }) => ({ ...r, icp_provisional: !!r.icp_provisional }));
  return { search, order, items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

export { normalizeName };
