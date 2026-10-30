# Instala os agentes do Claude Code da Prog Soluções (docs/AGENTES.md) na conta que o executor do PC usa.
# Só copia (sobrescreve os do time; não apaga outros agentes). Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agentes\instalar.ps1
$origem = Join-Path $PSScriptRoot '..\..\agentes\claude-code'
$destinos = @('C:\Users\arthu\.claude-lm\agents')
foreach ($d in $destinos) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Get-ChildItem -Path $origem -Filter '*.md' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $d $_.Name) -Force
    Write-Output "ok: $($_.Name) -> $d"
  }
}
