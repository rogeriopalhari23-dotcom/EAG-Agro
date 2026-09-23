import { readFile, writeFile, rename } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const target = new URL("../.dev.vars.local", import.meta.url);
async function readOptional(url) {
  try {
    return await readFile(url, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return "";
  }
}
const generic = await readOptional(new URL("../.dev.vars", import.meta.url));
let source = await readOptional(target);
function existing(text, key) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^[ \t]*${key}[ \t]*=`).test(line));
  if (lines.length > 1)
    throw new Error(
      `Definição duplicada de ${key}; corrija o arquivo sem trocar as chaves.`,
    );
  if (!lines.length) return null;
  const raw = lines[0].slice(lines[0].indexOf("=") + 1).trim();
  if (!raw || raw === '""' || raw === "''") return null;
  const match = raw.match(/^(['"]?)([A-Za-z0-9+/]+={0,2})\1(?:\s+#.*)?$/);
  if (
    !match ||
    Buffer.from(match[2], "base64").length !== 32 ||
    Buffer.from(match[2], "base64").toString("base64") !== match[2]
  )
    throw new Error(
      `${key} inválida. Recupere a chave correta antes de continuar; nada foi gravado.`,
    );
  return match[2];
}
for (const key of ["PII_ENCRYPTION_KEY", "SUPPRESSION_HMAC_KEY"]) {
  const value =
    existing(source, key) ||
    existing(generic, key) ||
    randomBytes(32).toString("base64");
  const matcher = new RegExp(`^[ \t]*${key}[ \t]*=.*$`, "m");
  if (matcher.test(source)) source = source.replace(matcher, `${key}=${value}`);
  else source += `\n${key}=${value}\n`;
}
const previous = await readOptional(target);
if (source !== previous) {
  const temporary = new URL(
    `../.dev.vars.local.${randomBytes(6).toString("hex")}`,
    import.meta.url,
  );
  await writeFile(temporary, source, { mode: 0o600, flag: "wx" });
  await rename(temporary, target);
}
console.log(
  "Configuração local pronta; chaves existentes preservadas. Faça backup privado do arquivo.",
);
