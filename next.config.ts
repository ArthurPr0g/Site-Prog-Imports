import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // 75 é o padrão e serve para miniatura e capa; 90 é para a foto grande do
    // produto, que tem zoom e é onde o cliente decide a compra. O Next só
    // aceita os valores declarados aqui.
    //
    // Cada tamanho e qualidade que o otimizador gera conta na cota da Vercel, e
    // ela já estourou uma vez: o site inteiro devolveu 402 nas imagens, não só
    // a que passou do limite. Antes de acrescentar qualidade ou tamanho aqui,
    // veja se o arquivo de origem não pode simplesmente nascer no tamanho em
    // que é exibido — foi o que resolveu as capas de coleção, que tinham
    // 1600×1200 e 4,8MB para aparecer num círculo de 312px.
    qualities: [75, 90],
  },
  experimental: {
    serverActions: {
      // O padrão do Next é 1MB, e foto de celular passa disso com folga. O
      // upload não falhava com mensagem: a action era recusada ANTES de rodar,
      // o erro subia sem tratamento e a tela inteira virava "Algo deu errado".
      //
      // 6MB deixa a régua do framework acima da regra da aplicação (5MB por
      // imagem), para quem manda depois disso receber a recusa explicada em vez
      // de perder a tela.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
