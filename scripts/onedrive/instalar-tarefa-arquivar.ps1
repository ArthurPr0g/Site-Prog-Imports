<#
  Cria (ou recria) a tarefa agendada "Prog - Arquivar Storage", que roda arquivar-storage.mjs todo domingo às
  10h, escondida (se o PC estiver desligado, roda assim que ligar). Não precisa de administrador.
  Áudios de reunião e prints de ajuste com mais de 60 dias vão para a pasta do cliente (disco + OneDrive) e
  saem do Supabase.

    powershell -ExecutionPolicy Bypass -File scripts\onedrive\instalar-tarefa-arquivar.ps1
#>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'arquivar-storage.mjs'
$node = (Get-Command node).Source
$nome = 'Prog - Arquivar Storage'

# conhost --headless roda o node sem abrir janela.
$acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" `"$script`"" -WorkingDirectory (Split-Path $script)
$gatilho = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 10am
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Description 'Arquiva no OneDrive os áudios de reunião e prints de ajuste com mais de 60 dias e apaga do Supabase (site da Prog Imports).' -Force | Out-Null
Write-Host "Tarefa '$nome' criada: todo domingo às 10h."
