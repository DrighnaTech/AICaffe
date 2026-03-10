'use client'

import { useState, useCallback } from 'react'
import { PenTool, Type, ArrowRight } from 'lucide-react'
import { WorkshopChat } from '@/components/workshop/WorkshopChat'
import toast from 'react-hot-toast'

// ── Config ────────────────────────────────────────────────────────────────
const TONES = ['Professional', 'Casual', 'Academic', 'Creative', 'Persuasive'] as const
const CONTENT_TYPES = ['Blog Post', 'Email', 'Essay', 'Marketing Copy', 'Social Media', 'Documentation'] as const

type Tone = typeof TONES[number]
type ContentType = typeof CONTENT_TYPES[number]

// ── Page ──────────────────────────────────────────────────────────────────
export default function ContentForgePage() {
  const [content, setContent] = useState('')
  const [tone, setTone] = useState<Tone>('Professional')
  const [contentType, setContentType] = useState<ContentType>('Blog Post')
  const [lastSuggestion, setLastSuggestion] = useState<string | null>(null)

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  const handleResponse = useCallback((response: string) => {
    setLastSuggestion(response)
  }, [])

  const handleApplySuggestion = () => {
    if (lastSuggestion) {
      setContent(lastSuggestion)
      toast.success('Applied to editor')
    }
  }

  const systemPrompt = `You are an expert content writer and editor. The user is working on a ${contentType} with a ${tone.toLowerCase()} tone.

${content ? `Current draft (${wordCount} words):
---
${content.slice(0, 3000)}${content.length > 3000 ? '\n...(truncated)' : ''}
---` : 'The editor is empty — the user has not started writing yet.'}

Help with:
- Writing, rewriting, and expanding content
- Improving clarity, flow, and engagement
- Adjusting tone to match the selected style (${tone})
- Fixing grammar, punctuation, and structure
- Generating outlines, headlines, and CTAs

When providing revised content, output the FULL text (not just the changes) so the user can apply it directly. Format as clean markdown.`

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <PenTool className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Content Forge</h1>
            <p className="text-[10px] text-gray-500">AI-powered writing assistant</p>
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main: Content Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 flex-shrink-0">
            {/* Tone selector */}
            <div className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">Tone:</span>
              <div className="flex gap-1">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      tone === t
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-gray-700" />

            {/* Content type */}
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-pink-500"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>

            {/* Apply suggestion button */}
            {lastSuggestion && (
              <>
                <div className="h-4 w-px bg-gray-700" />
                <button
                  onClick={handleApplySuggestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/20 transition-colors"
                >
                  <ArrowRight className="w-3 h-3" />
                  Apply AI suggestion
                </button>
              </>
            )}

            {/* Word count */}
            <span className="ml-auto text-xs text-gray-600">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </div>

          {/* Text editor */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Start writing your ${contentType.toLowerCase()} here...\n\nTip: Use the AI chat on the right to help you write, rewrite, or improve your content. The AI can see your current draft and selected tone.`}
              className="w-full h-full px-8 py-6 bg-transparent text-gray-200 text-sm leading-relaxed placeholder-gray-600 resize-none focus:outline-none"
              style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
            />
          </div>
        </div>

        {/* Chat Panel */}
        <WorkshopChat
          systemPrompt={systemPrompt}
          contextLabel={`${contentType} · ${tone} · ${wordCount}w`}
          providerPriority={['groq', 'google', 'mistral']}
          accentColor="pink"
          onResponse={handleResponse}
          queryKeySuffix="content-forge"
        />
      </div>
    </div>
  )
}
