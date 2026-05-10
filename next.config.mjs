/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mysql2', '@tensorflow-models/body-pix'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/minhas-compras$ID-:id',
        destination: '/minhas-compras/ID-:id',
      },
      {
        source: '/pagamentos-pendentes$ID-:id',
        destination: '/pagamentos-pendentes/ID-:id',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/copadraft/times',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/copadraft/rodadas',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/copadraft/jogos',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        source: '/copadraft/desafiar/api',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;