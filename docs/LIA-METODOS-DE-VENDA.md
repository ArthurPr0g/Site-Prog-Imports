# Lia: métodos de venda (pesquisa de 28/10/2026)

Pedido do dono: procurar técnicas, métodos e recursos que a Lia possa aprender para levar o
cliente ao fechamento. Pesquisa com fontes; números de fornecedores (Gong, Closeable) vêm de
ligações B2B ou SMS nos EUA: servem como direção, não como promessa.

## Já aplicado no prompt (`src/lib/atendente/prompt.ts`), em 28/10

| # | O quê | Base |
|---|---|---|
| 1 | **Objeção:** reconhecer + UMA pergunta antes de argumentar (LAER); FAQ em até 2 frases; 2ª vez → oferecer o Arthur | Gong: os melhores fazem pergunta em 54,3% das objeções contra 31,0% dos medianos ([Gong](https://www.gong.io/blog/handling-sales-objections)); textão na objeção de preço vira "não, obrigado" ([Closeable](https://blog.closeable.co/we-analyzed-100-000-texts-with-customers-heres-what-converts/)) |
| 2 | **Descoberta pelo diagnóstico + gap:** abrir com UM achado, perguntas de impacto (SPIN), registrar `estadoAtual`, `estadoDesejado`, `custoDoGap` (novos campos do checklist, que também aparecem para o Felipe); investimento só depois do custo do gap | SPIN, ~35 mil visitas ([Huthwaite](https://www.huthwaiteinternational.com/blog/neil-rackham-research-spin)); Gap Selling; preço depois do valor ([Gong](https://www.gong.io/?p=25330)) |
| 3 | **Fechamento:** resumo + escolha entre dois próximos passos reais ("garantir com o sinal ou 20 min com o Arthur"); nada de fechamento presumido nem urgência falsa | Rackham ("avanço"); compromisso combinado |
| 4 | **Tamanho:** espelhar o cliente (até ~1,5× a mensagem dele, 3 linhas), terminar com uma pergunta | Closeable: 37% de fechamento com tamanho parecido contra 32% bem mais longo; 28% com pergunta contra 24% sem |
| 5 | **Humano e transparência:** gatilhos claros para chamar o Arthur (objeção não resolvida 2×, cláusula, projeto acima de R$ 10 mil) e avisar quando ele responde; confirmar ser IA com naturalidade e compensar com competência | A política do WhatsApp exige caminho de escalonamento ([política](https://whatsappbusiness.com/pt-br/policy/)); 87% querem acesso a humano ([Gartner 2026](https://www.gartner.com/en/newsroom/press-releases/2026-08-04-gartner-survey-finds-87-percent-of-customers-say-companies-using-genai-for-customer-service-must-provide-access-to-a-human-agent0)); revelar o robô antes da conversa reduziu compras em 79,7% ([Luo et al. 2019](https://ideas.repec.org/a/inm/ormksc/v38y2019i6p937-947.html)), daí a regra de competência, nunca de esconder |
| + | Contrato inicial do Sandler na abertura ("tudo bem se não fizer sentido"); prova social só com caso real; sem escassez falsa | Cialdini, com o que é manipulação descartado |
| + | Cache do prompt com validade de 1 h (custo e velocidade, não conversão) | [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) |

Descartados por serem manipulação: reverso negativo do Sandler, NEPQ "cutucando a dor",
fechamento presumido, "de R$ X por R$ Y" fictício, prazo ou vaga falsa, depoimento inventado.
MEDDIC não serve (feito para vendas corporativas com vários decisores).

## Próximos (ordem de impacto ÷ esforço)

| # | O quê | Esforço | Observação |
|---|---|---|---|
| 6 | Botões e listas nos pontos de decisão (`enviar_opcoes`: até 3 botões ou lista de até 10) | baixo | Sem custo extra. [Meta](https://developers.facebook.com/blog/post/2022/11/21/sending-interactive-messages/) |
| 7 | Transcrever áudio recebido | baixo/médio | Na nuvem, cerca de US$ 0,003/min (conferir preço oficial). Hoje ela pede para digitar. |
| 8 | `buscar_caso(nicho, cidade)`: casos reais do portfólio com imagem | médio | Precisa da base de casos com autorização dos clientes. |
| 9 | Opt-in na conversa + modelos aprovados para retomar depois de 24 h | médio | Marketing no Brasil cerca de US$ 0,07/msg; utilidade cerca de US$ 0,007 ([preços](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). |
| 10 | Funil por etapa + juiz automático com rubrica + revisão semanal de 30 min | médio | Calibrar o juiz com 20 conversas avaliadas pelo Arthur ([Anthropic](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests), [Zheng et al.](https://arxiv.org/html/2306.05685v4)). |
| — | Agenda real (Google Calendar livre/ocupado + Meet), proposta em PDF, WhatsApp Flows (agendamento/briefing), Pix no chat (Payments API Brasil), testes de conversa com clientes simulados | médio/alto | Depois do básico funcionando com clientes reais. |

## Lacunas (não achadas em fonte confiável)

Conversão por metodologia em vendas por texto para pequenas empresas brasileiras; preferência
de áudio contra texto em vendas no Brasil; número ideal de retomadas; impacto de proposta em PDF;
custo por conversa de anúncio Click-to-WhatsApp com fonte independente.
