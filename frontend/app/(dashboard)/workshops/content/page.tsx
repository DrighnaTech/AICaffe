'use client';

import { PenTool } from 'lucide-react';

export default function ContentForgePage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
          <PenTool className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Content Forge</h1>
          <p className="text-xs text-gray-500">Powered by Claude Opus → GPT-4o → Gemini Pro</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center text-center px-8 bg-gray-900/50">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-4">
            In Development
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Content Editor Coming Soon</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Formatting toolbar, tone selector, style guide, and version history.
            Best for blog posts, essays, marketing copy, and creative writing.
          </p>
        </div>
      </div>
    </div>
  );
}
