# Recorta o fundo claro de foto de fabricante e reenquadra o produto numa tela
# quadrada, na cor do cartão do site.
#
# Serve para imagem de catálogo com fundo branco ou cinza-claro uniforme, que é
# o padrão de Apple e Samsung. O recorte parte das BORDAS: só o claro ligado à
# borda vira fundo, então tecla branca, reflexo e tela acesa ficam intactos.
#
# Depois do recorte, só a MAIOR ilha de pixels sobrevive. É isso que joga fora
# selo de canto — "Copilot+PC", "Intel Evo", logo de campanha — sem precisar
# cortar a imagem e sem risco de cortar o produto junto.
#
# Uso:
#   powershell -File recortar-enquadrar.ps1 -Entrada .\originais -Saida .\prontas

param(
  [Parameter(Mandatory = $true)][string]$Entrada,
  [Parameter(Mandatory = $true)][string]$Saida,
  [int]$Lado = 2560,
  [double]$Margem = 0.05,
  # Quanto o pixel pode se afastar do branco e ainda ser fundo. 18 cobre o
  # cinza-claro da Apple (#F5F5F7) sem comer prata escovada de notebook.
  [int]$Tolerancia = 18,
  [int]$FundoR = 17, [int]$FundoG = 17, [int]$FundoB = 20,
  # Ilha com menos que esta fração da maior é considerada selo/marca d'água.
  # 0.25 é folgado: o produto é uma ilha só, e selo de canto não passa de 2%.
  # Passe 1.1 para desligar a limpeza quando a foto tiver duas peças de verdade
  # (aparelho + caneta, por exemplo).
  [double]$FracaoMinimaDaIlha = 0.25,
  # Teto de ampliação. Reenquadrar é tentador — encosta o produto na margem e
  # fica bonito na vitrine —, mas quando o produto ocupa um canto da foto
  # original isso vira ampliação de 2x ou 3x, e o zoom da página entrega a
  # imagem serrilhada. Acima do teto o produto fica menor no quadrado, com o
  # fundo do cartão em volta, e continua nítido.
  [double]$EscalaMaxima = 1.5
)

Add-Type -AssemblyName System.Drawing

$codigo = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class RecorteEnquadre {
  public static string Processar(string entrada, string saida, int lado, double margem, int tol, int fr, int fg, int fb, double fracaoMinima, double escalaMaxima) {
    using (Bitmap origem = new Bitmap(entrada)) {
      int w = origem.Width, h = origem.Height;
      using (Bitmap img = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
        using (Graphics gr = Graphics.FromImage(img)) { gr.Clear(Color.White); gr.DrawImage(origem, 0, 0, w, h); }

        Rectangle rect = new Rectangle(0, 0, w, h);
        BitmapData bd = img.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
        int stride = bd.Stride;
        byte[] buf = new byte[Math.Abs(stride) * h];
        Marshal.Copy(bd.Scan0, buf, 0, buf.Length);

        bool[] fundo = new bool[w * h];
        Queue<int> fila = new Queue<int>();
        for (int x = 0; x < w; x++) { Semear(buf, stride, w, x, 0, tol, fundo, fila); Semear(buf, stride, w, x, h - 1, tol, fundo, fila); }
        for (int y = 0; y < h; y++) { Semear(buf, stride, w, 0, y, tol, fundo, fila); Semear(buf, stride, w, w - 1, y, tol, fundo, fila); }
        int[] dx = { 1, -1, 0, 0 }; int[] dy = { 0, 0, 1, -1 };
        while (fila.Count > 0) {
          int p = fila.Dequeue(); int px = p % w, py = p / w;
          for (int k = 0; k < 4; k++) { int nx = px + dx[k], ny = py + dy[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; Semear(buf, stride, w, nx, ny, tol, fundo, fila); }
        }

        int ilhasDescartadas = fracaoMinima > 1.0 ? 0 : DescartarIlhasPequenas(fundo, w, h, fracaoMinima);

        int minX = w, minY = h, maxX = -1, maxY = -1, marcados = 0;
        for (int y = 0; y < h; y++) {
          for (int x = 0; x < w; x++) {
            int i = y * stride + x * 3;
            if (fundo[y * w + x]) {
              marcados++;
              buf[i] = (byte)fb; buf[i + 1] = (byte)fg; buf[i + 2] = (byte)fr;
            } else {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
        img.UnlockBits(bd);

        // Guarda contra recorte destrutivo: sem produto identificável, avisa em
        // vez de gravar um retângulo vazio. A medida é a ÁREA sobrevivente, não
        // a altura: notebook de perfil e foto de portas são legitimamente uma
        // tira de 100px de altura, e reprovar por altura jogava fora justamente
        // as fotos de porta que toda galeria de fabricante tem.
        long areaProduto = (long)(w * h) - marcados;
        if (maxX < 0 || areaProduto < (long)(w * h) / 500) return "RECORTE FALHOU (mantida original)";

        int larguraProduto = maxX - minX + 1, alturaProduto = maxY - minY + 1;
        double areaUtil = lado * (1 - 2 * margem);
        double escala = Math.Min(areaUtil / larguraProduto, areaUtil / alturaProduto);
        bool limitou = false;
        if (escala > escalaMaxima) { escala = escalaMaxima; limitou = true; }
        int novaL = (int)Math.Round(larguraProduto * escala), novaA = (int)Math.Round(alturaProduto * escala);

        using (Bitmap tela = new Bitmap(lado, lado, PixelFormat.Format24bppRgb))
        using (Graphics g = Graphics.FromImage(tela)) {
          g.Clear(Color.FromArgb(255, fr, fg, fb));
          g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
          g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
          g.DrawImage(img, new Rectangle((lado - novaL) / 2, (lado - novaA) / 2, novaL, novaA),
                      new Rectangle(minX, minY, larguraProduto, alturaProduto), GraphicsUnit.Pixel);
          ImageCodecInfo codec = null;
          foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") codec = c;
          EncoderParameters par = new EncoderParameters(1);
          par.Param[0] = new EncoderParameter(Encoder.Quality, 94L);
          tela.Save(saida, codec, par);
        }
        string selo = ilhasDescartadas > 0 ? string.Format(", {0} ilha(s) de selo descartada(s)", ilhasDescartadas) : "";
        string aviso = limitou ? string.Format("  <== produto ocupa %{0:0} do quadrado (origem pequena demais para encostar na margem)", 100.0 * Math.Max(novaL, novaA) / lado) : "";
        return string.Format("produto {0}x{1} ({2:0}% de fundo removido, escala {3:0.00}x{4}){5}",
                             larguraProduto, alturaProduto, 100.0 * marcados / (w * h), escala, selo, aviso);
      }
    }
  }

  // Rotula as ilhas de não-fundo e devolve ao fundo tudo que for pequeno demais
  // perto da maior. Selo de canto e marca d'água somem aqui; o produto fica.
  static int DescartarIlhasPequenas(bool[] fundo, int w, int h, double fracaoMinima) {
    int[] rotulo = new int[w * h];
    List<int> areas = new List<int>();
    areas.Add(0);
    Queue<int> fila = new Queue<int>();
    int[] dx = { 1, -1, 0, 0 }; int[] dy = { 0, 0, 1, -1 };

    for (int inicio = 0; inicio < w * h; inicio++) {
      if (fundo[inicio] || rotulo[inicio] != 0) continue;
      int atual = areas.Count;
      areas.Add(0);
      rotulo[inicio] = atual;
      fila.Enqueue(inicio);
      int area = 0;
      while (fila.Count > 0) {
        int p = fila.Dequeue(); area++;
        int px = p % w, py = p / w;
        for (int k = 0; k < 4; k++) {
          int nx = px + dx[k], ny = py + dy[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int ni = ny * w + nx;
          if (fundo[ni] || rotulo[ni] != 0) continue;
          rotulo[ni] = atual; fila.Enqueue(ni);
        }
      }
      areas[atual] = area;
    }

    int maior = 0;
    for (int i = 1; i < areas.Count; i++) if (areas[i] > maior) maior = areas[i];
    if (maior == 0) return 0;

    double limite = maior * fracaoMinima;
    int descartadas = 0;
    bool[] descartar = new bool[areas.Count];
    for (int i = 1; i < areas.Count; i++) {
      if (areas[i] < limite) { descartar[i] = true; descartadas++; }
    }
    if (descartadas == 0) return 0;
    for (int i = 0; i < w * h; i++) {
      int r = rotulo[i];
      if (r != 0 && descartar[r]) fundo[i] = true;
    }
    return descartadas;
  }

  static void Semear(byte[] buf, int stride, int w, int x, int y, int tol, bool[] fundo, Queue<int> fila) {
    int idx = y * w + x; if (fundo[idx]) return; int i = y * stride + x * 3;
    if (255 - buf[i] <= tol && 255 - buf[i + 1] <= tol && 255 - buf[i + 2] <= tol) { fundo[idx] = true; fila.Enqueue(idx); }
  }
}
'@

if (-not ("RecorteEnquadre" -as [type])) { Add-Type -TypeDefinition $codigo -ReferencedAssemblies System.Drawing }

New-Item -ItemType Directory -Force $Saida | Out-Null
$arquivos = Get-ChildItem -File $Entrada | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg|webp)$' } | Sort-Object Name
$indice = 0
foreach ($a in $arquivos) {
  $indice++
  $destino = Join-Path $Saida "$indice.jpg"
  $resultado = [RecorteEnquadre]::Processar($a.FullName, $destino, $Lado, $Margem, $Tolerancia, $FundoR, $FundoG, $FundoB, $FracaoMinimaDaIlha, $EscalaMaxima)
  $kb = if (Test-Path $destino) { [math]::Round((Get-Item $destino).Length / 1KB) } else { 0 }
  "{0} -> {1}.jpg | {2} | {3} KB" -f $a.Name, $indice, $resultado, $kb
}
