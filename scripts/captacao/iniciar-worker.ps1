<#
  Liga o programa da Captação no PC: atende os pedidos de busca feitos no painel
  (prog-imports.com/admin/captacao > Buscas), inclusive pelo celular.
  Deixe a janela aberta. Para parar: Ctrl+C ou fechar a janela.

    .\iniciar-worker.ps1           # fica de plantão
    .\iniciar-worker.ps1 -UmaVez   # atende o que estiver na fila e fecha
#>
param([switch]$UmaVez)

$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Host.UI.RawUI.WindowTitle = 'Captação: programa do PC'
Set-Location $repo
$cmd = @('-y', 'tsx', 'scripts/captacao/worker.ts')
if ($UmaVez) { $cmd += '--uma-vez' }
npx @cmd
