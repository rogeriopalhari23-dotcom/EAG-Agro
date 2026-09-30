// Assinatura de Rogério nos e-mails do Compass (2026-09-30). O servidor SMTP da Hostinger NÃO acrescenta a assinatura do
// webmail (teste interno de 30/09: nada depois do texto do Compass), então o Compass envia a assinatura uma única vez.
// Dados exatos informados por Rogério em 30/09. O HTML deve ser o ORIGINAL da assinatura da Hostinger (logo, cores,
// links, bandeiras e aviso de confidencialidade), importado sem redesenho; até lá o status fica "pending_import" e o
// revisor impede a aprovação da ficha. Depois da importação, só a conferência visual de Rogério libera ("confirmed").
// Rodapé separado: endereço físico (R19.13) e descadastro (R21.7) — nunca misturados com a assinatura.
export const SIGNATURE = {
  version: "sig-eag-0.1.0",
  status: "pending_import", // pending_import | imported_pending_visual | confirmed
  text: ["Rogerio Palhari", "Broker | EAG AGRO", "+55 66 99226-9615", "rogeriopalhari@eagagro.com", "www.eagagro.com"],
  html: null, // HTML original da assinatura da Hostinger (importado; nunca redesenhado)
  source: null, // de onde o HTML foi importado e quando
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

// Texto: corpo, assinatura (texto) e rodapé separado por uma linha.
export function signatureText(sig = SIGNATURE) {
  return sig.text.join("\n");
}

// HTML do e-mail: corpo em parágrafos, assinatura original (uma vez) e rodapé pequeno e separado.
export function renderHtml({ bodyText, footerLines, sig = SIGNATURE }) {
  if (!sig.html) return null;
  const paragraphs = bodyText.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px 0">${p.split("\n").map(esc).join("<br>")}</p>`).join("\n");
  const footer = footerLines.map(linkify).join("<br>");
  return `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">
${paragraphs}
<div>${sig.html}</div>
<div style="margin-top:16px;padding-top:8px;border-top:1px solid #ddd;font-size:11px;color:#777">${footer}</div>
</body></html>`;
}
