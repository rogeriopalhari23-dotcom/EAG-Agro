# Ponte de e-mail do EAG Compass — cria a chave compartilhada ponte ↔ Compass (BRIDGE_HMAC_KEY) sem exibi-la:
# 32 bytes aleatórios, guardados cifrados (DPAPI, conta atual) e enviados ao Worker por "wrangler secret put" pela entrada
# padrão. Rodar de novo troca a chave nos dois lados (a ponte precisa ser reiniciada depois).
# Uso: powershell -ExecutionPolicy Bypass -File bridge\deploy\windows\configurar-chave-compass.ps1
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
New-Item -ItemType Directory -Force $dir | Out-Null
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$chave = [Convert]::ToBase64String($bytes)
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Push-Location $raiz
try {
  # Avisos do wrangler saem no stderr; só o código de saída decide.
  $ErrorActionPreference = "Continue"
  $saida = $chave | & npx.cmd wrangler secret put BRIDGE_HMAC_KEY 2>&1 | ForEach-Object { "$_" }
  $ok = $LASTEXITCODE -eq 0
  $ErrorActionPreference = "Stop"
  if (-not $ok) { throw "wrangler secret put falhou: $($saida | Select-Object -Last 3)" }
} finally { Pop-Location }
$arquivo = Join-Path $dir "segredos.json"
$atuais = @{}
if (Test-Path $arquivo) { (Get-Content $arquivo -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $atuais[$_.Name] = $_.Value } }
$atuais["BRIDGE_HMAC_KEY"] = (ConvertTo-SecureString $chave -AsPlainText -Force) | ConvertFrom-SecureString
$atuais | ConvertTo-Json | Set-Content -Encoding utf8 $arquivo
Remove-Variable chave, bytes
Write-Host "Chave BRIDGE_HMAC_KEY criada: gravada no Worker (secret) e guardada cifrada em $arquivo. Valor não exibido."
