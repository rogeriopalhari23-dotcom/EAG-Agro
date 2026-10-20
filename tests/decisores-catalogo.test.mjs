// Lista única de commodities (farelo de milho distinto de CGF, CGM e DDGS), decisores junto às empresas (busca por
// pessoa e contato, filtros combinados sem duplicar, canal geral separado, permissões), cobertura e leitura da ABIC.
// Tudo local e fictício: nenhuma consulta externa, nenhum e-mail deduzido, nenhum crédito de validação.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./helpers/db.mjs";
import { parseAbic, fetchAbicRoasters } from "../src/adapters/abic.js";

const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

test("catálogo: Farelo de milho entra uma vez, com código próprio, e não se confunde com CGF, CGM nem DDGS", async (t) => {
  const { api, close } = setup();
  t.after(close);
  const r = (await api("/api/catalog")).data;
  const farelo = r.products.filter((p) => fold(p.display_name ?? p.variant_name) === "farelo de milho");
  assert.equal(farelo.length, 1, "uma entrada só");
  assert.equal(farelo[0].commodity, "corn_bran");
  const fp = (await api(`/api/catalog/${farelo[0].id}`)).data;
  assert.ok(fp.codes.some((c) => c.code_system === "HS" && c.code === "230210" && c.status === "pending" && c.source_ref), "subposição 2302.10 sugerida com fonte; confirmação é do administrador");
  const list = r.commodities;
  const byCode = Object.fromEntries(list.map((c) => [c.code, c]));
  assert.equal(byCode.corn_bran.label, "Farelo de milho");
  for (const other of ["ddgs", "cgf", "cgm"].map((k) => list.find((c) => c.code !== "corn_bran" && fold(c.label).includes(`(${k})`)))) {
    assert.ok(other, "CGF, CGM e DDGS seguem como commodities próprias");
    assert.ok(!other.aliases.some((a) => fold(a) === "farelo de milho"), `${other.label} não tem farelo de milho como sinônimo`);
    assert.match(other.label, /^[A-ZÁÉÍÓÚ][a-zà-ú].+\([A-Z]+\)$/, "nome comercial claro, sigla só como complemento");
  }
  assert.ok(!byCode.corn_bran.aliases.some((a) => /cgf|cgm|ddgs|glúten|destilaria/i.test(a)));
  assert.equal(new Set(list.map((c) => c.code)).size, list.length, "uma linha por commodity");
  assert.equal(new Set(list.map((c) => fold(c.label))).size, list.length, "nomes distintos");
  // Cada produto pertence a uma commodity só (nenhum produto herdado de outra).
  const owners = list.flatMap((c) => c.products.map((p) => [p.id, c.code]));
  assert.equal(new Set(owners.map(([id]) => id)).size, owners.length);
  for (const [id, code] of owners) assert.equal(r.products.find((p) => p.id === id).commodity, code);
});

async function world(t) {
  const ctx = setup();
  t.after(ctx.close);
  const { api, DB } = ctx;
  const mk = async (legalName) => (await api("/api/companies", "POST", { legalName, countryCode: "BR", sourceLabel: "Teste controlado (fictício)" })).data.id;
  const [a, b, c] = [await mk("Torrefação Alfa Ltda (fictícia)"), await mk("Rações Beta Ltda (fictícia)"), await mk("Moinho Gama Ltda (fictícia)")];
  const contact = async (cid, body) => {
    const r = await api(`/api/companies/${cid}/contacts`, "POST", { sourceLabel: "Site da empresa (fictício)", sourceUrl: "https://alfa.previa.invalid/contato", ...body });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.id;
  };
  // A: duas pessoas compradoras (uma confirmada) + canal geral. B: só canal geral. C: pessoa a validar (candidata).
  const ana = await contact(a, { fullName: "Ana Souza Teste", jobTitle: "Compradora", email: "ana.souza@alfa.previa.invalid", phone: "+55 35 3551-1234", prospectRole: "decision_maker" });
  await contact(a, { fullName: "Bruno Lima Teste", jobTitle: "Gerente de suprimentos", prospectRole: "influencer" });
  const geral = await contact(a, { fullName: "Canal geral", email: "contato@alfa.previa.invalid", phone: "+55 35 3551-0000" });
  const geralB = await contact(b, { fullName: "Canal geral", email: "comercial@beta.previa.invalid" });
  DB.raw.prepare("UPDATE contacts SET contact_kind='company_channel' WHERE id IN (?,?)").run(geral, geralB);
  const demandId = crypto.randomUUID();
  DB.raw.prepare("INSERT INTO demands(id,tenant_id,company_id,commodity,product_id,created_by) VALUES (?,?,?,?,?,?)").run(demandId, "eag-internal", a, "coffee", "product-05", "system-admin");
  DB.raw.prepare("INSERT INTO demands(id,tenant_id,company_id,commodity,product_id,created_by) VALUES (?,?,?,?,?,?)").run(crypto.randomUUID(), "eag-internal", b, "corn", "product-01", "system-admin");
  const v = await api(`/api/companies/${a}/contact-verifications`, "POST", { contactId: ana, demandId, type: "identity", status: "confirmed", method: "Telefonema com a pessoa", sourceReference: "Registro interno fictício" });
  assert.ok(v.status < 300, JSON.stringify(v.data));
  const { encryptPii } = await import("../src/crypto.js");
  DB.raw.prepare("INSERT INTO person_candidates(id,tenant_id,company_id,name_encrypted,name_hash,title_encrypted,email_encrypted,phone_encrypted,role_suggestion,relevance,source_kind,source_url,status,verified_at,refresh_after,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(crypto.randomUUID(), "eag-internal", c, await encryptPii("Carla Dias Teste", ctx.env), "hash-ficticio", await encryptPii("Compras", ctx.env), null, null, "provisional_decision_maker", "cargo de compras no site", "company_site", "https://gama.previa.invalid/equipe", "to_validate", "2026-10-20T10:00:00.000Z", "2027-04-18T10:00:00.000Z", "system-admin");
  for (const [cid, uf] of [[a, "MG"], [b, "MG"], [c, "SP"]])
    DB.raw.prepare("INSERT INTO company_units(id,tenant_id,company_id,cnpj,uf,source_label,consulted_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), "eag-internal", cid, String(Math.floor(Math.random() * 1e14)).padStart(14, "1"), uf, "Teste", "2026-10-20");
  return { ...ctx, a, b, c };
}

test("empresas: busca por nome, e-mail e telefone da pessoa vinculada; canal geral nunca vira contato pessoal", async (t) => {
  const { api, a, b, c } = await world(t);
  const ids = async (q) => (await api(`/api/companies?${q}`)).data.companies.map((x) => x.id).sort();
  assert.deepEqual(await ids("q=ana%20souza"), [a]);
  assert.deepEqual(await ids("q=Ana%20Sou%C3%A7a".replace("%C3%A7", "z")), [a]);
  assert.deepEqual(await ids("q=ana.souza%40alfa"), [a], "e-mail");
  assert.deepEqual(await ids("q=3551-1234"), [a], "telefone (dígitos)");
  assert.deepEqual(await ids("q=carla"), [c], "pessoa a validar também encontra a empresa");
  assert.deepEqual(await ids("q=Rações%20Beta"), [b], "nome da empresa segue funcionando");
  const list = (await api("/api/companies")).data.companies;
  const da = list.find((x) => x.id === a).decisors;
  assert.equal(da.people.length, 2, "o canal geral não entra entre as pessoas");
  assert.equal(da.summary.name, "Ana Souza Teste");
  assert.equal(da.summary.status, "confirmado");
  assert.equal(da.people.find((p) => p.name === "Bruno Lima Teste").status, "identificado");
  assert.equal(da.channels.length, 1);
  assert.equal(da.channels[0].email, "contato@alfa.previa.invalid");
  assert.equal(da.people[0].sourceUrl, "https://alfa.previa.invalid/contato", "fonte da pessoa");
  const db = list.find((x) => x.id === b).decisors;
  assert.equal(db.summary, null, "só canal geral: decisor ainda não identificado");
  assert.equal(db.people.length, 0);
  assert.equal(db.channels[0].email, "comercial@beta.previa.invalid");
  const dc = list.find((x) => x.id === c).decisors;
  assert.equal(dc.summary.status, "a validar");
  assert.equal(dc.people[0].email, null, "nenhum e-mail deduzido");
  // Rota dos resultados da prospecção: mesmos dados; ids de fora do inquilino são ignorados.
  const r = (await api(`/api/companies/decisors?ids=${a},${c},nao-existe`)).data.items;
  assert.deepEqual(Object.keys(r).sort(), [a, c].sort());
});

test("empresas: filtros de decisor, commodity e estado combinam sem duplicar empresas", async (t) => {
  const { api, a, b, c } = await world(t);
  const ids = async (q) => {
    const r = (await api(`/api/companies?${q}`)).data;
    const got = r.companies.map((x) => x.id);
    assert.equal(new Set(got).size, got.length, `sem duplicadas em ${q}`);
    assert.equal(r.total, got.length, `total coerente em ${q}`);
    return got.sort();
  };
  assert.deepEqual(await ids("decisor=confirmado"), [a]);
  assert.deepEqual(await ids("decisor=identificado"), [a]);
  assert.deepEqual(await ids("decisor=a_validar"), [c]);
  assert.deepEqual(await ids("decisor=sem"), [b]);
  assert.deepEqual(await ids("commodity=coffee"), [a]);
  assert.deepEqual(await ids("uf=MG"), [a, b].sort());
  assert.deepEqual(await ids("uf=mg&decisor=sem"), [b]);
  assert.deepEqual(await ids("uf=MG&commodity=coffee&q=bruno"), [a], "pessoa + commodity + estado");
  assert.deepEqual(await ids("uf=SP&commodity=coffee"), []);
  assert.equal((await api("/api/companies?decisor=talvez")).status, 422);
  assert.equal((await api("/api/companies?uf=XX")).status, 422);
});

test("empresas: leitor vê decisores e filtra, mas não cadastra contato", async (t) => {
  const ctx = await world(t);
  ctx.DB.raw.exec("INSERT INTO users(id,tenant_id,email,display_name,role) VALUES ('u-leitor','eag-internal','leitor@teste.invalid','Leitor (teste)','auditor_viewer')");
  ctx.env.LOCAL_USER_EMAIL = "leitor@teste.invalid";
  const r = await ctx.api("/api/companies?q=ana");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.companies.map((x) => x.id), [ctx.a]);
  assert.equal((await ctx.api(`/api/companies/decisors?ids=${ctx.a}`)).status, 200);
  assert.equal((await ctx.api(`/api/companies/${ctx.a}/contacts`, "POST", { fullName: "Outra Pessoa", sourceLabel: "x" })).status, 403);
});

test("cobertura: nacional lista as fontes e a indisponível; internacional exige país da lista e informa lacunas", async (t) => {
  const { api, close } = setup();
  t.after(close);
  const n = (await api("/api/prospect/coverage?market=national&productId=product-05")).data;
  assert.ok(n.items.find((x) => /ABIC/.test(x.label)).available, "café: ABIC entra");
  assert.equal(n.items.find((x) => /SIPEAGRO/.test(x.label)).available, false);
  assert.equal(n.partial, true, "pesquisa gratuita nunca é apresentada como completa");
  const ar = await api("/api/prospect/coverage?market=international&productId=product-05&iso2=AR");
  assert.equal(ar.status, 200, "Argentina está na lista mesmo sem conector próprio");
  assert.equal(ar.data.country, "Argentina");
  assert.equal(ar.data.partial, true);
  assert.equal((await api("/api/prospect/coverage?market=international&productId=product-05&iso2=ZZ")).status, 422);
});

test("ABIC: lê a lista embutida, agrupa por industrializador e estado; mudança de formato vira fonte indisponível", async () => {
  const html = `<script>var dados = { produtos: ${JSON.stringify([
    { no_torrefador: "TORREFADORA X LTDA (FICTÍCIA)", co_sigla_estado_fabrica: "MG", no_produto: "CAFÉ X" },
    { no_torrefador: "TORREFADORA X LTDA (FICTÍCIA)", co_sigla_estado_fabrica: "MG", no_produto: "CAFÉ X GOURMET" },
    { no_torrefador: "TORREFADORA X LTDA (FICTÍCIA)", co_sigla_estado_fabrica: "SP", no_produto: "CAFÉ X SP" },
  ])}, total: 3 };</script>`;
  const r = parseAbic(html);
  assert.equal(r.length, 2, "mesmo nome em dois estados = duas fábricas");
  assert.deepEqual(r.map((x) => x.uf).sort(), ["MG", "SP"]);
  assert.throws(() => parseAbic("<html>sem lista</html>"));
  await assert.rejects(fetchAbicRoasters(async () => new Response("x", { status: 503 })));
  await assert.rejects(fetchAbicRoasters(async () => new Response("<html>nova página</html>", { status: 200 })));
});
