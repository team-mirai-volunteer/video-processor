/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@video-processor/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
