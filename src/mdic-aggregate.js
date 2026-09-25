// Agregação do MDIC por país (pura, sem E/S): usada pelo Worker (junção por grupo) e pelo job mensal do GitHub.
// Entrada: agregados por pedaço { "CO_PAIS|NCM|AAAA-MM": [fob, kg, qt|null] }, CO_PAIS → ISO-3, tabela NCM.
// Os CO_PAIS de um mesmo país somam (ex.: DEU = 023 + 025); CO_PAIS sem país no cadastro é contado, não descartado em silêncio.

export function createAccumulator(codes, members) {
  const want = new Set(members);
  const acc = new Map(members.map((iso) => [iso, new Map()]));
  let unknownCodes = 0, lastYm = null;
  return {
    add(rows) {
      for (const [k, [fob, kg, qt]] of Object.entries(rows)) {
        const [pais, n, ym] = k.split("|");
        if (!lastYm || ym > lastYm) lastYm = ym;
        const iso = codes[pais];
        if (!iso) {
          unknownCodes++;
          continue;
        }
        if (!want.has(iso)) continue;
        const m = acc.get(iso);
        const kk = `${n}|${ym}`;
        const c = m.get(kk) || m.set(kk, [0, 0, null]).get(kk);
        c[0] += fob;
        c[1] += kg;
        if (qt !== null) c[2] = (c[2] ?? 0) + qt;
      }
    },
    // Soma outro acumulador (ex.: um ano lido por inteiro numa única publicação) neste.
    mergeFrom(other) {
      for (const [iso, m] of other._acc) {
        const mine = acc.get(iso);
        if (!mine) continue;
        for (const [kk, [fob, kg, qt]] of m) {
          const c = mine.get(kk) || mine.set(kk, [0, 0, null]).get(kk);
          c[0] += fob;
          c[1] += kg;
          if (qt !== null) c[2] = (c[2] ?? 0) + qt;
        }
      }
      unknownCodes += other.unknownCodes;
      if (other.lastYm && (!lastYm || other.lastYm > lastYm)) lastYm = other.lastYm;
    },
    get _acc() {
      return acc;
    },
    get unknownCodes() {
      return unknownCodes;
    },
    get lastYm() {
      return lastYm;
    },
    // Objeto final por país, no formato lido pela análise (src/country-analysis.js).
    countryObject(iso, { versionId, ncm, validators, classificationVersion }) {
      const lines = [...acc.get(iso)]
        .map(([kk, [fob, kg, qt]]) => {
          const [n, ym] = kk.split("|");
          return { ncm: n, hs6: ncm[n]?.sh6 ?? n.slice(0, 6), ym, fobUsd: fob, netKg: kg, qt, unit: ncm[n]?.unit ?? null, namePt: ncm[n]?.namePt ?? null, nameEn: ncm[n]?.nameEn ?? null };
        })
        .sort((a, b) => (a.ncm + a.ym).localeCompare(b.ncm + b.ym));
      const state = lines.some((l) => l.fobUsd > 0 || l.netKg > 0) ? "purchase_identified" : "no_record";
      const lastPeriod = lines.reduce((m, l) => (l.ym > m ? l.ym : m), "") || lastYm;
      return { iso3: iso, versionId, source: "mdic", state, lastPeriod, fileLastPeriod: lastYm, basis: "FOB", view: "exportações do Brasil", validators, classification: classificationVersion, lines };
    },
  };
}
