'use client';

import { nomeDaProposta, type PropostaDaLoja } from '@/lib/store-proposal';
import { desenharProposta, LARGURA, ALTURA } from '@/lib/store-proposal-canvas';
import { recortarProduto } from '@/lib/image-cutout';
import { PngPreviewModal, carregarImagem } from '@/components/admin/PngPreviewModal';

export function PropostaLojaModal({
  proposta,
  onFechar,
}: {
  proposta: PropostaDaLoja;
  onFechar: () => void;
}) {
  return (
    <PngPreviewModal
      titulo="Proposta para o cliente"
      subtitulo="Uma página, formato de celular. Só o resultado — custo, câmbio e margem ficam de fora."
      largura={LARGURA}
      altura={ALTURA}
      larguraExibida={330}
      nomeDoArquivo={nomeDaProposta(proposta.produto)}
      desenhar={async (ctx) => {
        // Em paralelo: a foto vem do storage e a logo do próprio site; esperar
        // uma para começar a outra dobraria o tempo até a prévia aparecer.
        const [logo, foto] = await Promise.all([
          carregarImagem('/images/logo.png'),
          carregarImagem(proposta.fotoUrl),
        ]);
        // O recorte devolve null quando o fundo não é liso — aí vale a foto
        // original, que ainda entra inteira, sem corte.
        const recorte = foto ? recortarProduto(foto) : null;
        desenharProposta(ctx, proposta, logo, recorte ?? foto);
      }}
      onFechar={onFechar}
      aviso={
        !proposta.fotoUrl ? (
          <div className="mb-4 rounded-control border border-warning/40 bg-warning/[0.07] px-4 py-3 text-[12.5px] text-fg-secondary">
            <strong>Sem foto do produto.</strong> A proposta sai com o espaço vazio. Para ter foto, ligue o
            orçamento a um produto do catálogo e cadastre uma imagem nele.
          </div>
        ) : undefined
      }
    />
  );
}
