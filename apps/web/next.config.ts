import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ufc/ui', '@ufc/schemas', '@ufc/db'],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
