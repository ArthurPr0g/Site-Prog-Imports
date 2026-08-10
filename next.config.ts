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
