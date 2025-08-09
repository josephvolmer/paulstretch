/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/paulstretch' : '',
  images: {
    unoptimized: true
  },
  // Disable server-side features for static export
  trailingSlash: true,
}

module.exports = nextConfig