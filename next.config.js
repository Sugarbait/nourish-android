/** @type {import('next').NextConfig} */
const { version } = require('./package.json');
const nextConfig = {
  output: 'export',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: [],
    dangerouslyAllowSVG: true,
  },
}

module.exports = nextConfig