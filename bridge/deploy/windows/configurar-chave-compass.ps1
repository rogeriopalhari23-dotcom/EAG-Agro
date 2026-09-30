# Ponte de e-mail do EAG Compass — cria a chave compartilhada ponte ↔ Compass (BRIDGE_HMAC_KEY) sem exibi-la:
# 32 bytes aleatórios, guardados cifrados (DPAPI, conta atual) e enviados ao Worker por "wrangler secret put" pela entrada
# padrão. Rodar de novo troca a chave nos dois lados (a ponte precisa ser reiniciada depois).
# Uso: powershell -ExecutionPolicy Bypass -File bridge\deploy\windows\configurar-chave-compass.ps1
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
New-Item -ItemType Directory -Force $dir | Out-Null
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
# Hexadecimal: só 0-9 e a-f, nada que um pipe ou shell reescreva (em base64, um "+" chegou ao Worker como espaço).
$chave = -join ($bytes | ForEach-Object { $_.ToString("x2") })
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Push-Location $raiz
try {
  # O pipe do PowerShell 5.1 para programas externos altera o texto (codificação e quebra de linha) — a chave chegava
  # inválida ao Worker. O Node repassa ao wrangler exatamente os bytes da chave, recebida só pela variável deste processo.
  $env:EAG_CHAVE_NOVA = $chave
  $ErrorActionPreference = "Continue"
  $saida = & node -e "const r=require('child_process').spawnSync('npx wrangler secret put BRIDGE_HMAC_KEY',{input:process.env.EAG_CHAVE_NOVA,shell:true,encoding:'utf8'});process.stdout.write((r.stdout||'').slice(-300)+(r.stderr||'').slice(-300));process.exit(r.status??1)" 2>&1 | ForEach-Object { "$_" }
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = "Stop"
  if (-not $ok) { throw "wrangler secret put falhou: $($saida | Select-Object -Last 3)" }
} finally {
  Remove-Item Env:EAG_CHAVE_NOVA -ErrorAction SilentlyContinue
  Pop-Location
}
$arquivo = Join-Path $dir "segredos.json"
$atuais = @{}
if (Test-Path $arquivo) { (Get-Content $arquivo -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $atuais[$_.Name] = $_.Value } }
$atuais["BRIDGE_HMAC_KEY"] = (ConvertTo-SecureString $chave -AsPlainText -Force) | ConvertFrom-SecureString
$atuais | ConvertTo-Json | Set-Content -Encoding utf8 $arquivo
Remove-Variable chave, bytes
Write-Host "Chave BRIDGE_HMAC_KEY criada: gravada no Worker (secret) e guardada cifrada em $arquivo. Valor não exibido."
