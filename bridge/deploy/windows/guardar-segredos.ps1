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
# Os três valores são digitados (ou colados) sem aparecer na tela e ficam cifrados; o Client ID também, a pedido de Rogério.
foreach ($nome in "MAILBOX_PASSWORD", "ACCESS_CLIENT_ID", "ACCESS_CLIENT_SECRET") {
  $rotulo = @{ MAILBOX_PASSWORD = "Senha da caixa rogeriopalhari@eagagro.com"; ACCESS_CLIENT_ID = "Client ID do token de serviço (termina em .access)"; ACCESS_CLIENT_SECRET = "Client Secret do token de serviço" }[$nome]
  $valor = Read-Host -AsSecureString "$rotulo — não aparece na tela; Enter vazio mantém o atual"
  if ($valor.Length -gt 0) {
    # O painel mostra "CF-Access-Client-Id: …" / "CF-Access-Client-Secret: …": aceita colar a linha inteira ou só o valor.
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($valor)
    try { $texto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
    if ($nome -ne "MAILBOX_PASSWORD") { $texto = ($texto -replace "^\s*CF-Access-Client-(Id|Secret)\s*:\s*", "").Trim() }
    $atuais[$nome] = (ConvertTo-SecureString $texto -AsPlainText -Force) | ConvertFrom-SecureString
    Remove-Variable texto
  }
}
$atuais | ConvertTo-Json | Set-Content -Encoding utf8 $arquivo
# Conferência sem exibir valores: o Client ID precisa terminar em ".access".
if ($atuais.ACCESS_CLIENT_ID) {
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(($atuais.ACCESS_CLIENT_ID | ConvertTo-SecureString))
  try { $okId = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)).Trim().EndsWith(".access") } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
  if (-not $okId) { Write-Host "ATENÇÃO: o Client ID guardado não termina em .access — confira e rode este script de novo." }
}
# A configuração existente é preservada; um Client ID antigo em texto (versão anterior deste script) sai dela.
$config = Join-Path $dir "config.json"
if (Test-Path $config) {
  $cfg = @{}
  (Get-Content $config -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { if ($_.Name -ne "ACCESS_CLIENT_ID") { $cfg[$_.Name] = $_.Value } }
  $cfg | ConvertTo-Json | Set-Content -Encoding utf8 $config
}
Write-Host ("Guardado em $dir, cifrado para a conta $env:USERNAME: " + (($atuais.Keys | Sort-Object) -join ", ") + ". Valores não exibidos.")
