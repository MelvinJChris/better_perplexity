/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output keeps the Cloud Run image small (see issue #21).
  output: 'standalone',
};

export default nextConfig;
