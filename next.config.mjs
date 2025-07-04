/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Remover estas linhas que podem causar problema:
  // output: 'standalone',
  // experimental: {
  //   serverComponentsExternalPackages: []
  // }
}

export default nextConfig

