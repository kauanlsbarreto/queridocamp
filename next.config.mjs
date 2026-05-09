/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mysql2'],
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
            value: 'public, max-age=60, s-maxage=180, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/copadraft/rodadas',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/copadraft/jogos',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=15, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/copadraft/desafiar/api',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=5, s-maxage=15, stale-while-revalidate=30',
          },
        ],
      },
    ];
  },
};

export default nextConfig;