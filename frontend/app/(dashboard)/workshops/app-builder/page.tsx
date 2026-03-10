'use client'

import { useState, useCallback } from 'react'
import { Rocket, CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { WorkshopChat } from '@/components/workshop/WorkshopChat'

// ── Phase definitions ─────────────────────────────────────────────────────
const PHASES = [
  {
    id: 1, name: 'Discovery & Scoping',
    desc: 'Understand what to build — smart questioning leads to a clear PRD.',
    deliverables: ['Product Requirements Document', 'User stories', 'Success metrics'],
  },
  {
    id: 2, name: 'Architecture & Design',
    desc: 'System design, tech stack selection, and architectural decisions.',
    deliverables: ['System architecture diagram', 'Tech stack ADR', 'Database schema'],
  },
  {
    id: 3, name: 'Development & Iteration',
    desc: 'Code scaffolding, API development, frontend, and integration.',
    deliverables: ['Project scaffolding', 'API endpoints', 'Frontend components', 'Integration'],
  },
  {
    id: 4, name: 'Testing & QA',
    desc: 'Unit tests, integration tests, security review, and QA report.',
    deliverables: ['Test suites', 'Security audit', 'QA report', 'Performance benchmarks'],
  },
  {
    id: 5, name: 'Deployment & DevOps',
    desc: 'CI/CD pipeline, container config, and multi-target deployment.',
    deliverables: ['Dockerfile', 'CI/CD pipeline', 'Environment configs', 'Deploy scripts'],
  },
  {
    id: 6, name: 'Post-Launch & Evolution',
    desc: 'Monitoring setup, error triage, and feature iteration.',
    deliverables: ['Monitoring dashboard', 'Alert rules', 'Iteration roadmap'],
  },
]

const PHASE_PROMPTS: Record<number, string> = {
  1: `You are a senior tech lead conducting a Discovery & Scoping session. Your goal is to understand what the user wants to build.

Ask smart, specific questions to understand:
- What problem does this app solve? Who is the target user?
- What are the core features (MVP)? What's nice-to-have?
- What platforms (web, mobile, both)?
- Any integrations needed (payment, auth, APIs)?
- What's the timeline and scale expectations?

Ask questions ONE AT A TIME. After gathering enough info (usually 4-6 questions), generate a concise Product Requirements Document (PRD) with: Overview, Target Users, Core Features, Technical Requirements, Success Metrics.

Be conversational but efficient. Think like a senior tech lead, not a chatbot.`,

  2: `You are a senior solution architect. The Discovery phase is complete.

Based on what you know about the project, help with:
- System architecture design (frontend, backend, database, infra)
- Tech stack selection with reasoning
- Database schema design
- API endpoint planning
- Architectural Decision Records (ADRs) for key choices

Present technical decisions clearly with trade-offs explained. Use diagrams (markdown/ASCII) where helpful.`,

  3: `You are a senior full-stack developer. Architecture is finalized.

Help with:
- Project scaffolding and folder structure
- Writing actual code (models, controllers, routes, components)
- Database migration scripts
- API implementation
- Frontend component code
- Integration between services

Write production-quality code. Use modern patterns and best practices.`,

  4: `You are a QA engineer and security specialist.

Help with:
- Writing unit and integration tests
- Security review and vulnerability scanning suggestions
- Performance testing strategies
- Creating a QA report with test coverage
- Edge case identification`,

  5: `You are a DevOps engineer.

Help with:
- Dockerfile and docker-compose configuration
- CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
- Environment configuration (dev, staging, prod)
- Deployment to cloud providers (Vercel, Railway, AWS, GCP)
- SSL, domain, and DNS setup`,

  6: `You are a site reliability engineer.

Help with:
- Monitoring and observability setup
- Error tracking and alerting
- Performance optimization
- Feature iteration planning
- Post-launch checklist`,
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function AppBuilderPage() {
  const [activePhase, setActivePhase] = useState(1)
  const [phaseOutputs, setPhaseOutputs] = useState<Record<number, string>>({})

  const handleResponse = useCallback((content: string) => {
    setPhaseOutputs((prev) => ({
      ...prev,
      [activePhase]: content,
    }))
  }, [activePhase])

  const currentPhase = PHASES.find((p) => p.id === activePhase)!
  const phasePrompt = PHASE_PROMPTS[activePhase]

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
            <Rocket className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">App Builder</h1>
            <p className="text-[10px] text-gray-500">Idea to Deployment Pipeline</p>
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main: Phase tracker + output */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Phase timeline bar */}
          <div className="border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center px-4 py-2 gap-1 overflow-x-auto">
              {PHASES.map((phase, i) => {
                const hasOutput = !!phaseOutputs[phase.id]
                const isActive = phase.id === activePhase
                return (
                  <button
                    key={phase.id}
                    onClick={() => setActivePhase(phase.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : hasOutput
                        ? 'bg-gray-800/50 text-emerald-400/70 hover:bg-gray-800'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                    }`}
                  >
                    {hasOutput ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Circle className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-gray-600'}`} />
                    )}
                    <span>{phase.name}</span>
                    {i < PHASES.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-gray-700 ml-1" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Phase detail + output */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {/* Phase info */}
              <div className="flex items-start gap-4 mb-6 pb-4 border-b border-gray-800">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-emerald-400">{activePhase}</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{currentPhase.name}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{currentPhase.desc}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {currentPhase.deliverables.map((d) => (
                      <span key={d} className="text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-full text-gray-400">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase output */}
              {phaseOutputs[activePhase] ? (
                <div className="prose prose-invert prose-sm max-w-none">
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
                    }}
                  >
                    {phaseOutputs[activePhase]}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                    <Rocket className="w-6 h-6 text-emerald-400/50" />
                  </div>
                  <p className="text-gray-500 text-sm max-w-sm">
                    {activePhase === 1
                      ? 'Tell the AI what you want to build in the chat panel. It will ask smart questions and generate a PRD.'
                      : `Complete the previous phases first, then continue here for ${currentPhase.name.toLowerCase()}.`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <WorkshopChat
          systemPrompt={phasePrompt}
          contextLabel={`Phase ${activePhase}: ${currentPhase.name}`}
          providerPriority={['groq', 'google', 'openrouter']}
          accentColor="emerald"
          onResponse={handleResponse}
          queryKeySuffix="app-builder"
        />
      </div>
    </div>
  )
}
