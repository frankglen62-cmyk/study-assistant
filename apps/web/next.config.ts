import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@study-assistant/ui', '@study-assistant/shared-types', '@study-assistant/shared-utils'],
  typedRoutes: true,
};

export default nextConfig;
