# Time de agentes da Prog Soluções (30/10/2026)

> Página visual com o time, o fluxograma animado e todas as funções: **/admin/time** (menu da Prog Soluções → Time e fluxo).

Pedido do Arthur: o que acontece depois da venda (cobrar e começar de fato o trabalho) é feito por **agentes
separados**, cada um com nome próprio e instruções próprias, no Claude Design e no Claude Code.
A **Lia** continua sendo a única que fala com o cliente; os outros trabalham por trás e respondem ao Arthur.

## Quem é quem

| # | Agente | Faz | Onde roda | Quando entra | Instruções |
|---|---|---|---|---|---|
| 1 | **Lia** | Atende, vende e manda o link do sinal na conversa | Servidor (WhatsApp) | Cliente chama / lead novo | `src/lib/atendente/` |
| 2 | **Téo** | Cobranças: confere pagamentos, gera a da entrega e a mensalidade | Claude Code (`teo-cobrancas`) | Pedido do Arthur | `agentes/claude-code/teo-cobrancas.md` |
| 3 | **Bia** | Abre o projeto: pasta do cliente, briefing, pedidos para Duda e Nina | Claude Code (`bia-abertura`) | **Automático** quando o sinal é pago | `agentes/claude-code/bia-abertura.md` |
| 4 | **Duda** | Identidade visual: paleta, fontes, componentes, uso do logo | Claude Design | Arthur cola o `PEDIDO-DUDA.md` | `agentes/claude-design/duda-identidade.md` |
| 5 | **Nina** | Protótipo navegável das telas + handoff para o Claude Code | Claude Design | Depois da Duda | `agentes/claude-design/nina-prototipo.md` |
| 6 | **Rafa** | Constrói o site/loja a partir do handoff, repositório e prévia | Claude Code (`rafa-construcao`) | "Rafa, constrói o projeto do X" | `agentes/claude-code/rafa-construcao.md` |
| 7 | **Vera** | Vistoria: build, celular, pacote vendido, protótipo. Não altera código | Claude Code (`vera-vistoria`) | Depois do Rafa ou do Leo | `agentes/claude-code/vera-vistoria.md` |
| 7b | **Caio** | Revisão de código: bugs, erros silenciosos, código duplicado, tipos. Não altera código | Claude Code (`caio-revisao`) | Vistoria completa | `agentes/claude-code/caio-revisao.md` |
| 7c | **Íris** | Cibersegurança: chaves expostas, banco (RLS), cabeçalhos, bibliotecas, formulários, LGPD. Só verificações não destrutivas do próprio cliente | Claude Code (`iris-seguranca`) | Vistoria completa | `agentes/claude-code/iris-seguranca.md` |
| 7d | **Tito** | Testes automáticos (Playwright em `tests/`), Lighthouse no celular, links quebrados. Só escreve testes | Claude Code (`tito-testes`) | Vistoria completa | `agentes/claude-code/tito-testes.md` |
| 8 | **Leo** | Ajustes pedidos pelo cliente, só na pasta do projeto dele | Claude Code (`leo-ajustes`) | **Automático** quando o cliente pede ajuste à Lia | `agentes/claude-code/leo-ajustes.md` |
| 9 | **Gabi** | Entrega: prévia para aprovação, publicação final, Pós-venda, case | Claude Code (`gabi-entrega`) | Depois da vistoria completa | `agentes/claude-code/gabi-entrega.md` |

## A ordem

```
Lia vende ─▶ cliente paga o sinal (Asaas)
              └─▶ [automático] prestação aberta + Lia pede o material + Bia na fila do PC
Bia abre o projeto ─▶ Arthur cola o pedido no Claude Design ─▶ Duda (identidade) ─▶ Nina (telas + handoff)
Handoff salvo em handoff/ ─▶ Rafa constrói ─▶ vistoria completa (Vera + Caio + Íris + Tito, juntos) ─▶ Gabi prepara a entrega
Cliente aprova ─▶ Gabi publica e registra ─▶ Téo gera a cobrança da entrega (Arthur confirma) ─▶ Lia manda
Depois: cliente pede ajuste à Lia ─▶ [automático] Leo ─▶ Lia avisa o cliente
```

## Como chamar um agente
- Pelo WhatsApp da Lia: **"Claude, Rafa, constrói o projeto do <cliente>"** (vai para a fila do PC como qualquer pedido).
- **Vistoria completa** (os 4 de qualidade de uma vez): "Claude, vistoria completa do <cliente>" — o Claude Code chama Vera, Caio, Íris e Tito em paralelo e junta os vereditos.
- Numa sessão do Claude Code: "use a Vera para conferir o projeto do <cliente>" (ou `@vera-vistoria`).
- Os avisos de "Comecei" e "Pedido concluído" no WhatsApp mostram **🤖 Agente: <nome>** quando o pedido veio de um agente.

## Onde os agentes ficam instalados
- Fonte (com backup no Git): `agentes/claude-code/*.md` e `agentes/claude-design/*.md` neste repositório.
- Claude Code: copiados para `C:\Users\arthu\.claude-lm\agents\` (conta que o executor do PC usa), então valem em qualquer pasta,
  inclusive na pasta exclusiva do cliente. Mudou um arquivo aqui? Rode `scripts/agentes/instalar.ps1`.
- Claude Design não tem agentes salvos por arquivo: cada agente é um **projeto com o texto de instruções** da Duda ou da Nina
  (a Bia já entrega o texto preenchido por cliente). O Claude Design avulso (claude.ai/design) fecha em 14/12/2026 e passa a
  viver dentro do Claude; o texto serve nos dois.

## Na fila do PC (técnico)
- `public.ideias` com `origem = 'agente'` e `agente = <chave>` (migration 0103). Chaves e nomes em `src/lib/agentes/time.ts`.
- O texto do pedido começa com "Use o subagente <nome>": o executor (`.claude-lm/hooks/executar-prompts.mjs`) roda o Claude Code
  normalmente e ele delega ao agente certo.
- Sinal pago → `src/app/api/asaas/webhook/route.ts` chama `pedirAoAgente(db, 'bia', ...)`.
- Ajuste do cliente → `src/lib/atendente/agente.ts` (`pedir_ajuste`) grava `agente = 'leo'`.

## O que nenhum agente faz
Senhas, cartão, documentos, pagamentos e transferências, aceitar termos; mensagem ao cliente fora da Lia; criar Supabase de cliente
sem o Arthur pedir; marcar entrega ou mandar cobrança sem o OK dele.
