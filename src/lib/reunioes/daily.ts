// API REST da Daily (videochamada da sala de reunião, 31/10/2026). Só no servidor: a chave (DAILY_API_KEY)
// nunca vai ao navegador; ele recebe só a URL da sala e um token de reunião de curta duração.
// Nomes das propriedades conferidos na documentação oficial em 31/10/2026:
//   salas: https://docs.daily.co/reference/rest-api/rooms/create-room (privacy, exp, max_participants,
//          eject_at_room_exp, eject_after_elapsed, enable_recording, enable_transcription_storage, enable_chat, lang)
//   tokens: https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token
//   uso: GET /meetings (timeframe_start/end, room, limit, starting_after; participants[].duration em segundos)
// A Daily não tem propriedade de sala para "tirar quem ficou sozinho": isso é feito nas telas (sai sozinho
// depois de alguns minutos sem ninguém) e, ao encerrar, a sala é apagada (quem sobrou sai).

const API = 'https://api.daily.co/v1';

export const dailyConfigurada = () => !!process.env.DAILY_API_KEY;

async function chamar<T>(caminho: string, init?: RequestInit): Promise<{ ok: true; dados: T } | { ok: false; erro: string; status: number }> {
  const chave = process.env.DAILY_API_KEY;
  if (!chave) return { ok: false, erro: 'DAILY_API_KEY não configurada', status: 0 };
  try {
    const r = await fetch(`${API}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as T & { error?: string; info?: string };
    if (!r.ok) return { ok: false, erro: `${j.error ?? 'erro'}${j.info ? `: ${j.info}` : ''}`, status: r.status };
    return { ok: true, dados: j };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede', status: 0 };
  }
}

/** Cria a sala privada com as travas de custo. Entra só quem tiver token (gerado pelo nosso servidor). */
export async function criarSalaDaily(nome: string, expiraEm: Date, duracaoMaxMin: number, maxPessoas: number) {
  return chamar<{ name: string; url: string }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: nome,
      privacy: 'private',
      properties: {
        exp: Math.floor(expiraEm.getTime() / 1000),
        // Fase 2: configurável em Gastos › Configurações (padrão 6; a Daily aceita até 200).
        max_participants: maxPessoas,
        // Compartilhar tela (padrão da Daily já é true; explícito porque a sala depende disso).
        enable_screenshare: true,
        eject_at_room_exp: true,
        eject_after_elapsed: duracaoMaxMin * 60,
        // Gravação e transcrição da Daily desligadas: grava o navegador do Arthur. enable_recording só aceita
        // os modos (cloud, local...); sem a propriedade, a sala não grava.
        enable_transcription_storage: false,
        // O chat da sala é nosso (app messages da Daily); o chat pronto só existe no iframe da Daily.
        enable_chat: false,
        lang: 'pt-BR',
      },
    }),
  });
}

/** Token de entrada: vale até a sala expirar; o dono (Arthur) é is_owner. */
export async function tokenDaily(sala: string, nome: string, dono: boolean, expiraEm: Date, duracaoMaxMin: number) {
  const r = await chamar<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: sala,
        user_name: nome.slice(0, 60),
        is_owner: dono,
        exp: Math.floor(expiraEm.getTime() / 1000),
        eject_at_token_exp: true,
        eject_after_elapsed: duracaoMaxMin * 60,
      },
    }),
  });
  return r.ok ? { ok: true as const, token: r.dados.token } : r;
}

export async function apagarSalaDaily(sala: string) {
  return chamar<{ deleted?: boolean }>(`/rooms/${encodeURIComponent(sala)}`, { method: 'DELETE' });
}

type Sessao = { id: string; room: string; start_time: number; duration: number; ongoing: boolean; participants?: { duration?: number }[] };

/**
 * Minutos de participante entre duas datas (soma do tempo de cada pessoa em cada sessão), no total e por sala.
 * null = a Daily não respondeu.
 */
export async function minutosDaDaily(de: Date, ate: Date, sala?: string): Promise<{ total: number; porSala: Record<string, number> } | null> {
  const porSala: Record<string, number> = {};
  let total = 0;
  let depois: string | null = null;
  for (let pagina = 0; pagina < 50; pagina++) {
    const p = new URLSearchParams({
      timeframe_start: String(Math.floor(de.getTime() / 1000)),
      timeframe_end: String(Math.floor(ate.getTime() / 1000)),
      limit: '100',
    });
    if (sala) p.set('room', sala);
    if (depois) p.set('starting_after', depois);
    const r = await chamar<{ total_count: number; data: Sessao[] }>(`/meetings?${p}`);
    if (!r.ok) return null;
    for (const s of r.dados.data) {
      const seg = (s.participants ?? []).reduce((acc, x) => acc + Number(x.duration ?? 0), 0);
      porSala[s.room] = (porSala[s.room] ?? 0) + seg / 60;
      total += seg / 60;
    }
    if (r.dados.data.length < 100) break;
    depois = r.dados.data[r.dados.data.length - 1].id;
  }
  return { total, porSala };
}
