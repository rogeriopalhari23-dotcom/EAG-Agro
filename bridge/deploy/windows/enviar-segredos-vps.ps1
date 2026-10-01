# Envia ao servidor da ponte (Hetzner) os segredos guardados no DPAPI deste computador, sem mostrá-los na tela, sem
# arquivo intermediário e sem colocá-los em argumento de comando: o valor vai pela entrada padrão do ssh direto para
# /etc/eag-mail-bridge/<NOME> (root, 0600). A senha da caixa, se não estiver guardada, é pedida aqui sem eco.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File bridge\deploy\windows\enviar-segredos-vps.ps1 -Servidor <IP>
param([Parameter(Mandatory = $true)][string]$Servidor, [string]$Chave = "$env:USERPROFILE\.ssh\eag_ponte_vps")
$ErrorActionPreference = "Stop"
if ($Servidor -notmatch '^[0-9a-fA-F:.]+$') { throw "Informe o IP do servidor (só o endereço)." }
if (-not (Test-Path $Chave)) { throw "Chave SSH $Chave não encontrada." }
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
$segredos = Join-Path $dir "segredos.json"
$config = Join-Path $dir "config.json"
if (-not (Test-Path $segredos)) { throw "Segredos não encontrados em $segredos." }
$cfg = Get-Content $config -Raw | ConvertFrom-Json
$guardados = Get-Content $segredos -Raw | ConvertFrom-Json
$nomes = @("BRIDGE_HMAC_KEY", "ACCESS_CLIENT_ID", "ACCESS_CLIENT_SECRET", "MAILBOX_PASSWORD")
try {
  foreach ($n in $nomes) {
    $valor = $null
    if ($guardados.PSObject.Properties.Name -contains $n) {
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(($guardados.$n | ConvertTo-SecureString))
      try { $valor = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    } elseif ($n -eq "MAILBOX_PASSWORD") {
      $s = Read-Host -AsSecureString "Senha da caixa $($cfg.MAILBOX_USER) (não aparece na tela)"
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
      try { $valor = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    } else { throw "Segredo $n não guardado neste computador." }
    if ($n -like "ACCESS_CLIENT_*") { $valor = ($valor -replace "^\s*CF-Access-Client-(Id|Secret)\s*:\s*", "").Trim() }
    Set-Item -Path "Env:EAG_VPS_$n" -Value $valor
    Remove-Variable valor
  }
  $env:EAG_VPS_HOST = $Servidor
  $env:EAG_VPS_KEY = $Chave
  & node (Join-Path $PSScriptRoot "enviar-segredos-vps.mjs")
  if ($LASTEXITCODE -ne 0) { throw "Envio dos segredos falhou (código $LASTEXITCODE)." }
} finally {
  foreach ($n in $nomes) { Remove-Item "Env:EAG_VPS_$n" -ErrorAction SilentlyContinue }
}
