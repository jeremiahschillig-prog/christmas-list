import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos are shrunk in the browser before upload (to about 1600 px, well
      // under 1 MB), so this is headroom, not an invitation. Vercel's own
      // request limit is 4.5 MB.
      bodySizeLimit: '4mb',
    },
  },
}

export default nextConfig
