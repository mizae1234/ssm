/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/reports/purchase',
        destination: '/reports/purchases',
        permanent: true,
      },
      {
        source: '/reports/sale',
        destination: '/reports/sales',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
