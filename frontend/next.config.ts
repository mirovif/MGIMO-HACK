import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async rewrites() {
    if (process.env.VERCEL) return []
    const origin = process.env.CAMPUS_API_URL || 'http://127.0.0.1:8000'
    return [{ source: '/api/:path*', destination: origin + '/api/:path*' }]
  },
}

export default config
