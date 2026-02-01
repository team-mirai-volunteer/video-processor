/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@video-processor/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
};

module.exports = nextConfig;
