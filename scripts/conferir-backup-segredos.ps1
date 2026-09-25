# Confere se os segredos guardados no gerenciador de senhas batem com o arquivo de backup, sem exibir valores.
# Uso (PowerShell, na máquina de Rogério):
#   powershell -ExecutionPolicy Bypass -File scripts\conferir-backup-segredos.ps1
# Para cada chave, cole o valor copiado do gerenciador quando pedido (a digitação fica oculta).
# Resultado: "confere" ou "NÃO confere" por chave. Nada é gravado, enviado ou mostrado.
param([string]$Arquivo = "C:\Users\Roger\eag-compass-backups\segredos-producao-2026-09-24.txt")

if (-not (Test-Path $Arquivo)) { Write-Host "Arquivo não encontrado: $Arquivo"; exit 1 }
$linhas = Get-Content -LiteralPath $Arquivo
$tudoConfere = $true
foreach ($chave in @("PII_ENCRYPTION_KEY", "UNSUB_TOKEN_KEY")) {
  $linha = $linhas | Where-Object { $_ -like "$chave=*" } | Select-Object -First 1
  if (-not $linha) { Write-Host "${chave}: ausente no arquivo"; $tudoConfere = $false; continue }
  $esperado = $linha.Substring($chave.Length + 1).Trim()
  $seguro = Read-Host -AsSecureString "Cole o valor de $chave copiado do gerenciador"
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { $informado = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($informado -ceq $esperado) { Write-Host "${chave}: confere" } else { Write-Host "${chave}: NÃO confere"; $tudoConfere = $false }
  $informado = $null; $esperado = $null
}
if ($tudoConfere) {
  Write-Host "`nTudo confere. Para apagar o arquivo (não vai para a Lixeira):"
  Write-Host "  Remove-Item -LiteralPath '$Arquivo'"
} else {
  Write-Host "`nNão apague o arquivo: corrija o gerenciador e rode de novo."
}
