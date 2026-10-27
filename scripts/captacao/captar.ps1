<#
  Captação de leads: roda o google-maps-scraper-kit e deixa o CSV pronto para
  importar em prog-imports.com/admin/captacao.

  Uma busca:
    .\captar.ps1 -Ramo "clínica odontológica" -Cidade "Brasília, DF"
    .\captar.ps1 -Ramo "dentist" -Cidade "Orlando, FL" -Pais US

  Várias buscas (uma por linha: ramo | cidade | BR ou US):
    .\captar.ps1 -Lista .\buscas.txt

  O que ele faz sozinho: liga o Docker Desktop se estiver desligado, sobe o
  engine, apaga jobs que ficaram presos (ex.: depois de reiniciar o PC), roda
  a busca com place_id e link do Maps (deduplicação) e redes sociais, confere
  os sites (fora do ar, sem HTTPS, sem versão para celular) e abre a pasta com
  o CSV e a tela de importação no Chrome.

  Cuidado com bloqueio do Google: uma busca por vez (o script já faz assim),
  profundidade 5 no começo. Se vier vazio ou bem menos que antes, pare um pouco.
#>
param(
  [string]$Ramo,
  [string]$Cidade,
  [ValidateSet('BR', 'US')][string]$Pais = 'BR',
  [int]$Profundidade = 5,
  [int]$Grade = 0,
  [string]$Lista,
  [switch]$SemAbrir,
  [string]$Kit = 'C:\Apps\1 - Dev\Prog Soluções\3 - Ferramentas\google-maps-scraper-kit'
)

# Sem 'Stop': no PowerShell 5.1 o docker e o python escrevem progresso no stderr,
# e isso viraria erro. Cada comando externo confere o $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$Engine = 'http://localhost:8080/api/v1/jobs'
# place_id e link vêm só pedindo as colunas; o painel usa o place_id para não duplicar.
$Colunas = 'title,phone,emails,website,category,address,review_rating,review_count,link,place_id'

function Esperar-Docker {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { return }
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) { throw 'Docker Desktop não encontrado. Instale ou abra manualmente.' }
  Write-Host 'Ligando o Docker Desktop (1 a 2 minutos)...'
  Start-Process $exe
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }
  }
  throw 'O Docker não respondeu em 5 minutos.'
}

function Preparar-Engine {
  Esperar-Docker
  Push-Location $Kit
  try { docker compose up -d 2>&1 | Out-Null } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'Não consegui subir o engine (docker compose up).' }
  for ($i = 0; $i -lt 30; $i++) {
    try { $jobs = Invoke-RestMethod $Engine -TimeoutSec 5; break } catch { Start-Sleep -Seconds 2 }
  }
  # Job em "working" sem ninguém esperando por ele é sobra de execução interrompida.
  foreach ($j in @($jobs)) {
    if ($j -and $j.Status -eq 'working') {
      Write-Host "Apagando job preso: $($j.ID)"
      Invoke-RestMethod "$Engine/$($j.ID)" -Method Delete | Out-Null
    }
  }
}

function Nome-Arquivo([string]$texto) {
  $s = $texto.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
  ($s.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
}

function Captar([string]$ramo, [string]$cidade, [string]$pais) {
  $busca = if ($pais -eq 'US') { "$ramo in $cidade" } else { "$ramo em $cidade" }
  $pasta = Join-Path $Kit 'resultados'
  New-Item -ItemType Directory -Force $pasta | Out-Null
  $saida = Join-Path $pasta ("{0}-{1}-{2}-{3}.csv" -f (Nome-Arquivo $ramo), (Nome-Arquivo $cidade), $pais.ToLower(), (Get-Date -Format 'yyyyMMdd-HHmm'))

  $cmd = @("$Kit\scripts\scrape.py", $busca, '--city', $cidade, '--depth', $Profundidade,
    '--fields', $Colunas, '--socials', '--out', $saida)
  if ($Grade -gt 0) { $cmd += @('--grid', $Grade) }

  Write-Host "`n>> $busca"
  # Sem isto o Windows grava o CSV em cp1252 e os acentos quebram.
  $env:PYTHONUTF8 = '1'; $env:PYTHONIOENCODING = 'utf-8'
  # Write-Host: o que a função "devolve" tem de ser só o caminho do CSV.
  python @cmd 2>&1 | ForEach-Object { Write-Host "$_" }
  if ($LASTEXITCODE -ne 0) { Write-Warning "A busca '$busca' falhou."; return $null }
  # Site fora do ar, sem HTTPS ou que não se adapta ao celular: argumentos de venda.
  python -I "$PSScriptRoot\checar-sites.py" $saida 2>&1 | ForEach-Object { Write-Host "$_" }
  return $saida
}

if (-not (Test-Path "$Kit\scripts\scrape.py")) { throw "Kit não encontrado em $Kit" }

$buscas = @()
if ($Lista) {
  foreach ($linha in Get-Content $Lista -Encoding UTF8) {
    if ($linha.Trim() -eq '' -or $linha.TrimStart().StartsWith('#')) { continue }
    $p = $linha.Split('|') | ForEach-Object { $_.Trim() }
    $buscas += , @($p[0], $p[1], $(if ($p.Count -gt 2 -and $p[2]) { $p[2].ToUpper() } else { 'BR' }))
  }
} elseif ($Ramo -and $Cidade) {
  $buscas += , @($Ramo, $Cidade, $Pais)
} else {
  throw 'Informe -Ramo e -Cidade, ou -Lista arquivo.txt'
}

Preparar-Engine
$feitos = @()
foreach ($b in $buscas) {
  $arq = Captar $b[0] $b[1] $b[2]
  if ($arq) { $feitos += $arq }
}

Write-Host "`nPronto: $($feitos.Count) de $($buscas.Count) busca(s)."
$feitos | ForEach-Object { Write-Host "  $_" }
if ($feitos.Count -gt 0 -and -not $SemAbrir) {
  Write-Host 'Importe em Captação > Importar CSV, informando país, ramo e cidade de cada arquivo.'
  Start-Process explorer.exe "/select,`"$($feitos[-1])`""
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { Start-Process $chrome 'https://www.prog-imports.com/admin/captacao' }
}
