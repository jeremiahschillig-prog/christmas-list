import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

// Fraunces for names and titles, Inter for everything else (style B, Plum & Rose Gold).
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], weight: ['400', '600'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family List',
  description: 'The family Christmas list',
  appleWebApp: { capable: true, title: 'Family List', statusBarStyle: 'default' },
}

// Fills the iPhone screen and stops pinch-zoom, so it feels like an app.
export const viewport: Viewport = {
  themeColor: '#FBF7F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
