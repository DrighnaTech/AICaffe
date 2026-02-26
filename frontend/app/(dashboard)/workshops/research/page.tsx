'use client';

import { FlaskConical } from 'lucide-react';

export default function ResearchLabPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Research Lab</h1>
          <p className="text-xs text-gray-500">Powered by Perplexity Sonar Pro → GPT-4o → Claude Opus</p>
        </div>
      </div>

      {/* Two-panel layout placeholder */}
      <div className="flex flex-1 overflow-hidden">
        {/* Research canvas */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-900/50">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-4">
            In Development
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Research Canvas Coming Soon</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Research canvas with source cards, citation tracking, and credibility scoring.
            Automatically cites sources and synthesizes information across multiple inputs.
          </p>
        </div>

        {/* Chat side panel */}
        <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-xs text-gray-600">Chat interface panel</p>
        </div>
      </div>
    </div>
  );
}
