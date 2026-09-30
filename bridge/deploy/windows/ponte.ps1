# Ponte de e-mail do EAG Compass — comandos do dia a dia (horários mostrados no fuso de Cuiabá).
#   ponte iniciar          liga a ponte agora e ao entrar no Windows
#   ponte parar            para ao fim do ciclo em andamento (nunca no meio de um envio) e desliga o início automático
#   ponte estado           mostra se está rodando, última leitura da caixa, último envio e o motivo do último ciclo
#   ponte registro         últimas linhas do registro (sem conteúdo de e-mail, sem endereços, sem senhas)
#   ponte conferir-caixa   testa IMAP e login SMTP da Hostinger (não envia nada)
#   ponte conferir         testa também a ligação com o Compass (não envia nada)
# Uso: powershell -ExecutionPolicy Bypass -File bridge\deploy\windows\ponte.ps1 estado
param([Parameter(Position = 0)][ValidateSet("iniciar", "parar", "estado", "registro", "conferir-caixa", "conferir")][string]$Comando = "estado")
$ErrorActionPreference = "Stop"
$tarefa = "EAG Compass - ponte de e-mail"
$dir = Join-Path $env:LOCALAPPDATA "eag-mail-bridge"
$cuiaba = [TimeZoneInfo]::FindSystemTimeZoneById("Central Brazilian Standard Time")
function Hora($iso) { if (-not $iso) { return "—" }; [TimeZoneInfo]::ConvertTimeFromUtc(([DateTime]::Parse($iso)).ToUniversalTime(), $cuiaba).ToString("dd/MM HH:mm:ss") + " (Cuiabá)" }
function Processo {
  $f = Join-Path $dir "journal.sqlite.lock"
  if (-not (Test-Path $f)) { return $null }
  $id = [int](Get-Content $f -Raw)
  Get-Process -Id $id -ErrorAction SilentlyContinue
}

switch ($Comando) {
  "iniciar" {
    # Confere tudo antes de registrar ou ligar a tarefa (sem pedir senha).
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "iniciar-ponte.ps1") -Validar
    if ($LASTEXITCODE -ne 0) { Write-Host "Corrija o item acima e rode 'ponte iniciar' de novo."; break }
    if (-not (Get-ScheduledTask -TaskName $tarefa -ErrorAction SilentlyContinue)) { & (Join-Path $PSScriptRoot "instalar-tarefa.ps1") }
    Enable-ScheduledTask -TaskName $tarefa | Out-Null
    if (Processo) { Write-Host "A ponte já está rodando." } else { Start-ScheduledTask -TaskName $tarefa; Start-Sleep -Seconds 8 }
    & $PSCommandPath estado
  }
  "parar" {
    Disable-ScheduledTask -TaskName $tarefa -ErrorAction SilentlyContinue | Out-Null
    $p = Processo
    if (-not $p) { Write-Host "A ponte não está rodando. Início automático desligado."; break }
    New-Item -ItemType File -Force (Join-Path $dir "parar") | Out-Null
    Write-Host "Pedido de parada enviado; aguardando o fim do ciclo (até 2 minutos)..."
    if (-not $p.WaitForExit(120000)) { Write-Host "Não parou a tempo; encerrando o processo."; Stop-Process -Id $p.Id -Force }
    Stop-ScheduledTask -TaskName $tarefa -ErrorAction SilentlyContinue
    Write-Host "Ponte parada. Envios ficam suspensos no Compass até a próxima leitura da caixa. Para voltar: ponte iniciar"
  }
  "estado" {
    $t = Get-ScheduledTask -TaskName $tarefa -ErrorAction SilentlyContinue
    $p = Processo
    Write-Host ("Ponte:            " + $(if ($p) { "rodando (PID $($p.Id))" } else { "parada" }))
    Write-Host ("Início automático: " + $(if (-not $t) { "não instalado" } elseif ($t.State -eq "Disabled") { "desligado" } else { "ligado" }))
    $e = Join-Path $dir "estado.json"
    if (Test-Path $e) {
      $s = Get-Content $e -Raw | ConvertFrom-Json
      Write-Host ("Iniciada em:       " + (Hora $s.startedAt))
      Write-Host ("Último ciclo:      " + (Hora $s.lastCycleAt) + "  motivo: " + $(if ($s.lastReason) { $s.lastReason } else { "—" }))
      Write-Host ("Última leitura OK: " + (Hora $s.lastReadOkAt) + $(if ($s.lastReadError) { "  ERRO: $($s.lastReadError)" } else { "" }))
      Write-Host ("Último envio:      " + (Hora $s.lastSentAt) + "  (envios desde o início: $($s.sentSinceStart))")
      if ($s.stoppedAuth) { Write-Host "ATENÇÃO: login SMTP recusado — envio parado. Confira a senha (guardar-segredos.ps1) e reinicie." }
      if ($p -and $s.lastReadOkAt -and ((Get-Date).ToUniversalTime() - ([DateTime]::Parse($s.lastReadOkAt)).ToUniversalTime()).TotalMinutes -gt 10) { Write-Host "ATENÇÃO: sem leitura da caixa há mais de 10 minutos — o Compass mantém os envios suspensos." }
    } else { Write-Host "Sem estado registrado ainda." }
    $erro = Join-Path $dir "ultimo-erro.txt"
    if (Test-Path $erro) { Write-Host ("ÚLTIMO ERRO DE INÍCIO: " + (Get-Content $erro -Raw).Trim()) }
    Write-Host "Motivos comuns: nothing_due (nada vencido), interval (aguardando o intervalo), outside_window/nothing_eligible (fora da janela ou bloqueado), daily_cap (teto do dia), reply_reader_unavailable (caixa não lida)."
  }
  "registro" {
    $l = Join-Path $dir "ponte.log"
    if (Test-Path $l) { Get-Content $l -Tail 30 } else { Write-Host "Sem registro ainda." }
  }
  "conferir-caixa" {
    if (Processo) { Write-Host "A ponte está rodando; a conferência usa a mesma caixa e pode ser feita assim mesmo." }
    & (Join-Path $PSScriptRoot "iniciar-ponte.ps1") -SoCaixa
    exit $LASTEXITCODE
  }
  "conferir" {
    if (Processo) { Write-Host "Pare a ponte antes de conferir (ponte parar)."; break }
    & (Join-Path $PSScriptRoot "iniciar-ponte.ps1") -Conferir
    exit $LASTEXITCODE
  }
}
