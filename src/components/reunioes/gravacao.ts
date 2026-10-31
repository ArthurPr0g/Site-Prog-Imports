'use client';

// Gravação da sala de reunião no navegador do Arthur (Fase 1, 31/10/2026).
//
// Áudio: Web Audio mistura o microfone do Arthur com o áudio de quem está na chamada. Há três saídas:
//   * mistura  → áudio completo (opus 32 kbps, ~14 MB por hora) que vai ao Storage e entra no vídeo;
//   * a mesma mistura, fatiada a cada ~15 s, para a transcrição ao vivo.
// Fase 2 (31/10/2026): antes cada lado mandava a própria fatia, e 1 h de reunião gastava 7.200 s de áudio (o
// limite por hora do plano grátis da Groq). Agora vai UM áudio só, misturado, e junto a energia de cada lado a
// cada 200 ms: o servidor pede ao Whisper os segmentos com tempo e diz quem falou em cada um pelo lado que
// tinha mais energia naquele intervalo. Metade do áudio, metade dos pedidos (no máximo 4 por minuto).
// Fatias: um MediaRecorder novo a cada 15 s (cada arquivo sai completo, com cabeçalho, para o Whisper);
// fatia sem voz (medida pelo volume) não é enviada, o que poupa o limite grátis da Groq e evita frase inventada.
//
// Vídeo (decisão documentada): composição da sala num <canvas> (as câmeras lado a lado + nomes) gravada com
// MediaRecorder. É mais confiável que compartilhar a aba: não pede permissão, não depende de o Arthur escolher
// a aba certa e não grava a transcrição nem o painel do lead. O desenho é cadenciado por um Worker, porque o
// Chrome segura timers e requestAnimationFrame quando a aba fica em segundo plano. No plano B (Meet), a única
// fonte é a aba do Meet compartilhada (getDisplayMedia), e o vídeo é ela.

export const FATIA_MS = 15_000;
const MIME_AUDIO = 'audio/webm;codecs=opus';

export function mimeDeVideo(): string {
  for (const m of ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

type Lado = 'arthur' | 'cliente';

/** Mixer de áudio da reunião. */
export class MesaDeSom {
  readonly ctx: AudioContext;
  readonly mistura: MediaStreamAudioDestinationNode;
  readonly medidores: Record<Lado, AnalyserNode>;
  private fontes = new Map<string, { no: MediaStreamAudioSourceNode; trackId: string }>();

  constructor() {
    this.ctx = new AudioContext();
    this.mistura = this.ctx.createMediaStreamDestination();
    this.medidores = { arthur: this.ctx.createAnalyser(), cliente: this.ctx.createAnalyser() };
    for (const l of ['arthur', 'cliente'] as Lado[]) this.medidores[l].fftSize = 1024;
  }

  /** Liga (ou troca) uma faixa de áudio. A chave é a pessoa (ex.: "mic", id da sessão na Daily). */
  ligar(chave: string, lado: Lado, track: MediaStreamTrack | null | undefined) {
    const atual = this.fontes.get(chave);
    if (atual && track && atual.trackId === track.id) return;
    if (atual) {
      atual.no.disconnect();
      this.fontes.delete(chave);
    }
    if (!track || track.readyState === 'ended') return;
    const no = this.ctx.createMediaStreamSource(new MediaStream([track]));
    no.connect(this.mistura);
    no.connect(this.medidores[lado]);
    this.fontes.set(chave, { no, trackId: track.id });
  }

  /** Tira quem não está mais na chamada. */
  manterSo(chaves: Set<string>) {
    for (const k of [...this.fontes.keys()]) if (!chaves.has(k)) this.ligar(k, 'cliente', null);
  }

  /** Volume (RMS 0..1) de um lado agora. */
  volume(lado: Lado): number {
    const a = this.medidores[lado];
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  }

  async retomar() {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  fechar() {
    for (const k of [...this.fontes.keys()]) this.ligar(k, 'cliente', null);
    void this.ctx.close();
  }
}

/** Energia dos dois lados a cada 200 ms (0–100): [arthur, cliente]. */
export type Energia = [number, number][];

/** Fatiador da mistura: a cada FATIA_MS entrega um arquivo completo com a energia de cada lado, só se houve voz. */
export class Fatiador {
  private fatia: { rec: MediaRecorder; partes: Blob[]; voz: number; inicio: number; energia: Energia } | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private medidor: ReturnType<typeof setInterval> | null = null;

  constructor(
    private mesa: MesaDeSom,
    private inicioDaReuniao: number,
    private entregar: (audio: Blob, segundos: number, energia: Energia) => void,
  ) {}

  iniciar() {
    if (this.relogio) return;
    this.novaFatia();
    this.relogio = setInterval(() => this.virar(true), FATIA_MS);
    // Volume a cada 200 ms: 3 medições acima do limiar (~0,6 s de fala) = fatia com voz.
    this.medidor = setInterval(() => {
      const f = this.fatia;
      if (!f) return;
      const a = this.mesa.volume('arthur');
      const c = this.mesa.volume('cliente');
      f.energia.push([Math.min(100, Math.round(a * 400)), Math.min(100, Math.round(c * 400))]);
      if (Math.max(a, c) > 0.015) f.voz++;
    }, 200);
  }

  private novaFatia() {
    const rec = new MediaRecorder(this.mesa.mistura.stream, { mimeType: MIME_AUDIO, audioBitsPerSecond: 24000 });
    const f = { rec, partes: [] as Blob[], voz: 0, inicio: Date.now(), energia: [] as Energia };
    rec.ondataavailable = (e) => {
      if (e.data.size) f.partes.push(e.data);
    };
    rec.onstop = () => {
      if (f.partes.length && f.voz >= 3) this.entregar(new Blob(f.partes, { type: 'audio/webm' }), Math.max(0, (f.inicio - this.inicioDaReuniao) / 1000), f.energia);
    };
    rec.start();
    this.fatia = f;
  }

  /** Fecha a fatia atual (ela se entrega sozinha ao parar) e, se for o caso, abre a próxima. */
  private virar(continuar: boolean) {
    const anterior = this.fatia;
    this.fatia = null;
    if (anterior && anterior.rec.state !== 'inactive') anterior.rec.stop();
    if (continuar) this.novaFatia();
  }

  parar() {
    if (!this.relogio) return;
    clearInterval(this.relogio);
    if (this.medidor) clearInterval(this.medidor);
    this.relogio = null;
    this.medidor = null;
    this.virar(false);
  }
}

/** Gravador de um arquivo inteiro (áudio da mistura ou vídeo), guardado em memória ou escrito direto num arquivo. */
export class GravadorDeArquivo {
  private rec: MediaRecorder;
  private partes: Blob[] = [];
  private escrita: Promise<void> = Promise.resolve();
  bytes = 0;

  constructor(
    stream: MediaStream,
    readonly mime: string,
    opcoes: MediaRecorderOptions,
    private arquivo?: FileSystemWritableFileStream,
  ) {
    this.rec = new MediaRecorder(stream, { mimeType: mime, ...opcoes });
    this.rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.bytes += e.data.size;
      // Com a pasta do OneDrive ligada, escreve no disco aos poucos (não acumula a reunião inteira na memória).
      if (this.arquivo) this.escrita = this.escrita.then(() => this.arquivo!.write(e.data)).catch(() => undefined);
      else this.partes.push(e.data);
    };
  }

  iniciar() {
    this.rec.start(5000);
  }

  /** Para e devolve o arquivo (em memória) ou null quando já foi escrito no disco. */
  parar(): Promise<Blob | null> {
    return new Promise((ok) => {
      this.rec.onstop = async () => {
        if (this.arquivo) {
          await this.escrita;
          await this.arquivo.close().catch(() => undefined);
          ok(null);
        } else ok(new Blob(this.partes, { type: this.mime.split(';')[0] }));
      };
      if (this.rec.state === 'inactive') this.rec.onstop(new Event('stop'));
      else this.rec.stop();
    });
  }
}

/** Composição da sala num canvas 1280×720, com o desenho cadenciado por um Worker (não para em segundo plano). */
export class Compositor {
  readonly canvas: HTMLCanvasElement;
  private worker: Worker | null = null;
  private url: string | null = null;

  constructor(private fontes: () => { video: HTMLVideoElement | null; nome: string }[]) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
  }

  iniciar(fps = 15): MediaStreamTrack {
    const codigo = `let t=null;onmessage=(e)=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}`;
    this.url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    this.worker = new Worker(this.url);
    this.worker.onmessage = () => this.desenhar();
    this.worker.postMessage(Math.round(1000 / fps));
    this.desenhar();
    return this.canvas.captureStream(fps).getVideoTracks()[0];
  }

  private desenhar() {
    const c = this.canvas.getContext('2d');
    if (!c) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.fillStyle = '#08080A';
    c.fillRect(0, 0, W, H);
    const lista = this.fontes();
    const n = Math.max(1, lista.length);
    const colunas = n <= 2 ? n : 2;
    const linhas = Math.ceil(n / colunas);
    const gap = 12;
    const w = (W - gap * (colunas + 1)) / colunas;
    const h = (H - gap * (linhas + 1)) / linhas;
    lista.forEach((f, i) => {
      const x = gap + (i % colunas) * (w + gap);
      const y = gap + Math.floor(i / colunas) * (h + gap);
      c.fillStyle = '#12141A';
      c.fillRect(x, y, w, h);
      const v = f.video;
      if (v && v.readyState >= 2 && v.videoWidth) {
        // "cover": preenche o quadro sem distorcer.
        const esc = Math.max(w / v.videoWidth, h / v.videoHeight);
        const vw = v.videoWidth * esc;
        const vh = v.videoHeight * esc;
        c.save();
        c.beginPath();
        c.rect(x, y, w, h);
        c.clip();
        c.drawImage(v, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh);
        c.restore();
      }
      c.fillStyle = 'rgba(8,8,10,0.7)';
      c.fillRect(x + 12, y + h - 44, Math.min(w - 24, 18 + f.nome.length * 11), 32);
      c.fillStyle = '#F4F5F7';
      c.font = '500 18px "DM Sans", system-ui, sans-serif';
      c.fillText(f.nome, x + 22, y + h - 22);
    });
  }

  parar() {
    this.worker?.terminate();
    if (this.url) URL.revokeObjectURL(this.url);
    this.worker = null;
  }
}

/** Baixa um arquivo pelo navegador (no Brave/Firefox, ou quando a pasta não foi liberada). */
export function baixar(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
