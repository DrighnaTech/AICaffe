import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AICaffe - The AI Marketplace',
  description: 'One platform for all AI models. Compare, discover, and use AI from every provider.',
  keywords: 'AI, marketplace, GPT, Claude, Gemini, AI models, comparison, tokens',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
