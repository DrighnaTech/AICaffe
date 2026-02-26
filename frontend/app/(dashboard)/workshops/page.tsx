'use client';

import Link from 'next/link';
import { Code2, FlaskConical, PenTool, BarChart2, Rocket } from 'lucide-react';

const WORKSHOPS = [
  {
    id: 'code',
    name: 'Code Studio',
    description:
      'File tree, code editor, terminal, and live preview in one environment. ' +
      'Best for coding, debugging, refactoring, and code review tasks.',
    icon: Code2,
    primaryModel: 'DeepSeek Coder V3',
    fallbacks: ['Claude Sonnet', 'GPT-4o'],
    color: 'from-violet-500 to-indigo-500',
    status: 'available',
    href: '/workshops/code',
  },
  {
    id: 'research',
    name: 'Research Lab',
    description:
      'Research canvas with source cards, citation tracking, and credibility scoring. ' +
      'Best for information synthesis, fact-checking, and multi-source research.',
    icon: FlaskConical,
    primaryModel: 'Perplexity Sonar Pro',
    fallbacks: ['GPT-4o', 'Claude Opus'],
    color: 'from-cyan-500 to-teal-500',
    status: 'available',
    href: '/workshops/research',
  },
  {
    id: 'content',
    name: 'Content Forge',
    description:
      'Formatting toolbar, tone selector, and version history for writing. ' +
      'Best for blog posts, essays, marketing copy, and creative writing.',
    icon: PenTool,
    primaryModel: 'Claude Opus',
    fallbacks: ['GPT-4o', 'Gemini Pro'],
    color: 'from-pink-500 to-rose-500',
    status: 'available',
    href: '/workshops/content',
  },
  {
    id: 'data',
    name: 'Data Analyst',
    description:
      'Chart renderer, table views, and query builder for data work. ' +
      'Best for data analysis, CSV/JSON processing, and visualization.',
    icon: BarChart2,
    primaryModel: 'Claude Sonnet',
    fallbacks: ['GPT-4o', 'Gemini Pro'],
    color: 'from-amber-500 to-orange-500',
    status: 'available',
    href: '/workshops/data',
  },
  {
    id: 'app-builder',
    name: 'App Builder',
    description:
      'The Idea-to-Deployment Pipeline — from a napkin sketch to production in one platform. ' +
      'Discovery, architecture, code generation, testing, deployment, and monitoring.',
    icon: Rocket,
    primaryModel: 'Claude Opus / GPT-4o (per phase)',
    fallbacks: ['DeepSeek Coder', 'Gemini Pro'],
    color: 'from-emerald-500 to-green-500',
    status: 'in_development',
    href: '/workshops/app-builder',
  },
];

export default function WorkshopsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Workshops</h1>
        <p className="text-gray-400">
          Task-specific AI environments — each Workshop adapts its UI, tools, and model selection
          to the work at hand.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {WORKSHOPS.map((ws) => (
          <Link
            key={ws.id}
            href={ws.href}
            className="group relative flex flex-col gap-4 p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-gray-600 transition-all hover:bg-gray-800/60"
          >
            {/* Status badge */}
            <div className="absolute top-4 right-4">
              {ws.status === 'available' ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Available
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  In Development
                </span>
              )}
            </div>

            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ws.color} flex items-center justify-center`}>
              <ws.icon className="w-5 h-5 text-white" />
            </div>

            {/* Info */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors">
                {ws.name}
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">{ws.description}</p>
            </div>

            {/* Model info */}
            <div className="flex flex-col gap-1 pt-1 border-t border-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gray-600">Primary:</span>
                <span className="text-gray-400">{ws.primaryModel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gray-600">Fallback:</span>
                <span className="text-gray-500">{ws.fallbacks.join(' → ')}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
