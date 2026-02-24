import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AICaffe - One Platform for All AI Models | AI Marketplace',
  description: 'Access 200+ AI models from OpenAI, Anthropic, Google, Meta & 22+ providers with one API. Compare models, save up to 40% vs direct subscriptions, and build faster with universal tokens.',
  keywords: 'AI marketplace, AI models, GPT-4, Claude, Gemini, Llama, AI API, AI comparison, AI pricing, ChatGPT alternative, AI assistant, AI platform',
  openGraph: {
    title: 'AICaffe - One Platform for All AI Models',
    description: 'Access 200+ AI models from 22+ providers. Compare, discover, and use AI at scale with universal tokens.',
    type: 'website',
    url: 'https://aicaffe.ai',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AICaffe - One Platform for All AI Models',
    description: 'Access 200+ AI models from 22+ providers with one API.',
  },
  robots: 'index, follow',
  alternates: {
    canonical: 'https://aicaffe.ai',
  },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
