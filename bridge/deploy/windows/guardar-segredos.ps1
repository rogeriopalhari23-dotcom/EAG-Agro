# Ponte de e-mail do EAG Compass — guarda os segredos cifrados com a SUA conta do Windows (DPAPI).
# Só esta conta, neste computador, consegue decifrar. Nada é exibido, nada vai para o Git nem para o chat.
# Uso (PowerShell):  powershell -ExecutionPolicy Bypass -File bridge\deploy\windows\guardar-segredos.ps1
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
New-Item -ItemType Directory -Force $dir | Out-Null
$arquivo = Join-Path $dir "segredos.json"
$atuais = @{}
if (Test-Path $arquivo) { (Get-Content $arquivo -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $atuais[$_.Name] = $_.Value } }
foreach ($nome in "MAILBOX_PASSWORD", "BRIDGE_HMAC_KEY", "ACCESS_CLIENT_SECRET") {
  $valor = Read-Host -AsSecureString "$nome (não aparece na tela; Enter vazio mantém o atual)"
  if ($valor.Length -gt 0) { $atuais[$nome] = $valor | ConvertFrom-SecureString }
}
$atuais | ConvertTo-Json | Set-Content -Encoding utf8 $arquivo
Write-Host "Segredos guardados em $arquivo (cifrados para a conta $env:USERNAME)."
