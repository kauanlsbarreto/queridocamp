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
            value: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/copadraft/rodadas',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
  assetPrefix: undefined,
};

export default nextConfig;