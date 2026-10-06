// Consolida a descoberta milho GMO / Indiara 300 km (regras de 2026-10-06, revisão 2):
// - deduplicação automática SÓ por CNPJ completo igual; registro MAPA sem CNPJ conferido fica pelo número do registro;
// - candidata manual e registro MAPA continuam linhas separadas quando o vínculo não é inequívoco:
//   ligados como "possível correspondência — a conciliar" (nome e município sugerem, não confirmam);
// - evidência manual só é da unidade quando a fonte publica o CNPJ, o cadastro oficial corresponde, ou nome e
//   endereço completos da unidade batem com evidência verificável; evidência sobre a empresa fica no nível da empresa;
// - raiz de CNPJ = mesma pessoa jurídica (matriz/filiais); grupo econômico é outro campo, não deduzido da raiz;
// - PME só com porte cadastral ME/EPP; "DEMAIS" não define porte; registro no MAPA não prova compra de milho;
// - distância estimada pelo centroide do município; perto de 300 km exige conferir a unidade.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const dir = process.argv[2], outDir = process.argv[3];
const act = JSON.parse(readFileSync(`${dir}/sipe_ativos.json`, "utf8"));
const api = new Map((existsSync(`${dir}/brasilapi.jsonl`) ? readFileSync(`${dir}/brasilapi.jsonl`, "utf8").trim().split("\n").filter(Boolean) : []).map((l) => JSON.parse(l)).filter((r) => !r.http && !r.erro).map((r) => [r.cnpj, r]));
const N = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
const fmt = (c) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
const SIPE = "MAPA SIPEAGRO: CSV aberto (CC-BY, arquivo de 04/10/2026) e lista oficial PDF de 21/07/2026, consultados em 06/10/2026";
const NP = "não pesquisado nesta etapa";
const MUN = new Map(readFileSync(`${outDir}/municipios-300km.csv`, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(";")).map((c) => [`${N(c[1])}/${c[2]}`, `${c[1]}/${c[2]}`]));

// Candidatas da pesquisa manual (rodada 1, 06/10/2026). Campos:
// sec: A (consumidora), A2 (projeto), A3 (processa milho com restrição não-GMO registrada na linha/unidade), B (trader)
// ev: "específica" (a fonte cita milho) | "indício" (atividade sem citar milho) | "projeto" | "trader"
// nivel: a quem a evidência se refere: "unidade" (a fonte descreve a unidade) | "empresa" (empresa ou grupo, sem unidade)
// cnpj + cnpjVinculo: só quando inequívoco (publicado na fonte, ou cadastro oficial da própria unidade)
// re/mun: padrão para SUGERIR registro MAPA correspondente (nunca confirma)
const M = (o) => o;
const MANUAL = [
  M({ id: "M01", sec: "A", nome: "Gem Alimentos — usina de etanol de milho", mun: ["ACREUNA/GO"], km: 48.2, ev: "específica", nivel: "unidade", det: "Autorização ANP (DOU 23/02/2023) para etanol de milho, até 120 mil L/dia; a empresa mói milho e modifica amido. Operação atual não confirmada por fonte de 2024–2026; compra de milho de terceiros não declarada", fonte: "Empreender em Goiás 27/02/2023; JornalCana 24/02/2023", re: /\bGEM\b/, sugestao: "25.006.271/0001-85 (Receita: GEM e/ou GEM ALIMENTOS, BR-060 km 308, Acreúna; CNAE secundário álcool e óleo de milho) — nome e município batem, mas a fonte não traz CNPJ nem endereço da usina" }),
  M({ id: "M02", sec: "A", nome: "Rei do Milho Alimentos", mun: ["INHUMAS/GO"], km: 106.5, kmPrec: "coordenada de diretório de mapas (não oficial) do endereço", ev: "específica", nivel: "unidade", det: "Moagem de milho (creme, sêmola, grits, fubá, gérmen); parque de 140 mil m² em Inhumas desde 1999. Compra de milho de terceiros não declarada. Razão social atual: 'em recuperação judicial'", fonte: "reidomilho.com.br, consultado em 06/10/2026", site: "reidomilho.com.br", canal: "geral@ / contato@reidomilho.com.br · (62) 3514-1751 (publicados no site; não validados)", cnpj: "05574242000102", cnpjVinculo: "endereço do site (Rod. GO-426 km 01, 2024, Bloco B, Inhumas) = endereço da Receita do CNPJ", alerta: "empresa em recuperação judicial (razão social na Receita)", re: /REI DO MILHO/ }),
  M({ id: "M03", sec: "A", nome: "BRF/MBRF — complexo de Rio Verde (fábrica de rações)", mun: ["RIO VERDE/GO"], km: 129.2, ev: "específica", nivel: "unidade", det: "Ração com milho e sorgo locais; ~750 mil t de milho e farelo de soja em 2007 (dados de 2007–2014). A unidade segue operando (8 mil funcionários, 2026), mas o uso atual de milho não foi confirmado por fonte recente", fonte: "Folha de S.Paulo 23/06/2014; artigo UNIFACS; AgFeed 21/02/2026 (operação)", site: "brf-global.com", grupoEco: "BRF/MBRF (fonte: Política em Goiás 18/09/2024)", re: /^BRF\b/, sugestao: "01.838.723/0172-83 (único registro de ração BRF em Rio Verde no MAPA; Receita: BR-060 km 394, CNAE abate de suínos) — a fonte da evidência não traz CNPJ nem endereço da fábrica" }),
  M({ id: "M04", sec: "A", nome: "Usina Rio Verde", mun: ["RIO VERDE/GO"], km: 129.2, ev: "indício", nivel: "empresa", det: "Rebaixada: o site fala em 'etanol de grãos', DDG e WDG, sem nomear milho — grãos não comprovam milho", fonte: "usinarioverde.com.br, consultado em 06/10/2026", site: "usinarioverde.com.br", re: /USINA RIO VERDE/ }),
  M({ id: "M05", sec: "A", nome: "Caramuru Alimentos — fábrica de processamento de milho", mun: ["ITUMBIARA/GO"], km: 142.4, ev: "específica", nivel: "unidade", det: "Site da empresa: unidade de Itumbiara com processamento de milho de 24 mil t/mês, degerminação 960 t/dia, pré-cozido 5 mil t/mês (página sem data). Também origina grãos; compra de terceiros não declarada nessa página", fonte: "caramuru.com, página 'Unidades industriais – Itumbiara', consultada em 06/10/2026", site: "caramuru.com", gmo: "a confirmar; a empresa declara linha de produtos não transgênicos (restrição dessa linha, não de toda a operação)", re: /CARAMURU/, sugestao: "00.080.671/0001-00 é o CNPJ da matriz publicado pela própria empresa (Via Expressa Júlio Borges de Souza, 4240, Itumbiara); há outras filiais no mesmo complexo (0032-06 no nº 4240; 0033-97 no nº 4200) — qual delas opera a fábrica de milho fica a confirmar" }),
  M({ id: "M06", sec: "A", nome: "São Martinho — Usina Boa Vista, planta de milho", mun: ["QUIRINOPOLIS/GO"], km: 151.4, ev: "específica", nivel: "unidade", det: "Em operação: previsão de 495 mil t de milho na safra 2026/27 (manutenção ampliada pela 2ª fase). Compra de milho de terceiros não declarada nas fontes; a ampliação de 2027 é projeto à parte", fonte: "RPAnews 27/05/2026; BNDES (operação desde 2023/24)", site: "usinasaomartinho.com", cnpj: "51466860006278", cnpjVinculo: "cadastros oficiais: Receita (Rod. GO-164 km 10, Fazenda Boa Vista, CNAE fabricação de álcool) e registro MAPA GO0008761 de ingrediente no mesmo CNPJ", re: /MARTINHO/ }),
  M({ id: "M07", sec: "A", nome: "Cargill Bioenergia — Unidade São Francisco", mun: ["QUIRINOPOLIS/GO"], km: 151.4, ev: "específica", nivel: "unidade", det: "Em operação em 2025/26: cana e milho; maceração de 600 mil t de milho/ano; óleo de milho e DDG. Compra de milho de terceiros não declarada", fonte: "STG News 01/09/2026; Globo Rural 11/06/2025", cnpj: "10249419000216", cnpjVinculo: "cadastro oficial: Receita com nome fantasia 'USF USINA SAO FRANCISCO' (Rod. GO-206 km 18, Fazenda São Francisco) e registro MAPA GO0011258 no mesmo CNPJ", re: /CARGILL BIOENERGIA/ }),
  M({ id: "M08", sec: "A", nome: "Cargill — complexo de Uberlândia", mun: ["UBERLANDIA/MG"], km: 256.5, kmPrec: "coordenada da unidade publicada no parecer IGAM/COPAM (18°50'57\"S, 48°17'17\"O)", ev: "específica", nivel: "unidade", det: "Planta de milho com capacidade nominal de 60 mil t/mês (glúten, amido, óleo); 'milho também fornecido por fazendeiros, cooperativas e corretores' — compra de terceiros declarada. Licença renovada em 2021 por 8 anos; operação 2025–2026 não confirmada por fonte própria recente", fonte: "Parecer Único SUPRAM TM 0138312/2021, de 25/01/2021", cnpj: "60498706013488", cnpjVinculo: "CNPJ e endereço (Rua Will Cargill, 880) publicados na fonte da evidência; mesmo endereço na Receita", rf: "ativa; filial; CNAE 1065-1/01 (amidos e féculas); porte Demais (BrasilAPI 06/10/2026)", re: /CARGILL AGRICOLA/ }),
  M({ id: "M09", sec: "A", nome: "Grupo JBJ — confinamento Fazenda Colorado", mun: ["ARUANA/GO"], km: 284.1, ev: "específica", nivel: "unidade", det: "Mais de 1.000 t de ração/dia; 'parte significativa do milho' é produzida no próprio sistema — produção própria não comprova compra de terceiros", fonte: "Curta Mais 05/01/2026", re: /JBJ/, sugestao: "15.689.716/0022-40 'JBJ NUTRICAO ANIMAL' (registro MAPA; endereço na GO-530 km 30, Fazenda Planura). A Fazenda Colorado tem outros CNPJs da mesma raiz (0033-00, 0032-11) — a fábrica que atende o confinamento fica a confirmar" }),
  M({ id: "M10", sec: "A", nome: "JBS — confinamento com fábrica de ração (Fazenda Planura)", mun: ["ARUANA/GO"], km: 284.1, ev: "histórica", nivel: "unidade", det: "Fonte de 2014: não comprova operação atual. O CNPJ JBS Confinamento 'Fazenda Planura' segue ativo (GO-530 km 30), mas a JBJ registra no MAPA uma fábrica de ração no mesmo endereço — provável sobreposição com M09, a conciliar", fonte: "ACSURS 07/05/2014; cadastro de terceiros (indicecnpj, Receita 07/2026)", re: /^JBS\b/ }),
  M({ id: "M11", sec: "A", nome: "Agroquima — fábrica de rações e suplementos", mun: ["APARECIDA DE GOIANIA/GO"], km: 85.9, ev: "indício", nivel: "empresa", det: "Rações e suplementos para bovinos", fonte: "LinkedIn, consultado em 06/10/2026", re: /AGROQUIMA/ }),
  M({ id: "M12", sec: "A", nome: "São Salvador Alimentos (SuperFrango) — SSA Rações NV", mun: ["NOVA VENEZA/GO"], km: 115.8, ev: "indício", nivel: "unidade", det: "Fábrica de ração (avicultura integrada)", fonte: "BrasilAPI 06/10/2026", cnpj: "03387396002294", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /SAO SALVADOR/ }),
  M({ id: "M13", sec: "A", nome: "Adimax — unidade industrial", mun: ["GOIANAPOLIS/GO"], km: 121.5, ev: "indício", nivel: "unidade", det: "Alimentos para cães e gatos", fonte: "adimax.com.br, consultado em 06/10/2026", site: "adimax.com.br", re: /ADIMAX/ }),
  M({ id: "M14", sec: "A", nome: "São Salvador Alimentos (SuperFrango) — Super Frango Rações", mun: ["ITABERAI/GO"], km: 123.8, ev: "indício", nivel: "unidade", det: "Fábrica de ração", fonte: "BrasilAPI 06/10/2026", cnpj: "03387396000240", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /SAO SALVADOR/ }),
  M({ id: "M15", sec: "A", nome: "São Salvador Alimentos (SuperFrango) — Fábrica de Rações Matrizes", mun: ["ITABERAI/GO"], km: 123.8, ev: "indício", nivel: "unidade", det: "Fábrica de ração", fonte: "BrasilAPI 06/10/2026", cnpj: "03387396002456", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /SAO SALVADOR/ }),
  M({ id: "M16", sec: "A", nome: "De Heus — unidade industrial", mun: ["ITABERAI/GO"], km: 123.8, ev: "indício", nivel: "unidade", det: "Suplementos, premixes, núcleos, proteinados e rações; a matéria cita milho nas dietas da região, não na fábrica", fonte: "Portal do Agronegócio 26/05/2026", re: /HEUS/ }),
  M({ id: "M17", sec: "A", nome: "Comigo — fábrica de rações", mun: ["RIO VERDE/GO"], km: 129.2, ev: "indício", nivel: "unidade", det: "Rações (151 fórmulas); a cooperativa também origina e armazena milho", fonte: "comigo.coop.br; revista Comigo; BrasilAPI 06/10/2026", site: "comigo.coop.br", canal: "(64) 3611-1500 (revista da Comigo)", cnpj: "02077618000266", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /COMIGO|COOPERATIVA AGROINDUSTRIAL DOS PRODUTORES RURAIS DO SUDOESTE/ }),
  M({ id: "M18", sec: "A", nome: "Fazenda Tropical — boitel", mun: ["MONTIVIDIU/GO"], km: 130.6, ev: "indício", nivel: "unidade", det: "Boitel; mais de 35 mil cabeças já confinadas", fonte: "fazendatropicalgoias.com.br, consultado em 06/10/2026", site: "fazendatropicalgoias.com.br", canal: "fazenda.tropical@yahoo.com.br · (64) 99904-1996 (publicados no site; não validados)", re: /FAZENDA TROPICAL/ }),
  M({ id: "M19", sec: "A", nome: "Premix — filial Anápolis", mun: ["ANAPOLIS/GO"], km: 145.4, ev: "indício", nivel: "unidade", det: "Premix e suplementos; nada sobre milho", fonte: "BrasilAPI 06/10/2026", cnpj: "50411321002877", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /PREMIX/ }),
  M({ id: "M20", sec: "A", nome: "Agrocria Nutrição Animal", mun: ["ANAPOLIS/GO"], km: 145.4, ev: "indício", nivel: "empresa", det: "Nutrição para confinamento com milho grão inteiro (relatório de 2014)", fonte: "relatório de estágio, 2014", re: /AGROCRIA/ }),
  M({ id: "M21", sec: "A", nome: "BAIA Nutrição Animal (Araguaia)", mun: ["ABADIANIA/GO"], km: 173.8, ev: "indício", nivel: "empresa", det: "Nutrição animal: 12 mil t/ano", fonte: "araguaia.com.br, consultado em 06/10/2026", site: "araguaia.com.br", re: /ARAGUAIA S\.?A|BAIA/ }),
  M({ id: "M22", sec: "A", nome: "Confinamento Pontal", mun: ["ITAPIRAPUA/GO"], km: 185.8, ev: "indício", nivel: "unidade", det: "Confinamento; a fonte cita sorgo", fonte: "Diário da Manhã 13/09/2024", re: /PONTAL/ }),
  M({ id: "M23", sec: "A", nome: "BRF/MBRF — Jataí (fábrica de rações)", mun: ["JATAI/GO"], km: 203.6, ev: "indício", nivel: "unidade", det: "Abate de aves; fábrica de rações", fonte: "artigo UNIFACS; Política em Goiás 18/09/2024", site: "brf-global.com", re: /^BRF\b/ }),
  M({ id: "M24", sec: "A", nome: "FVO Alimentos — fábrica Rialma", mun: ["RIALMA/GO"], km: 210.3, ev: "indício", nivel: "unidade", det: "Alimentos para cães e gatos", fonte: "fvoalimentos.com.br, consultado em 06/10/2026", site: "fvoalimentos.com.br", re: /^FVO/ }),
  M({ id: "M25", sec: "A", nome: "Rialma Agropecuária — confinamento", mun: ["LUZIANIA/GO"], km: 224.4, ev: "indício", nivel: "unidade", det: "Confinamento de bovinos de corte", fonte: "repositório IF Goiano 15/08/2025", re: /RIALMA AGRO/ }),
  M({ id: "M26", sec: "A", nome: "BRF/MBRF — Mineiros (fábrica de rações)", mun: ["MINEIROS/GO"], km: 299.8, ev: "indício", nivel: "unidade", det: "Abate; fábrica de rações", fonte: "artigo UNIFACS", site: "brf-global.com", re: /^BRF\b/ }),
  M({ id: "P01", sec: "A2", nome: "Inpasa — biorrefinaria (em construção)", mun: ["RIO VERDE/GO"], km: 129.2, ev: "projeto", nivel: "unidade", det: "Operação prevista para o 1º trimestre de 2027; 2 Mt de grãos/ano", fonte: "Inpasa 30/10/2025", site: "inpasa.com.br", re: /INPASA/ }),
  M({ id: "P02", sec: "A2", nome: "Goiás Bioenergia — planta de milho anunciada", mun: ["PORTEIRAO/GO"], km: 81.9, ev: "projeto", nivel: "unidade", det: "Anunciada em 2022; operação não confirmada", fonte: "JornalCana 08/06/2022", re: /GOIAS BIOENERGIA/ }),
  M({ id: "P03", sec: "A2", nome: "Energética Serranópolis", mun: ["SERRANOPOLIS/GO"], km: 264.3, ev: "projeto", nivel: "unidade", det: "Início do processamento de milho previsto para 2026", fonte: "Jornal Opção 13/06/2026", re: /SERRANOPOLIS/ }),
  M({ id: "R01", sec: "A3", nome: "Milhão Ingredientes", mun: null, km: null, ev: "específica", nivel: "empresa", det: "Processa milho; linha de ingredientes de milho Non-GMO (unidades em Goianira e Rio Verde, ex-LDC)", fonte: "milhao.net, consultado em 06/10/2026", site: "milhao.net", gmo: "restrição registrada só na linha de ingredientes Non-GMO; outras linhas e unidades a verificar", re: /MILH[AÃ]O IND/ }),
  M({ id: "R02", sec: "A3", nome: "BRMill Alimentos — Fazenda São Miguel", mun: ["SILVANIA/GO"], km: 163.3, ev: "específica", nivel: "unidade", det: "Moinho de milho não-GMO, com produção própria", fonte: "brmill.com.br, consultado em 06/10/2026", site: "brmill.com.br", gmo: "restrição registrada nesta unidade (moinho não-GMO)", re: /BRMILL/ }),
  M({ id: "T01", sec: "B", nome: "Cargill Agro — Rio Verde", mun: ["RIO VERDE/GO"], km: 129.2, ev: "trader", nivel: "unidade", det: "CNAE 4632-0/01, comércio atacadista de cereais", fonte: "BrasilAPI 06/10/2026", cnpj: "53169389001301", cnpjVinculo: "cadastro oficial da própria unidade (Receita)", re: /CARGILL AGRO\b/ }),
  M({ id: "T02", sec: "B", nome: "Louis Dreyfus Company — Rio Verde e Itumbiara", mun: ["RIO VERDE/GO", "ITUMBIARA/GO"], km: 129.2, ev: "trader", nivel: "empresa", det: "Unidades listadas; 13 armazéns em GO", fonte: "site LDC; pili.ind.br", site: "ldc.com", re: /LOUIS DREYFUS/ }),
  M({ id: "T03", sec: "B", nome: "Bunge — armazéns em GO", mun: null, km: null, ev: "trader", nivel: "empresa", det: "12 armazéns em GO (unidades não localizadas)", fonte: "pili.ind.br", re: /BUNGE/ }),
  M({ id: "T04", sec: "B", nome: "Cereal Comércio Exportação — armazéns em GO", mun: null, km: null, ev: "trader", nivel: "empresa", det: "15 armazéns em GO (unidades não localizadas)", fonte: "pili.ind.br", re: /CEREAL COMERCIO/ }),
  M({ id: "T05", sec: "B", nome: "Gravos Comercialização de Grãos", mun: ["RIO VERDE/GO"], km: 129.2, ev: "trader", nivel: "empresa", det: "Comercialização e transporte de milho", fonte: "gravos.com.br, consultado em 06/10/2026", site: "gravos.com.br", canal: "comercial@gravos.com.br · (64) 99617-5105 (publicados no site; não validados)", re: /GRAVOS/ }),
];
const TRADER = /\b(ADM DO BRASIL|BUNGE|LOUIS DREYFUS|AMAGGI|COFCO|VITERRA|GAVILON|OLAM|CEREAL COMERCIO|GRAVOS)\b/;
const ANIMAL = /FRIGO|RECICLAGEM|SUBPRODUTO|SUB-PRODUTO|GRAXARIA|SEBO|CURTUME|PROTEINA ANIMAL|\bJBS\b|MINERVA|MARFRIG|ABATEDOURO/;

// 1. Registros MAPA → unidades (dedup só por CNPJ completo conferido pela máscara)
const units = new Map();
for (const e of act) {
  const cnpj = e.cnpjOk ? e.cnpj.replace(/\D/g, "") : null;
  const key = cnpj ?? `REG:${e.registro}`;
  const u = units.get(key) ?? { key, cnpj, mask: e.cnpjMascarado, registros: new Set(), razao: e.razao, uf: e.uf, municipio: e.municipio, km: e.km, classes: new Set(), possiveis: [], manual: null };
  u.registros.add(e.registro);
  e.classificacoes.split("+").forEach((c) => u.classes.add(c));
  units.set(key, u);
}
const roots = {};
for (const u of units.values()) if (u.cnpj) roots[u.cnpj.slice(0, 8)] = (roots[u.cnpj.slice(0, 8)] || 0) + 1;

// 2. Candidatas manuais: fusão só com o mesmo CNPJ completo; senão, linha própria com possíveis correspondências
for (const m of MANUAL) {
  m.possiveis = [];
  const same = m.cnpj && units.get(m.cnpj);
  if (same) { same.manual = m; m.fundida = same.key; continue; }
  for (const u of units.values()) {
    const um = `${N(u.municipio)}/${u.uf}`;
    if (m.re.test(N(u.razao)) && (!m.mun || m.mun.includes(um))) {
      m.possiveis.push(`${[...u.registros].join("+")} ${u.cnpj ? fmt(u.cnpj) : "CNPJ a conciliar"} (${u.municipio}/${u.uf})`);
      u.possiveis.push(`${m.id} ${m.nome}`);
    }
  }
}

const porteDe = (raw) => !raw ? "não consultado" : /MICRO/.test(N(raw)) ? "ME (micro)" : /PEQUENO|EPP/.test(N(raw)) ? "EPP (pequena)" : "Demais (não indica média nem grande)";
const evLabel = (m) => m.ev === "específica" ? `específica, nível ${m.nivel}` : m.ev === "indício" ? "indício por atividade (fonte não cita milho)" : m.ev === "histórica" ? "histórica: fonte antiga não comprova operação atual" : m.ev;
const rows = [];
for (const u of units.values()) {
  const n = N(u.razao), cls = [...u.classes], r = (u.cnpj && api.get(u.cnpj)) || {}, m = u.manual;
  const feed = cls.some((c) => /RAÇÃO|CONCENTRADO|ALIMENTO/.test(c));
  const papel = m?.sec === "B" || TRADER.test(n) ? "trader/originadora" :
    ANIMAL.test(n) && !feed ? "excluída: subproduto de origem animal" :
    !feed && !cls.some((c) => /INGREDIENTE|COPRODUTO/.test(c)) ? "baixa aderência: só suplemento/núcleo/premix/aditivo" :
    "consumidora/processadora potencial";
  const raiz = u.cnpj ? u.cnpj.slice(0, 8) : null;
  rows.push({
    origem: m ? `MAPA + pesquisa manual ${m.id} (mesmo CNPJ completo)` : "MAPA", papel,
    nome: m?.nome ?? r.fantasia ?? "", razao: u.razao, cnpj: u.cnpj ? fmt(u.cnpj) : `a conciliar (máscara ${u.mask})`,
    cnpjVinculo: u.cnpj ? `registro MAPA (CNPJ da lista oficial conferido pela máscara do CSV)${m ? `; ${m.cnpjVinculo}` : ""}` : "sem CNPJ conferido",
    tipo: r.tipo ? r.tipo.toLowerCase() : "não consultado",
    municipio: `${u.municipio}/${u.uf}`, km: m?.kmPrec ? m.km : u.km,
    precisao: m?.kmPrec ?? "estimada: centroide do município (sem coordenada da unidade)",
    conferirDistancia: (m?.kmPrec ? m.km : u.km) >= 270 && !m?.kmPrec ? "sim: perto de 300 km, conferir endereço da unidade" : "",
    atividade: cls.join("+") + (/MILHO|MILHAO/.test(n) ? " · milho no nome" : /BIOENERG|ALCOOL|ACUCAR|USINA|DESTILARIA|ETANOL/.test(n) ? " · usina/bioenergia" : ""),
    cnae: r.cnae ?? "não consultado", porte: porteDe(r.porte),
    raiz: !u.cnpj ? "—" : roots[raiz] > 1 ? `${roots[raiz]} estabelecimentos da raiz ${raiz} no raio (mesma pessoa jurídica)` : `único estabelecimento da raiz ${raiz} no raio`,
    grupoEco: m?.grupoEco ?? NP,
    situacao: `MAPA: ativo; Receita: ${r.situacao ? N(r.situacao).toLowerCase() : "não consultada"}`,
    evidencia: m ? evLabel(m) : "nenhuma específica: o registro no MAPA indica a atividade, não prova compra de milho",
    evidenciaTexto: m ? `${m.det} [${m.fonte}]` : "",
    gmo: m?.gmo ?? "a confirmar", site: m?.site ?? NP, canal: m?.canal ?? NP,
    possivel: u.possiveis.length ? `possível correspondência com ${u.possiveis.join("; ")} — a conciliar` : "",
    registros: [...u.registros].join(", "), fonte: SIPE,
    alerta: [m?.alerta ?? "", r.municipio && N(r.municipio.split("/")[0]) !== N(u.municipio) ? "município da Receita difere do município do registro MAPA" : "", r.situacao && !/^ATIVA$/.test(N(r.situacao)) ? `Receita: ${N(r.situacao).toLowerCase()} (MAPA mostra ativo)` : ""].filter(Boolean).join("; "),
    sec: m?.sec ?? null, ev: m?.ev ?? null, mid: m?.id ?? null,
  });
}
for (const m of MANUAL.filter((x) => !x.fundida)) {
  const r = (m.cnpj && api.get(m.cnpj)) || {};
  rows.push({
    origem: `pesquisa manual ${m.id}`,
    papel: m.sec === "B" ? "trader/originadora" : m.sec === "A2" ? "projeto (consumo futuro)" : "consumidora/processadora potencial",
    nome: m.nome, razao: r.razao ?? "não encontrada", cnpj: m.cnpj ? fmt(m.cnpj) : "não encontrado",
    cnpjVinculo: m.cnpj ? m.cnpjVinculo : "—", tipo: r.tipo ? r.tipo.toLowerCase() : m.cnpj ? "ver ficha" : "—",
    municipio: m.mun ? m.mun.map((x) => MUN.get(x) ?? x).join("; ") : "localização pendente",
    km: m.km ?? "", precisao: m.kmPrec ?? (m.km ? "estimada: centroide do município (sem coordenada da unidade)" : "sem localização"),
    conferirDistancia: m.km >= 270 && !m.kmPrec ? "sim: perto de 300 km, conferir endereço da unidade" : "",
    atividade: m.det, cnae: r.cnae ?? (m.rf ? m.rf : "não consultado"), porte: m.rf ? "Demais (não indica média nem grande)" : porteDe(r.porte),
    raiz: "—", grupoEco: m.grupoEco ?? NP,
    situacao: m.rf ? `Receita: ${m.rf.split(";")[0]}` : r.situacao ? `Receita: ${N(r.situacao).toLowerCase()}` : "não consultada",
    evidencia: evLabel(m), evidenciaTexto: `${m.det} [${m.fonte}]`, gmo: m.gmo ?? (m.sec === "B" ? "—" : "a confirmar"),
    site: m.site ?? NP, canal: m.canal ?? NP,
    possivel: [m.sugestao ? `CNPJ sugerido: ${m.sugestao}` : "", m.possiveis.length ? `possível correspondência com registro MAPA ${m.possiveis.join("; ")} — a conciliar` : "nenhum registro MAPA sugerido"].filter(Boolean).join(" · "),
    registros: "", fonte: m.fonte, alerta: m.alerta ?? "", sec: m.sec, ev: m.ev, mid: m.id,
  });
}
const pap = (p) => (p.startsWith("consumidora") ? 0 : p.startsWith("projeto") ? 1 : p.startsWith("trader") ? 2 : p.startsWith("baixa") ? 3 : 4);
const evr = (x) => (x.ev === "específica" ? 0 : x.ev === "indício" ? 1 : 2);
rows.sort((a, b) => pap(a.papel) - pap(b.papel) || evr(a) - evr(b) || (a.km || 999) - (b.km || 999));
const head = ["Origem", "Papel", "Empresa — unidade (nome)", "Razão social", "CNPJ da unidade", "Base do CNPJ", "Matriz/filial", "Município da unidade", "Distância km", "Precisão da distância", "Conferir distância", "Atividade", "CNAE principal (Receita)", "Porte cadastral", "Raiz de CNPJ", "Grupo econômico", "Situação operacional", "Evidência de milho", "Detalhe e fonte da evidência", "Milho GMO", "Possível correspondência (a conciliar)", "Site", "Canal profissional público", "Decisor (cargo)", "Influenciador", "LinkedIn", "Registros MAPA", "Alerta", "Fonte do cadastro"];
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(`${outDir}/candidatas.csv`, "﻿" + [head, ...rows.map((x) => [x.origem, x.papel, x.nome || "não encontrado", x.razao, x.cnpj, x.cnpjVinculo, x.tipo, x.municipio, String(x.km).replace(".", ","), x.precisao, x.conferirDistancia, x.atividade, x.cnae, x.porte, x.raiz, x.grupoEco, x.situacao, x.evidencia, x.evidenciaTexto, x.gmo, x.possivel, x.site, x.canal, NP, NP, NP, x.registros, x.alerta, x.fonte])].map((l) => l.map(q).join(";")).join("\n") + "\n");
writeFileSync(`${dir}/rows.json`, JSON.stringify(rows, null, 1));
const c = (f) => rows.filter(f).length;
const espec = MANUAL.filter((m) => m.ev === "específica");
console.log(JSON.stringify({
  linhasNoArquivoFinal: rows.length,
  unidadesMapa: units.size, mapaCnpjConferido: [...units.values()].filter((u) => u.cnpj).length, mapaSemCnpj: [...units.values()].filter((u) => !u.cnpj).length,
  manuais: MANUAL.length, manuaisFundidasPorCnpj: MANUAL.filter((m) => m.fundida).map((m) => m.id),
  manuaisSeparadas: MANUAL.filter((m) => !m.fundida).length,
  manuaisComSugestao: MANUAL.filter((m) => !m.fundida && m.possiveis.length).map((m) => `${m.id}:${m.possiveis.length}`),
  registrosMapaComSugestao: [...units.values()].filter((u) => u.possiveis.length).length,
  evidenciaEspecifica: { total: espec.length, unidadeComCnpjInequivoco: espec.filter((m) => m.cnpj).map((m) => m.id), nivelUnidadeSemCnpj: espec.filter((m) => !m.cnpj && m.nivel === "unidade").map((m) => m.id), nivelEmpresa: espec.filter((m) => m.nivel === "empresa").map((m) => m.id) },
  porPapel: rows.reduce((a, x) => ((a[x.papel] = (a[x.papel] || 0) + 1), a), {}),
}, null, 1));
