'use client';

import { Code2 } from 'lucide-react';

export default function CodeStudioPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
          <Code2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Code Studio</h1>
          <p className="text-xs text-gray-500">Powered by DeepSeek Coder V3 → Claude Sonnet → GPT-4o</p>
        </div>
      </div>

      {/* Three-panel layout placeholder */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-48 border-r border-gray-800 bg-gray-950 p-3 flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Files</p>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <span className="px-2 py-1 rounded hover:bg-gray-800 cursor-pointer">index.ts</span>
            <span className="px-2 py-1 rounded hover:bg-gray-800 cursor-pointer">types.ts</span>
            <span className="px-2 py-1 rounded hover:bg-gray-800 cursor-pointer">utils.ts</span>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-900/50">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-4">
            In Development
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Code Editor Coming Soon</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Monaco editor with syntax highlighting, inline diff view, and live preview.
            Powered by the Smart Conductor routing to the best code model for your task.
          </p>
        </div>

        {/* Chat panel */}
        <div className="w-72 border-l border-gray-800 bg-gray-950 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-xs text-gray-600">Chat / Terminal panel</p>
        </div>
      </div>
    </div>
  );
}
