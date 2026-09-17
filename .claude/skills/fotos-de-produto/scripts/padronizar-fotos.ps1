# Padroniza fotos de produto para o site da Prog Imports.
#
# Redimensiona mantendo a proporção, centraliza numa tela quadrada de 2560x2560
# e grava PNG numerado na ordem em que aparecerão no produto.
#
# Uso:
#   pwsh -File padronizar-fotos.ps1 -Entrada .\originais -Saida .\prontas
#   pwsh -File padronizar-fotos.ps1 -Entrada .\originais -Saida .\prontas -Fundo branco
#
# A numeração segue a ordem alfabética dos arquivos de entrada: nomeie as
# originais como 01-frente, 02-lateral... para controlar qual será a capa.

param(
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Saida,
  # 'cartao' é a cor exata do cartão do site (#111114): imagem de fabricante com
  # fundo transparente composta sobre ela some na página, sem retângulo visível.
  [ValidateSet('escuro', 'branco', 'transparente', 'cartao', 'preto')][string]$Fundo = 'escuro',
  # PNG guarda transparência; JPEG é o que cabe no limite de 5 MB do site quando
  # a imagem é um render grande sobre fundo opaco.
  [ValidateSet('png', 'jpg')][string]$Formato = 'png',
  [int]$Lado = 2560,
  # 0.04 = 4% de respiro de cada lado. Produto colado na borda fica claustrofóbico
  # no zoom; margem demais faz o produto sumir na vitrine.
  [double]$Margem = 0.04,
  # Abaixo disso a foto chega borrada no zoom. Continua processando, mas avisa.
  [int]$MinimoOrigem = 1600
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $Entrada)) { throw "Pasta de entrada não encontrada: $Entrada" }
New-Item -ItemType Directory -Force $Saida | Out-Null

$corDeFundo = switch ($Fundo) {
  'escuro' { [System.Drawing.Color]::FromArgb(255, 33, 33, 33) }
  'cartao' { [System.Drawing.Color]::FromArgb(255, 17, 17, 20) }
  'preto' { [System.Drawing.Color]::FromArgb(255, 0, 0, 0) }
  'branco' { [System.Drawing.Color]::FromArgb(255, 255, 255, 255) }
  'transparente' { [System.Drawing.Color]::Transparent }
}

$arquivos = Get-ChildItem -File $Entrada | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp|bmp)$' } | Sort-Object Name
if ($arquivos.Count -eq 0) { throw "Nenhuma imagem em $Entrada" }
if ($arquivos.Count -lt 4) { Write-Warning "Só $($arquivos.Count) imagem(ns): o padrão da loja é de 4 a 6 por produto." }
if ($arquivos.Count -gt 6) { Write-Warning "$($arquivos.Count) imagens: acima de 6 a galeria fica cansativa." }

$indice = 0
foreach ($arquivo in $arquivos) {
  $indice++
  $origem = [System.Drawing.Image]::FromFile($arquivo.FullName)
  $larguraOrigem = $origem.Width
  $alturaOrigem = $origem.Height

  $maiorLadoOrigem = [Math]::Max($larguraOrigem, $alturaOrigem)
  if ($maiorLadoOrigem -lt $MinimoOrigem) {
    Write-Warning "$($arquivo.Name): origem de ${maiorLadoOrigem}px — abaixo de ${MinimoOrigem}px, vai aparecer borrada no zoom."
  }

  # Cabe na área útil (lado menos as duas margens), sem nunca ampliar além de
  # 1,5x: acima disso o ganho é serrilhado, não nitidez.
  $areaUtil = $Lado * (1 - 2 * $Margem)
  $escala = [Math]::Min($areaUtil / $origem.Width, $areaUtil / $origem.Height)
  if ($escala -gt 1.5) {
    Write-Warning "$($arquivo.Name): precisaria ampliar $([Math]::Round($escala,2))x — limitado a 1,5x para não serrilhar."
    $escala = 1.5
  }

  $largura = [int][Math]::Round($origem.Width * $escala)
  $altura = [int][Math]::Round($origem.Height * $escala)

  # Canal alfa só quando ele serve para alguma coisa: com fundo opaco, o PNG de
  # 32 bits sai com o dobro do tamanho sem nenhum ganho visível.
  $formatoPixel = if ($Fundo -eq 'transparente') {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  }
  $tela = New-Object System.Drawing.Bitmap($Lado, $Lado, $formatoPixel)
  $g = [System.Drawing.Graphics]::FromImage($tela)
  $g.Clear($corDeFundo)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $x = [int][Math]::Round(($Lado - $largura) / 2)
  $y = [int][Math]::Round(($Lado - $altura) / 2)
  $g.DrawImage($origem, $x, $y, $largura, $altura)

  $destino = Join-Path $Saida "$indice.$Formato"
  if ($Formato -eq 'jpg') {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $parametros = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $parametros.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 94L)
    $tela.Save($destino, $codec, $parametros)
  } else {
    $tela.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
  }

  $g.Dispose(); $tela.Dispose(); $origem.Dispose()

  $kb = [Math]::Round((Get-Item $destino).Length / 1KB)
  "{0} -> {1} ({2}x{3} de origem, {4} KB)" -f $arquivo.Name, (Split-Path $destino -Leaf), $larguraOrigem, $alturaOrigem, $kb
}

"`n$indice imagem(ns) em $Saida — confira uma a uma antes de subir."
