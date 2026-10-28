<#
  Captação de leads: roda o google-maps-scraper-kit e deixa o CSV pronto para
  importar em prog-imports.com/admin/captacao.

  Uma busca:
    .\captar.ps1 -Ramo "clínica odontológica" -Cidade "Brasília, DF"
    .\captar.ps1 -Ramo "dentist" -Cidade "Orlando, FL" -Pais US

  Várias buscas (uma por linha: ramo | cidade | BR ou US):
    .\captar.ps1 -Lista .\buscas.txt

  Todos os nichos de uma lista numa cidade (nichos-br.txt / nichos-us.txt):
    .\captar.ps1 -Nichos .\nichos-br.txt -Cidade "Goiânia, GO"
    .\captar.ps1 -Nichos .\nichos-us.txt -Cidade "Orlando, FL" -Pais US

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
  # Arquivo com um ramo por linha; roda todos na -Cidade/-Pais informada.
  [string]$Nichos,
  # Pausa entre buscas de um lote: lote longo sem pausa arrisca bloqueio temporário do Google.
  [int]$Pausa = 45,
  [switch]$SemAbrir,
  # Grava a lista de CSVs gerados neste arquivo JSON (usado pelo worker.ts).
  [string]$SaidaJson,
  [string]$Kit = 'C:\Apps\1 - Dev\Prog Soluções\3 - Ferramentas\google-maps-scraper-kit'
)

# Sem 'Stop': no PowerShell 5.1 o docker e o python escrevem progresso no stderr,
# e isso viraria erro. Cada comando externo confere o $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$Engine = 'http://localhost:8080/api/v1/jobs'
# place_id e link vêm só pedindo as colunas; o painel usa o place_id para não duplicar.
$Colunas = 'title,phone,emails,website,category,address,review_rating,review_count,link,place_id,status,ultima_avaliacao,perfil_reivindicado,horario,atributos,agendamento_online,notas,avaliacoes'

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
  # Job em "working" há mais de 20 min é sobra de execução interrompida (PC
  # reiniciado): cada busca tem limite de 10 min. Job recente é de outra busca
  # rodando agora (lote em outra janela ou o worker) e não pode ser apagado.
  foreach ($j in @($jobs)) {
    $idade = if ($j.Date) { ((Get-Date).ToUniversalTime() - ([datetime]$j.Date).ToUniversalTime()).TotalMinutes } else { 999 }
    if ($j -and $j.Status -eq 'working' -and $idade -gt 20) {
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
  # Categoria do Google no idioma do lead (pedido do dono). O kit original fixa
  # "en"; a cópia local lê GMAPS_LANG (scripts/scrape.py, linha do body do job).
  # O engine só aceita código de 2 letras: "pt" funciona, "pt-BR" dá 422.
  $env:GMAPS_LANG = if ($pais -eq 'BR') { 'pt' } else { 'en' }
  # Duas tentativas, conferindo o engine antes de cada uma: num lote longo o
  # container pode reiniciar (Docker ocupado por outro serviço) e, sem isso,
  # todas as buscas seguintes falhavam em segundos.
  for ($tentativa = 1; $tentativa -le 2; $tentativa++) {
    try { Invoke-RestMethod $Engine -TimeoutSec 10 | Out-Null } catch { Preparar-Engine }
    # Write-Host: o que a função "devolve" tem de ser só o caminho do CSV.
    python @cmd 2>&1 | ForEach-Object { Write-Host "$_" }
    if ($LASTEXITCODE -eq 0) { break }
    if ($tentativa -eq 1) { Write-Host 'Falhou; tentando de novo em 30 s...'; Start-Sleep -Seconds 30 }
  }
  if ($LASTEXITCODE -ne 0) { Write-Warning "A busca '$busca' falhou."; return $null }
  # Site fora do ar, sem HTTPS ou que não se adapta ao celular: argumentos de venda.
  # Também grava ramo, cidade e país em cada linha: a importação lê dali.
  python -I "$PSScriptRoot\checar-sites.py" $saida --ramo $ramo --cidade $cidade --pais $pais 2>&1 |
    ForEach-Object { Write-Host "$_" }
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
} elseif ($Nichos -and $Cidade) {
  foreach ($linha in Get-Content $Nichos -Encoding UTF8) {
    $r = ($linha -replace '#.*$', '').Trim()
    if ($r) { $buscas += , @($r, $Cidade, $Pais) }
  }
} elseif ($Ramo -and $Cidade) {
  $buscas += , @($Ramo, $Cidade, $Pais)
} else {
  throw 'Informe -Ramo e -Cidade, -Nichos arquivo.txt e -Cidade, ou -Lista arquivo.txt'
}

Preparar-Engine
$feitos = @()
$n = 0
foreach ($b in $buscas) {
  if ($n++ -gt 0 -and $Pausa -gt 0) { Start-Sleep -Seconds $Pausa }
  Write-Host "[$n/$($buscas.Count)]"
  $arq = Captar $b[0] $b[1] $b[2]
  if ($arq) { $feitos += $arq }
}

Write-Host "`nPronto: $($feitos.Count) de $($buscas.Count) busca(s)."
# -InputObject: no PowerShell 5.1, um item só sairia como texto e não como lista.
if ($SaidaJson) { ConvertTo-Json -InputObject @($feitos) | Set-Content -Path $SaidaJson -Encoding UTF8 }
$feitos | ForEach-Object { Write-Host "  $_" }
if ($feitos.Count -gt 0 -and -not $SemAbrir) {
  Write-Host 'Importe em Captação > Importar CSV (pode selecionar todos os arquivos de uma vez).'
  Start-Process explorer.exe "/select,`"$($feitos[-1])`""
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { Start-Process $chrome 'https://www.prog-imports.com/admin/captacao' }
}
