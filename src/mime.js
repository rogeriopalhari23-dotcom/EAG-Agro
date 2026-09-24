// Leitor MIME mínimo para classificar respostas (P2-T11): cabeçalhos (RFC 5322, com dobra), primeira parte text/plain
// decodificada (quoted-printable/base64; utf-8/latin1) e campos do relatório de entrega (RFC 3464). Sem dependências.
const latin1 = new TextDecoder("latin1");
const decoders = new Map();
function decode(bytes, charset = "utf-8") {
  const cs = String(charset || "utf-8").toLowerCase().replace(/^"|"$/g, "");
  try {
    if (!decoders.has(cs)) decoders.set(cs, new TextDecoder(cs));
    return decoders.get(cs).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
const toBytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

export function parseHeaders(block) {
  const headers = new Map();
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = decodeWords(line.slice(i + 1).trim());
    headers.set(k, [...(headers.get(k) || []), v]);
  }
  return headers;
}
// RFC 2047 (=?utf-8?B?...?= / =?iso-8859-1?Q?...?=) em assunto e remetente.
function decodeWords(v) {
  return v.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs, enc, text) => {
    const bytes = enc.toUpperCase() === "B" ? toBytes(atob(text)) : toBytes(qp(text.replace(/_/g, " ")));
    return decode(bytes, cs);
  });
}
function qp(s) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function param(value, name) {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, "i").exec(value || "");
  return m ? (m[2] ?? m[1]) : null;
}
function split(raw) {
  const i = raw.search(/\r?\n\r?\n/);
  return i < 0 ? [raw, ""] : [raw.slice(0, i), raw.slice(i).replace(/^\r?\n\r?\n/, "")];
}
function bodyText(headers, body) {
  const enc = (headers.get("content-transfer-encoding")?.[0] || "").toLowerCase();
  const charset = param(headers.get("content-type")?.[0], "charset") || "utf-8";
  let bytes;
  if (enc === "base64") {
    try {
      bytes = toBytes(atob(body.replace(/\s+/g, "")));
    } catch {
      bytes = toBytes(body);
    }
  } else bytes = toBytes(enc === "quoted-printable" ? qp(body) : body);
  return decode(bytes, charset);
}

// raw: bytes (Uint8Array) ou texto binário. Devolve o que a classificação precisa; nada é persistido aqui.
export function parseMessage(raw) {
  const text = typeof raw === "string" ? raw : latin1.decode(raw);
  const [head, body] = split(text);
  const headers = parseHeaders(head);
  const ct = headers.get("content-type")?.[0] || "text/plain";
  const out = { headers, contentType: ct.split(";")[0].trim().toLowerCase(), text: "", report: null };
  const walk = (hdrs, content, depth = 0) => {
    const type = (hdrs.get("content-type")?.[0] || "text/plain").toLowerCase();
    if (type.startsWith("multipart/") && depth < 4) {
      const boundary = param(hdrs.get("content-type")[0], "boundary");
      if (!boundary) return;
      for (const part of content.split(`--${boundary}`).slice(1)) {
        if (part.startsWith("--")) break;
        const [h, b] = split(part.replace(/^\r?\n/, ""));
        walk(parseHeaders(h), b, depth + 1);
      }
      return;
    }
    if (type.startsWith("message/delivery-status")) {
      const fields = parseHeaders(content.replace(/\r?\n\r?\n/g, "\n"));
      const recipient = (fields.get("final-recipient")?.[0] || fields.get("original-recipient")?.[0] || "").split(";").pop().trim();
      out.report = { finalRecipient: recipient || null, status: (fields.get("status")?.[0] || "").trim() || null };
      return;
    }
    if (!out.text && type.startsWith("text/plain")) out.text = bodyText(hdrs, content);
    else if (!out.text && type.startsWith("text/html")) out.text = bodyText(hdrs, content).replace(/<[^>]+>/g, " ");
  };
  walk(headers, body);
  return out;
}

export const header = (msg, name) => msg.headers.get(name.toLowerCase())?.[0] ?? null;
export function addressOf(value) {
  const m = /<([^>]+)>/.exec(value || "") || /([^\s<>"]+@[^\s<>"]+)/.exec(value || "");
  return m ? m[1].trim().toLowerCase() : null;
}
export function messageIds(value) {
  return [...String(value || "").matchAll(/<[^<>\s]+>/g)].map((m) => m[0]);
}
