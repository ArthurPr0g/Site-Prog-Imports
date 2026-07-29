import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Logout via route handler, não via server action. A action equivalente
// (signOutAction) derrubava a tela no error.tsx de /conta: ela limpa os
// cookies e o Next re-renderiza o segmento na mesma resposta, então o
// layout de /conta não achava mais usuário e disparava um segundo redirect
// concorrente. Aqui o POST responde 303 e o navegador navega sozinho — a
// árvore protegida nunca é re-renderizada.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);

  // Logout é uma ação com efeito, e um route handler não tem a checagem de
  // origem que o Next aplica em server actions. Sem isso, um site externo
  // poderia deslogar o visitante com um form escondido.
  const requestOrigin = request.headers.get('origin');
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse('Origem inválida.', { status: 403 });
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // best-effort: mesmo se falhar, manda o visitante pra home
  }

  // 303 força o navegador a trocar o POST por um GET no destino.
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
