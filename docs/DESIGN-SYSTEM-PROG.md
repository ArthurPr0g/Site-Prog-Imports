# Prog Soluções — Design System v1.0 (out/2026)
Extraído de "Prog Soluções - Identidade/Design System.html" (Claude Design). Texto completo em texto.txt nesta pasta.

## Princípios
1. A construção aparece: grade, guias, cotas e círculo tracejado são linguagem da marca (tamanhos grandes e momentos de espera).
2. Um acento, com disciplina: azul matiz 262 só no arco do P, no progresso e no item ativo. Todo o resto é neutro.
3. Um relógio para o movimento; três curvas, nenhuma outra.

## Cores (variáveis --ps-*)
Fundos: ink #08080A (principal) · panel #0D0E13 (sidebar, tab bar) · surface #12141A (modais, sheets, cards elevados) · tile-dark #0B0C10 (ladrilho da planta) · paper #F2F3F5 (tema claro, botão sólido) · white #FFFFFF (documentos).
Acento: accent #81AAF7 (arco, eyebrows, progresso) · accent-soft #91B7FE (links) · accent-strong #B1D2FF (guias, cotas, item ativo) · accent-dark #3860AC (tema claro).
Fundo do item ativo oklch(72% .1 262 / .14); badge / .18; borda do ladrilho oklch(74% .12 262 / .4).
Texto no escuro: text #F4F5F7 (títulos) · body #ECEEF1 (texto corrido) · muted-1 #D7DAE0 (botão secundário) · muted #A3A8B2 (descrições) · nav #9BA1AB (menu) · muted-2 #8B919B (apoio) · dim #6D727C (só rótulos mono/decorativos).
Tema claro: ink no texto, muted-dark #5D626B, accent-dark.
Fora da marca: ciano #43D5DC só no gradiente de destaque de texto; verde #5FD37F só status; roxo #62488C só aura a 22%.

## Tipografia
Sora (títulos/logo, 600; 400 em "Soluções" e itálicos) · DM Sans (texto, interface, botões 400/500/600) · JetBrains Mono (rótulos, %, cotas; nunca no logo).
Display XL Sora 600 88/1.04 −0.045em (mobile 48) · Display 64/1.05 −0.045em · Título 1 44/1.06 −0.04em · Título 2 32/1.1 −0.035em · Título 3 22/1.25 −0.02em · Lead DM Sans 18/1.6 · Corpo 15/1.65 · Pequeno 13.5/1.55 · Eyebrow Mono 500 11 +0.24em CAIXA ALTA · Rótulo/número Mono 400 12 +0.08em.
Itálico com gradiente (#B1D2FF → #43D5DC, 120°): 1–2 palavras por título, no máximo um por tela.

## Espaço e forma
Espaçamento base 4 (--ps-space-N = N×4): 4, 8, 12, 16, 24, 32, 40, 56, 72, 96.
Raios: 6 badge · 14 campo · 20 painel · 24 card · 32 modal · 999 pílula.
Container máx. 1280; margens 96 (1920) / 64 (1280) / 20 (mobile); seções 72–96 de respiro.
Card padrão: gradiente branco .05 → .015, borda branca .09, sem sombra.
Elevado: #12141A, borda .14, sombra 0 40px 120px rgba(0,0,0,.55). Elevado no claro: #FFF, 0 30px 70px rgba(8,8,10,.10).
Aura + grade: radial azul .30, grade 74 px com máscara radial.

## Componentes
Botões: altura 52 (padrão), 40 (pequeno), 54 largura total no mobile; um botão sólido (paper) por área; secundário com contorno; link "Ver projetos →". Hover 150 ms curva enter.
Pílulas/badges, campo (raio 14, foco com acento), cabeçalho (item ativo accent-strong 600, hover text), navegação lateral de sistema (item ativo com fundo oklch(72% .1 262/.14)), card de projeto, card de KPI ("Receita do mês"), skeleton.
Carregamento: barra de 3 px, sempre com texto dizendo o que está acontecendo ("Sincronizando CRM", nunca "Aguarde…").

## Movimento
O arco do P é spinner (loop 1,3 s, círculo a 90°/s) e barra de progresso. Nenhum loader genérico entra no sistema.
enter cubic-bezier(0.16,1,0.3,1): chegadas e voos · draw cubic-bezier(0.65,0,0.35,1): traços, fades, saídas · pop cubic-bezier(0.34,1.56,0.64,1): só o que nasce (haste, cards de carregamento, bottom sheet).
Hover/press 150 ms enter · entrada 600–800 ms enter subindo 10–14 px · stagger 60 ms (menu) / 120 ms (linhas de título) · voo da logo 800 ms enter · círculo de transição 1000 ms draw · reduced-motion: símbolo sólido + fade 200 ms.

## Iconografia e voz
Lucide, traço 1,5 px, 20 px na interface (24 na nav mobile); cor nav #9BA1AB, ativo accent-strong; o ícone nunca leva o azul do arco. Status = ponto verde com brilho.
Sem emoji, sem exclamação; CTA curto com verbo; caixa alta só nos rótulos mono.
