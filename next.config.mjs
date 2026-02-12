/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  bundlePagesRouterDependencies: true, 
  serverExternalPackages: ['mysql2'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;