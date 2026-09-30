# Ponte de e-mail do EAG Compass — inicia no seu computador.
# Lê a configuração de %LOCALAPPDATA%\eag-mail-bridge\config.json e os segredos cifrados (guardar-segredos.ps1);
# os segredos ficam só nas variáveis deste processo e do processo da ponte.
# Uso:
#   iniciar-ponte.ps1 -SoCaixa    confere IMAP e login SMTP da Hostinger (não envia, não lê mensagens)
#   iniciar-ponte.ps1 -Conferir   confere também o Compass (token de serviço e assinatura)
#   iniciar-ponte.ps1 -Validar    só confere caminhos, Node.js, dependências, configuração e segredos (não pede senha)
#   iniciar-ponte.ps1             laço contínuo (um ciclo por minuto) — é o que a tarefa agendada executa
param([switch]$SoCaixa, [switch]$Conferir, [switch]$UmCiclo, [switch]$Validar)
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
New-Item -ItemType Directory -Force $dir | Out-Null
$erroArquivo = Join-Path $dir "ultimo-erro.txt"
# Modo automático (janela oculta): o motivo vai para o registro e para ultimo-erro.txt, e a saída 0 evita que a tarefa
# fique reiniciando por um problema de configuração. Nos modos com janela, aparece na tela.
function Parar($motivo) {
  $linha = "$((Get-Date).ToString('s')) Ponte não iniciada: $motivo"
  if ($interativo -or $Validar) { Write-Host "Ponte não iniciada: $motivo"; exit 2 }
  $linha | Out-File -Append -Encoding utf8 (Join-Path $dir "ponte.log")
  $linha | Set-Content -Encoding utf8 $erroArquivo
  exit 0
}

# Caminhos a partir da localização deste script: ...\bridge\deploy\windows\iniciar-ponte.ps1 → pasta da ponte = ...\bridge
$ponte = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$config = Join-Path $dir "config.json"
$segredos = Join-Path $dir "segredos.json"
$interativo = $SoCaixa -or $Conferir -or $UmCiclo

# 1. Validação (antes de qualquer pedido de senha)
$pacote = Join-Path $ponte "package.json"
if (-not (Test-Path $pacote) -or (Get-Content $pacote -Raw | ConvertFrom-Json).name -ne "eag-mail-bridge") { Parar "pasta da ponte não encontrada em $ponte" }
if (-not (Test-Path (Join-Path $ponte "src\main.js"))) { Parar "arquivo src\main.js ausente em $ponte" }
foreach ($m in "nodemailer", "imapflow") {
  if (-not (Test-Path (Join-Path $ponte "node_modules\$m"))) { Parar "dependência '$m' não instalada. Rode: npm ci --prefix `"$ponte`"" }
}
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Parar "Node.js não encontrado no PATH (instale o Node.js 24 LTS)" }
$versao = [version]((& node -p "process.versions.node").Trim())
if ($versao -lt [version]"22.5.0") { Parar "Node.js $versao é antigo; a ponte precisa de 22.5 ou mais recente" }
if (-not (Test-Path $config)) {
  @{ COMPASS_URL = "https://eag-compass-production.rogeriopalhari23.workers.dev"; MAILBOX_USER = "rogeriopalhari@eagagro.com"; SMTP_PORT = "465" } |
    ConvertTo-Json | Set-Content -Encoding utf8 $config
  Write-Host "Configuração criada em $config."
}
$cfg = Get-Content $config -Raw | ConvertFrom-Json
if (-not $cfg.MAILBOX_USER) { Parar "MAILBOX_USER ausente em $config" }
$guardados = @()
if (Test-Path $segredos) { $guardados = (Get-Content $segredos -Raw | ConvertFrom-Json).PSObject.Properties.Name }
if (-not $SoCaixa) {
  # Ligação com o Compass: exige URL, Client ID do token de serviço e os dois segredos guardados.
  if (-not $cfg.COMPASS_URL) { Parar "COMPASS_URL ausente em $config" }
  foreach ($n in "ACCESS_CLIENT_ID", "BRIDGE_HMAC_KEY", "ACCESS_CLIENT_SECRET") { if ($guardados -notcontains $n) { Parar "segredo $n não guardado (guardar-segredos.ps1 / configurar-chave-compass.ps1)" } }
}
if (-not $interativo -and $guardados -notcontains "MAILBOX_PASSWORD") { Parar "senha da caixa não guardada; no modo automático a ponte não pede senha (rode guardar-segredos.ps1)" }
if ($Validar) { Write-Host "Validação OK: ponte em $ponte, Node.js $versao, configuração e segredos presentes."; exit 0 }
Remove-Item $erroArquivo -ErrorAction SilentlyContinue

# 2. Configuração e segredos só nas variáveis deste processo (repassadas ao processo da ponte)
$cfg.PSObject.Properties | ForEach-Object { if ($_.Value) { Set-Item -Path "Env:$($_.Name)" -Value $_.Value } }
if (Test-Path $segredos) {
  (Get-Content $segredos -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object {
    $seguro = $_.Value | ConvertTo-SecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
    try {
      $valor = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
      # Valores guardados com o rótulo do painel ("CF-Access-Client-Id: …") também funcionam.
      if ($_.Name -like "ACCESS_CLIENT_*") { $valor = ($valor -replace "^\s*CF-Access-Client-(Id|Secret)\s*:\s*", "").Trim() }
      Set-Item -Path "Env:$($_.Name)" -Value $valor
      Remove-Variable valor
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
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
Push-Location $ponte
$codigo = 0
try {
  $ErrorActionPreference = "Continue" # linhas de erro do node não interrompem o registro
  if ($SoCaixa -or $Conferir -or $UmCiclo) { & node @argumentos; $codigo = $LASTEXITCODE }
  else {
    & node @argumentos 2>&1 | ForEach-Object { "$_" } | Out-File -Append -Encoding utf8 (Join-Path $dir "ponte.log")
    $codigo = $LASTEXITCODE
  }
} finally {
  Pop-Location
  Remove-Item Env:MAILBOX_PASSWORD, Env:BRIDGE_HMAC_KEY, Env:ACCESS_CLIENT_SECRET -ErrorAction SilentlyContinue
}
exit $codigo # código diferente de 0 faz a tarefa agendada reiniciar a ponte

