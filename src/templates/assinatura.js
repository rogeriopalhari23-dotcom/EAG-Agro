// Assinatura de Rogério nos e-mails do Compass — fonte única, usada pelos modelos de identificação e de reunião e pelo
// envio real. O SMTP da Hostinger NÃO acrescenta a assinatura do webmail (teste interno de 30/09), então o Compass envia
// a assinatura uma única vez. HTML fornecido por Rogério em 30/09/2026 (layout, cores, cargo, bandeiras, links e aviso de
// confidencialidade preservados). O logo original tinha URL "blob:" temporária: o marcador LOGO_EAG_HTTPS só pode ser
// trocado pela URL HTTPS estável do arquivo ORIGINAL (sem redesenho); enquanto houver marcador, nada é aprovado nem enviado.
// Rodapé separado: endereço físico (R19.13) e descadastro (R21.7) — nunca dentro da assinatura.
export const LOGO_PLACEHOLDER = "LOGO_EAG_HTTPS";
// Logo original (Desktop\EAG Agro\Logotipo EAG AGRO.png, PNG 150×150, sha256 9f20a474…030d5), servido sem login pelo Worker
// estático assinatura-publica/ (fora do Access do Compass). Exibido a 128×128 como no HTML original (mesma proporção).
const LOGO_URL = "https://eag-assinatura.rogeriopalhari23.workers.dev/assinatura/logo-eag-agro.png";
const VISUAL_CONFIRMED_AT = "2026-09-30"; // conferência visual de Rogério (teste interno recebido)

const CONFIDENTIALITY =
  "The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.";

const HTML_TEMPLATE = `<table cellpadding="0" cellspacing="0" border="0"
       style="font-family: Arial, sans-serif; font-size: 9pt; color: #000; line-height: 1.4; width: 100%; max-width: 600px;">
  <tbody>
    <tr>
      <td style="padding: 10px; text-align: center; width: 100px;">
        <img src="${LOGO_PLACEHOLDER}"
             alt="EAG Agro"
             width="128"
             height="128"
             style="display: block; border: 0;" />
      </td>
      <td style="padding: 10px 20px;">
        <p style="margin: 0; font-size: 10pt; font-weight: bold; color: #000;">
          Rogerio Palhari
        </p>
        <p style="margin: 0; font-size: 9pt; color: #555;">
          Broker | EAG AGRO
        </p>

        <hr style="border: 0; border-top: 1px solid #999; margin: 8px 0; width: 100%;" />

        <p style="margin: 8px 0; font-size: 9pt;">
          <img src="https://img.icons8.com/ios-filled/16/808080/phone.png"
               alt="" width="14" height="14"
               style="vertical-align: middle; border: 0;" />
          <a href="tel:+5566992269615"
             style="color: #000; text-decoration: none;">
            +55 66 99226-9615
          </a>
          <br />

          <img src="https://img.icons8.com/ios-filled/16/808080/new-post.png"
               alt="" width="12" height="12"
               style="vertical-align: middle; border: 0;" />
          <a href="mailto:rogeriopalhari@eagagro.com"
             style="color: #000; text-decoration: none;">
            rogeriopalhari@eagagro.com
          </a>
          <br />

          <img src="https://img.icons8.com/ios-filled/16/808080/domain.png"
               alt="" width="14" height="14"
               style="vertical-align: middle; border: 0;" />
          <a href="https://eagagro.com/"
             style="color: #000; font-weight: bold;">
            www.eagagro.com
          </a>
        </p>

        <p style="margin: 8px 0;">
          <a href="https://eagagro.com/" rel="noopener">
            <img src="https://flagcdn.com/w20/br.png"
                 alt="Brasil" width="20"
                 style="border: 0;" />
          </a>
          &nbsp;
          <a href="https://eagagro.com/" rel="noopener">
            <img src="https://flagcdn.com/w20/us.png"
                 alt="EUA" width="26" height="14"
                 style="border: 0;" />
          </a>
        </p>
      </td>
    </tr>
  </tbody>
</table>

<p style="color: #888888; font-size: 10px; font-family: Arial, sans-serif; background-color: #ffffff;">
  ${CONFIDENTIALITY}
</p>`;

export const SIGNATURE = {
  version: "sig-eag-1.0.0",
  // pending_logo (marcador pendente) → imported_pending_visual (logo resolvido, aguardando conferência) → confirmed
  // Conferência visual de Rogério: e-mail de teste interno recebido no Gmail e confirmado "visualmente correto" em 2026-09-30.
  // Trocar o HTML, o texto ou o logo exige nova versão (sig-eag-x.y.z) e nova conferência antes de voltar a confirmed.
  status: !LOGO_URL ? "pending_logo" : VISUAL_CONFIRMED_AT ? "confirmed" : "imported_pending_visual",
  visualConfirmedAt: VISUAL_CONFIRMED_AT,
  // Equivalente em texto simples para clientes sem HTML (mesmos dados, mesmo aviso).
  text: ["Rogerio Palhari", "Broker | EAG AGRO", "+55 66 99226-9615", "rogeriopalhari@eagagro.com", "www.eagagro.com", "", CONFIDENTIALITY],
  html: LOGO_URL ? HTML_TEMPLATE.replace(LOGO_PLACEHOLDER, LOGO_URL) : HTML_TEMPLATE,
  source: "HTML fornecido por Rogério em 2026-09-30 (assinatura da Hostinger); logo original em URL HTTPS estável; conferida visualmente por Rogério em 2026-09-30",
};

// Assinatura pronta para envio: sem marcador pendente e conferida por Rogério.
export const signatureReady = (sig = SIGNATURE) => sig.status === "confirmed" && !!sig.html && !sig.html.includes(LOGO_PLACEHOLDER);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

export function signatureText(sig = SIGNATURE) {
  return sig.text.join("\n");
}

// HTML do e-mail: corpo em parágrafos, assinatura (uma vez) e rodapé pequeno e separado; legível em celular (max-width).
export function renderHtml({ bodyText, footerLines, sig = SIGNATURE }) {
  if (!sig.html) return null;
  const paragraphs = bodyText.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px 0">${p.split("\n").map(esc).join("<br>")}</p>`).join("\n");
  const footer = footerLines.map(linkify).join("<br>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#222">
<div style="max-width:600px">
${paragraphs}
<div style="margin-top:8px">${sig.html}</div>
<div style="margin-top:16px;padding-top:8px;border-top:1px solid #ddd;font-size:11px;color:#777">${footer}</div>
</div>
</body></html>`;
}

// Partes de um e-mail do Compass: corpo + assinatura (uma vez) + rodapé separado (endereço e descadastro).
export function emailParts(bodyText, footerLines, sig = SIGNATURE) {
  return {
    body: [bodyText, "", signatureText(sig), "", "—", ...footerLines].join("\n"),
    html: renderHtml({ bodyText, footerLines, sig }),
  };
}
