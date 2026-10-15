// Idioma pelo país do destinatário (Spec R28.20, decisão de Rogério em 2026-10-14). Determinístico: o país vem do código
// ISO registrado, nunca do nome da pessoa, do domínio do e-mail, do telefone ou do fuso.
//  - Brasil: português.
//  - Demais países da América Latina: espanhol. Até a decisão L1, só os de língua oficial espanhola (abaixo).
//  - Fora da América Latina: inglês (inclui Portugal, os lusófonos fora da América Latina e a Alemanha: L2 e L3,
//    decididas em 2026-10-14).
// L1 (PENDENTE, não decidida): casos geográficos de dúvida da região ficam sem idioma, e a ficha não é gerada.
// L4 (PENDENTE, não decidida): a origem do país é, por ora, o país da empresa cadastrada (regra vigente até a decisão).
// Vale só para a ficha de identificação; textos de reunião seguem o idioma da campanha (fora deste escopo).

export const SPANISH_LATAM = new Set(["AR", "BO", "CL", "CO", "CR", "CU", "SV", "EC", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "DO", "UY", "VE"]);
// L1 pendente: Porto Rico, Haiti, Belize, Guianas, Suriname, territórios franceses e Caribe não hispânico, Malvinas.
export const L1_PENDING = new Set([
  "PR", "HT", "BZ", "GY", "SR", "GF", "GP", "MQ", "BL", "MF", "JM", "TT", "BS", "BB", "AG", "DM", "GD", "KN", "LC", "VC",
  "AW", "CW", "SX", "BQ", "KY", "TC", "VG", "VI", "AI", "MS", "FK",
]);

// { language } ou { language: null, reason } — sem idioma, nada é gerado (sem troca para outro idioma).
export function languageForCountry(countryCode) {
  const c = String(countryCode ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return { language: null, reason: "country_missing" };
  if (c === "BR") return { language: "pt-BR" };
  if (SPANISH_LATAM.has(c)) return { language: "es" };
  if (L1_PENDING.has(c)) return { language: null, reason: "l1_pending" };
  return { language: "en" };
}
