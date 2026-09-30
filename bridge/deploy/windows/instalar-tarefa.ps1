# Ponte de e-mail do EAG Compass — tarefa agendada: inicia ao entrar no Windows e reinicia se parar.
# Não pede privilégio de administrador (roda com a sua conta). Remover: Unregister-ScheduledTask -TaskName "EAG Compass - ponte de e-mail"
$ErrorActionPreference = "Stop"
$nome = "EAG Compass - ponte de e-mail"
$script = Join-Path $PSScriptRoot "iniciar-ponte.ps1"
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$ajustes = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $ajustes -Description "Transporta mensagens aprovadas no Compass e registra respostas. Sem leitura da caixa, o Compass não libera envio." -Force | Out-Null
Write-Host "Tarefa '$nome' registrada. Registro em $env:LOCALAPPDATA\eag-mail-bridge\ponte.log"
