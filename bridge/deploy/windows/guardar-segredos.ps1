# Ponte de e-mail do EAG Compass — guarda a senha da caixa e o token de serviço do Access, cifrados com a SUA conta do
# Windows (DPAPI): só esta conta, neste computador, consegue decifrar. Nada é exibido, nada vai para o Git nem para o chat.
# A chave compartilhada com o Compass (BRIDGE_HMAC_KEY) é criada por configurar-chave-compass.ps1, sem digitação.
# Uso (PowerShell):  powershell -ExecutionPolicy Bypass -File bridge\deploy\windows\guardar-segredos.ps1
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
New-Item -ItemType Directory -Force $dir | Out-Null
$arquivo = Join-Path $dir "segredos.json"
$atuais = @{}
if (Test-Path $arquivo) { (Get-Content $arquivo -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $atuais[$_.Name] = $_.Value } }
foreach ($nome in "MAILBOX_PASSWORD", "ACCESS_CLIENT_SECRET") {
  $rotulo = @{ MAILBOX_PASSWORD = "Senha da caixa rogeriopalhari@eagagro.com"; ACCESS_CLIENT_SECRET = "Client Secret do token de serviço (Cloudflare Zero Trust)" }[$nome]
  $valor = Read-Host -AsSecureString "$rotulo — não aparece na tela; Enter vazio mantém o atual"
  if ($valor.Length -gt 0) { $atuais[$nome] = $valor | ConvertFrom-SecureString }
}
$atuais | ConvertTo-Json | Set-Content -Encoding utf8 $arquivo
# Client ID não é segredo (identifica o token); fica na configuração.
$config = Join-Path $dir "config.json"
$cfg = @{ COMPASS_URL = "https://eag-compass-production.rogeriopalhari23.workers.dev"; MAILBOX_USER = "rogeriopalhari@eagagro.com"; ACCESS_CLIENT_ID = ""; SMTP_PORT = "465" }
if (Test-Path $config) { (Get-Content $config -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value } }
$id = Read-Host "Client ID do token de serviço (termina em .access; Enter vazio mantém o atual)"
if ($id) { $cfg.ACCESS_CLIENT_ID = $id.Trim() }
$cfg | ConvertTo-Json | Set-Content -Encoding utf8 $config
Write-Host "Guardado em $dir (segredos cifrados para a conta $env:USERNAME)."
