# Ponte de e-mail do EAG Compass — inicia no seu computador.
# Lê a configuração de %LOCALAPPDATA%\eag-mail-bridge\config.json e os segredos cifrados (guardar-segredos.ps1);
# os segredos ficam só nas variáveis deste processo e do processo da ponte.
# Uso:
#   iniciar-ponte.ps1 -SoCaixa    confere IMAP e login SMTP da Hostinger (não envia, não lê mensagens)
#   iniciar-ponte.ps1 -Conferir   confere também o Compass (token de serviço e assinatura)
#   iniciar-ponte.ps1             laço contínuo (um ciclo por minuto) — é o que a tarefa agendada executa
param([switch]$SoCaixa, [switch]$Conferir, [switch]$UmCiclo)
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
$raiz = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$config = Join-Path $dir "config.json"
if (-not (Test-Path $config)) {
  @{ COMPASS_URL = "https://eag-compass-production.rogeriopalhari23.workers.dev"; MAILBOX_USER = "rogeriopalhari@eagagro.com"; ACCESS_CLIENT_ID = ""; SMTP_PORT = "465" } |
    ConvertTo-Json | Set-Content -Encoding utf8 $config
  Write-Host "Configuração criada em $config (confira ACCESS_CLIENT_ID quando o token de serviço existir)."
}
(Get-Content $config -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { if ($_.Value) { Set-Item -Path "Env:$($_.Name)" -Value $_.Value } }
$segredos = Join-Path $dir "segredos.json"
if (Test-Path $segredos) {
  (Get-Content $segredos -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object {
    $seguro = $_.Value | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
    try { Set-Item -Path "Env:$($_.Name)" -Value ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  }
}
if (-not $env:MAILBOX_PASSWORD) {
  $s = Read-Host -AsSecureString "Senha da caixa $env:MAILBOX_USER (não aparece na tela; não é guardada)"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { $env:MAILBOX_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$env:BRIDGE_JOURNAL = Join-Path $dir "journal.sqlite"
$argumentos = @("src\main.js")
if ($SoCaixa) { $argumentos += "--mailbox-only" } elseif ($Conferir) { $argumentos += "--check" } elseif ($UmCiclo) { $argumentos += "--once" }
Push-Location (Join-Path $raiz "bridge")
try {
  if ($SoCaixa -or $Conferir -or $UmCiclo) { & node @argumentos }
  else { & node @argumentos *>> (Join-Path $dir "ponte.log") }
} finally {
  Pop-Location
  Remove-Item Env:MAILBOX_PASSWORD, Env:BRIDGE_HMAC_KEY, Env:ACCESS_CLIENT_SECRET -ErrorAction SilentlyContinue
}
