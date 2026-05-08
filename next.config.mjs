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
  assetPrefix: undefined,
};

export default nextConfig;