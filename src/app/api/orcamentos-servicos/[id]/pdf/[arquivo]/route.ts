// Mesmo PDF de ../route.ts, com o nome do arquivo no fim do endereço
// (/api/orcamentos-servicos/<id>/pdf/<nome>.pdf). O visualizador de PDF do
// Chrome e do Edge ignora o nome do Content-Disposition quando o arquivo abre
// na aba e salva com o fim da URL: sem este segmento, tudo saía "pdf.pdf". O
// segmento é só o nome; quem decide qual proposta sai é o id.
export { GET } from '../route';

// Configuração de rota precisa ser literal em cada arquivo (o Next não segue re-export).
export const runtime = 'nodejs';
