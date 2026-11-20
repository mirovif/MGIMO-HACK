import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: resolve(__dirname, '..') },
  async rewrites() {
    const site = [{ source: '/', destination: '/preview/05.html' }]
    if (process.env.VERCEL) return site
    const origin = process.env.CAMPUS_API_URL || 'http://127.0.0.1:8000'
    return [...site, { source: '/api/:path*', destination: origin + '/api/:path*' }]
  },
}

export default config
