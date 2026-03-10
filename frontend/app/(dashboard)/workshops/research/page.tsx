'use client'

import { useState, useCallback } from 'react'
import {
  FlaskConical, Search, FileText, ExternalLink,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { WorkshopChat } from '@/components/workshop/WorkshopChat'
import { Button } from '@/components/ui/Button'

// ── Page ──────────────────────────────────────────────────────────────────
export default function ResearchLabPage() {
  const [topic, setTopic] = useState('')
  const [researchOutput, setResearchOutput] = useState<string | null>(null)
  const [isResearching, setIsResearching] = useState(false)

  // When chat produces a response, show it in the main panel too
  const handleResponse = useCallback((content: string) => {
    setResearchOutput(content)
    setIsResearching(false)
  }, [])

  const systemPrompt = `You are an expert research analyst. The user is conducting research${topic ? ` on: "${topic}"` : ''}.

Structure every response with these sections:
## Key Findings
- Concise bullet points of the most important discoveries

## Analysis
Detailed analysis with context and nuance

## Sources & References
List credible sources, papers, or references where applicable

## Conclusion
Brief synthesis of findings

Be thorough, cite specifics, and distinguish between established facts and emerging theories. If you don't know something, say so clearly rather than speculating.`

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
            <FlaskConical className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Research Lab</h1>
            <p className="text-[10px] text-gray-500">Deep research with structured analysis</p>
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main: Research Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topic input */}
          <div className="border-b border-gray-800 p-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <label className="block text-xs font-medium text-gray-400 mb-2">Research Topic</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Impact of transformer architecture on NLP since 2017"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Research output */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {researchOutput ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white m-0">Research Results</h3>
                    {topic && (
                      <span className="text-xs text-gray-500 ml-auto">{topic}</span>
                    )}
                  </div>
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" className="rounded-lg !bg-gray-900 !mt-2 !mb-2" {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm" {...props}>{children}</code>
                        )
                      },
                      a({ href, children, ...props }: any) {
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1" {...props}>
                            {children}<ExternalLink className="w-3 h-3" />
                          </a>
                        )
                      },
                    }}
                  >
                    {researchOutput}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <FlaskConical className="w-8 h-8 text-cyan-400/50" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-2">Start your research</h2>
                  <p className="text-gray-500 text-sm max-w-sm">
                    Enter a topic above and ask questions in the chat panel.
                    Results will appear here with structured findings, analysis, and sources.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <WorkshopChat
          systemPrompt={systemPrompt}
          contextLabel={topic ? `Topic: ${topic}` : 'No topic set'}
          providerPriority={['groq', 'google', 'openrouter']}
          accentColor="cyan"
          onResponse={handleResponse}
          queryKeySuffix="research-lab"
        />
      </div>
    </div>
  )
}
