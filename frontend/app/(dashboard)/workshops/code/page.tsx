'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Code2, Plus, Trash2, FileCode, ChevronRight,
} from 'lucide-react'
import { WorkshopChat } from '@/components/workshop/WorkshopChat'
import toast from 'react-hot-toast'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ── Language detection ─────────────────────────────────────────────────────
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  cpp: 'cpp', c: 'c', cs: 'csharp', rb: 'ruby', php: 'php',
  html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
  yml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell',
  dockerfile: 'dockerfile', tf: 'hcl', toml: 'toml', xml: 'xml',
}

function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_TO_LANG[ext] || 'plaintext'
}

// ── Types ─────────────────────────────────────────────────────────────────
interface File { name: string; content: string }

const DEFAULT_FILES: File[] = [
  {
    name: 'index.ts',
    content: `// Welcome to Code Studio\n// Ask the AI assistant anything about your code\n\nfunction greet(name: string): string {\n  return \`Hello, \${name}!\`\n}\n\nconsole.log(greet('AiCaffe'))\n`,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────
export default function CodeStudioPage() {
  const [files, setFiles] = useState<File[]>(DEFAULT_FILES)
  const [activeFile, setActiveFile] = useState('index.ts')

  const currentFile = files.find((f) => f.name === activeFile)

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return
    setFiles((prev) =>
      prev.map((f) => (f.name === activeFile ? { ...f, content: value } : f))
    )
  }

  const handleAddFile = () => {
    const name = prompt('File name (e.g. utils.ts):')?.trim()
    if (!name) return
    if (files.find((f) => f.name === name)) { toast.error('File already exists'); return }
    setFiles((prev) => [...prev, { name, content: '' }])
    setActiveFile(name)
  }

  const handleDeleteFile = (name: string) => {
    if (files.length === 1) { toast.error('Cannot delete the last file'); return }
    setFiles((prev) => prev.filter((f) => f.name !== name))
    if (activeFile === name) setActiveFile(files.find((f) => f.name !== name)!.name)
  }

  // Build system prompt dynamically based on current file
  const systemPrompt = currentFile
    ? `You are an expert code assistant. The user is working on \`${currentFile.name}\` (${getLang(currentFile.name)}).

Current file content:
\`\`\`${getLang(currentFile.name)}
${currentFile.content}
\`\`\`

Help with code review, debugging, refactoring, and feature additions. When showing code changes, use the same language as the file. Be concise and practical.`
    : 'You are an expert code assistant. Be concise and practical.'

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
      {/* Header */}
      <div className="flex items-center px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
            <Code2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Code Studio</h1>
            <p className="text-[10px] text-gray-500">File-aware AI coding assistant</p>
          </div>
        </div>
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1: File Tree */}
        <div className="w-44 border-r border-gray-800 bg-gray-950 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Files</span>
            <button
              onClick={handleAddFile}
              className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors"
              title="New file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files.map((file) => (
              <div
                key={file.name}
                onClick={() => setActiveFile(file.name)}
                className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                  activeFile === file.name
                    ? 'bg-violet-500/10 text-violet-300 border-r-2 border-violet-500'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <FileCode className="w-3 h-3 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate">{file.name}</span>
                {files.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.name) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Monaco Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-gray-800 bg-gray-900/80 px-1 flex-shrink-0">
            {currentFile && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 border-b-2 border-violet-500">
                <ChevronRight className="w-3 h-3 text-gray-500" />
                {currentFile.name}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language={getLang(activeFile)}
              value={currentFile?.content || ''}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                bracketPairColorization: { enabled: true },
                padding: { top: 12 },
              }}
            />
          </div>
        </div>

        {/* Panel 3: Chat */}
        <WorkshopChat
          systemPrompt={systemPrompt}
          contextLabel={`File: ${activeFile}`}
          providerPriority={['groq', 'google', 'mistral', 'openrouter', 'cerebras']}
          accentColor="violet"
          queryKeySuffix="code-studio"
        />
      </div>
    </div>
  )
}
