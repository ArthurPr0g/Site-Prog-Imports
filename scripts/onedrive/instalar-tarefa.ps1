<#
  Cria (ou recria) a tarefa agendada "Prog - Arquivos dos clientes", que roda
  sincronizar-clientes.mjs a cada 5 minutos, escondida, enquanto o Arthur
  estiver logado. Não precisa de administrador.

    powershell -ExecutionPolicy Bypass -File scripts\onedrive\instalar-tarefa.ps1
#>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'sincronizar-clientes.mjs'
$node = (Get-Command node).Source
$nome = 'Prog - Arquivos dos clientes'

# conhost --headless roda o node sem abrir janela.
$acao = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless `"$node`" `"$script`"" -WorkingDirectory (Split-Path $script)
$gatilho = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$config = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Description 'Baixa para o OneDrive os arquivos que os clientes fechados mandam pelo WhatsApp (site da Prog Imports).' -Force | Out-Null
Write-Host "Tarefa '$nome' criada: roda a cada 5 minutos."
