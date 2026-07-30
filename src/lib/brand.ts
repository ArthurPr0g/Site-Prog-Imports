// Identidade da loja, em um lugar só.
//
// Este módulo existe para que uma loja nova seja uma configuração, não um fork:
// tudo que muda de cliente para cliente é lido de variável de ambiente, com os
// valores da Prog Imports como padrão. Sem nenhuma variável definida, o site se
// comporta exatamente como antes — é isso que torna a extração segura.
//
// Por que ambiente e não banco: a cor de destaque precisa existir no primeiro
// byte de HTML renderizado. Se viesse de consulta, a página pintaria na cor
// errada e corrigiria depois, piscando. Ambiente resolve em build/boot, custa
// zero e já é isolado por deploy.
//
// Contato, frete e canais continuam em `constants.ts`, que já os lia de
// ambiente antes desta mudança.

const DEFAULT_ACCENT = '#F28705';

/** Aceita apenas hexadecimal (#rgb, #rrggbb, #rrggbbaa). O valor entra numa
 *  custom property inline no <html>; validar evita que uma variável mal
 *  preenchida injete CSS arbitrário ou simplesmente quebre o tema inteiro. */
function parseHexColor(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate) ? candidate : fallback;
}

export const BRAND = {
  /** Nome completo, usado em títulos e textos institucionais. */
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Prog Imports',
  /** Nome curto, para espaços apertados (logo, cabeçalho do assistente). */
  shortName: process.env.NEXT_PUBLIC_BRAND_SHORT_NAME || 'Prog',
  /** Frase de posicionamento — aparece em metadados e no institucional. */
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Tecnologia Importada Premium',
  /** Cor de destaque. Única cor que muda por cliente hoje. */
  accent: parseHexColor(process.env.NEXT_PUBLIC_BRAND_ACCENT, DEFAULT_ACCENT),
} as const;

/** Injetado como `style` no <html>. O `globals.css` faz o token de tema apontar
 *  para esta custom property, então trocar a cor da loja não exige tocar em
 *  nenhum componente. */
export const brandCssVars = {
  '--brand-accent': BRAND.accent,
} as React.CSSProperties;
