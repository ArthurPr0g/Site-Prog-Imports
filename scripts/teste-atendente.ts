// Conferência das regras puras do atendente (rodar: npx tsx scripts/teste-atendente.ts).
import { calcularProposta, emailDaEtapa, empresaDoTexto, textoDoBotao, placar } from '../src/lib/atendente/regras';
import { TABELA_USD, type TabelaPrecos } from '../src/lib/precos-captacao';

const BRL: TabelaPrecos = { moeda: 'BRL', fim: 97, site: [[997, 99], [2997, 149], [4997, 199]], loja: [[1997, 149], [3997, 199], [6997, 249]], erp: [[2997, 149], [4997, 199], [7997, 299]], marca: [497, 797, 1497] };
let falhas = 0;
const confere = (nome: string, real: unknown, esperado: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? 'ok ' : 'ERRO'} ${nome}: ${JSON.stringify(real)}${ok ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
};
const site = { produto: 'site' as const, nivel: 1 as const, comGestao: false, nivelGestao: 0 as const, marca: 0 as const };
confere('sem desconto extra', calcularProposta(site, BRL, 0).totalComExtra, 2997);
confere('8% em 2.997 (não vira 10%)', calcularProposta(site, BRL, 8).totalComExtra, 2757);
confere('10% em 2.997', calcularProposta(site, BRL, 10).totalComExtra, 2697);
confere('5% em 997', calcularProposta({ ...site, nivel: 0 }, BRL, 5).totalComExtra, 947);
const combo = calcularProposta({ ...site, comGestao: true, nivelGestao: 1 }, BRL, 0);
confere('combo site+gestão mesmo nível tem desconto', combo.desconto > 0, true);
confere('mensalidade do combo é a maior (gestão R$ 199)', combo.mensal, 199);
confere('desconto extra nunca na mensalidade', calcularProposta(site, BRL, 10).mensal, 149);
confere('EUA termina em 0', calcularProposta(site, TABELA_USD, 7).totalComExtra % 10, 0);
confere('empresa no texto do botão', empresaDoTexto(textoDoBotao('Casa Sinergia - Yoga', 'Lia', false)), 'Casa Sinergia - Yoga');
confere('empresa no botão em inglês', empresaDoTexto(textoDoBotao('Bright Dental', 'Lia', true)), 'Bright Dental');
confere('texto qualquer não acha empresa', empresaDoTexto('oi, quanto custa?'), null);
const e = emailDaEtapa(0, { persona: 'Lia', empresa: 'Casa Sinergia', problema: 'vi que vocês ainda não têm site', elogio: '', diagnostico: 'https://x/d', whatsapp: 'https://wa.me/1', ingles: false });
confere('e-mail tem opt-out e endereço', /responder "não"/.test(e.corpo) && /Alameda Botafogo/.test(e.corpo), true);
console.log('\n--- e-mail de primeiro contato ---\nAssunto: ' + e.assunto + '\n\n' + e.corpo);
const p = placar(
  [{ chave: 'felipe', nome: 'Felipe', ia: false, leadIds: ['a', 'b'] }, { chave: 'ia', nome: 'Lia', ia: true, leadIds: ['c', 'd'] }],
  [
    { id: 'a', status: 'contatado', firstContactAt: '2026-10-01', repliedAt: null, closedAt: null },
    { id: 'b', status: 'novo', firstContactAt: null, repliedAt: null, closedAt: null },
    { id: 'c', status: 'fechado', firstContactAt: '2026-10-01', repliedAt: '2026-10-02', closedAt: '2026-10-03' },
    { id: 'd', status: 'respondeu', firstContactAt: '2026-10-01', repliedAt: '2026-10-02', closedAt: null },
  ],
  () => ({ unico: 2997, mensal: 149 })
);
confere('placar: IA na frente com 1 fechado', [p[0].nome, p[0].fechados, p[0].taxaFechamento, p[0].taxaResposta], ['Lia', 1, 0.5, 1]);
confere('placar: Felipe 1 contatado de 2', [p[1].contatados, p[1].taxaResposta], [1, 0]);
process.exit(falhas ? 1 : 0);
