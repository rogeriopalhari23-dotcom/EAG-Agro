# Ponte de e-mail do EAG Compass — encerramento do teste interno no prazo, sem depender de sessão do Claude.
# 1) para a ponte (fim do ciclo em andamento) e desliga o início automático; 2) desliga o canal de e-mail no Compass pela
# rota de trava da ponte (só desliga); 3) tenta encerrar a campanha de teste, descartar as fichas de teste e devolver o canal
# ao estado anterior com a sessão do Access de Rogério (sem abrir login); 4) grava o relatório com o que ficou pendente.
# Uso: agendado por instalar-prazo-teste-interno.ps1 (ou manual: powershell -ExecutionPolicy Bypass -File <este arquivo>)
$ErrorActionPreference = "Continue"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
$raiz = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$relatorio = Join-Path $dir "encerramento-teste-interno.txt"
function Linha($t) { $l = "$((Get-Date).ToString('dd/MM/yyyy HH:mm:ss')) (Cuiabá) $t"; $l | Out-File -Append -Encoding utf8 $relatorio; Write-Host $l }
Linha "Início do encerramento do teste interno (prazo)."
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ponte.ps1") parar *>&1 | ForEach-Object { Linha "ponte parar: $_" }
$trava = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "iniciar-ponte.ps1") -TesteInterno bloquear 2>&1 | ForEach-Object { "$_" }
Linha "trava do canal: $($trava -join ' ')"
$ok = ($trava -join ' ') -match '"state":"planned"'
Push-Location $raiz
$fim = & node bridge/scripts/teste-interno-admin.mjs encerrar 2>&1 | ForEach-Object { "$_" }
$codigo = $LASTEXITCODE
Pop-Location
Linha "encerramento da campanha de teste: $($fim -join ' ')"
if ($codigo -ne 0) {
  Linha "PENDENTE: campanha de teste ativa e fichas de teste não descartadas (sem sessão do Access). O canal está desligado: nada é enviado. Para concluir: cloudflared access login https://eag-compass-production.rogeriopalhari23.workers.dev e depois node bridge/scripts/teste-interno-admin.mjs encerrar"
}
if (-not $ok) { Linha "ATENÇÃO: a trava do canal não confirmou 'planned'. A ponte está parada (nada envia), mas confira o canal no Compass." }
Linha "Fim do encerramento."
Unregister-ScheduledTask -TaskName "EAG Compass - prazo do teste interno" -Confirm:$false -ErrorAction SilentlyContinue
