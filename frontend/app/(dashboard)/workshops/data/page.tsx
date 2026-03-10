'use client'

import { useState, useMemo, useCallback } from 'react'
import { BarChart2, Upload, Table2, Hash, FileSpreadsheet } from 'lucide-react'
import { WorkshopChat } from '@/components/workshop/WorkshopChat'
import toast from 'react-hot-toast'

// ── CSV / JSON parser ─────────────────────────────────────────────────────
function parseData(raw: string): { headers: string[]; rows: string[][] } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Try JSON first
  try {
    const json = JSON.parse(trimmed)
    const arr = Array.isArray(json) ? json : json.data || json.results || json.items
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
      const headers = Object.keys(arr[0])
      const rows = arr.map((item: any) => headers.map((h) => String(item[h] ?? '')))
      return { headers, rows }
    }
  } catch { /* not JSON */ }

  // Try CSV (comma or tab separated)
  const lines = trimmed.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return null
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) =>
    line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ''))
  )
  return { headers, rows }
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function DataAnalystPage() {
  const [rawData, setRawData] = useState('')
  const [showInput, setShowInput] = useState(true)

  const parsed = useMemo(() => parseData(rawData), [rawData])

  const handleResponse = useCallback(() => {}, [])

  const handleSampleData = () => {
    setRawData(`Name,Age,City,Salary,Department
Alice,32,New York,95000,Engineering
Bob,28,San Francisco,88000,Marketing
Carol,35,Chicago,102000,Engineering
David,41,Boston,115000,Management
Eve,26,Seattle,78000,Design
Frank,38,Austin,98000,Engineering
Grace,30,Denver,85000,Marketing
Henry,45,Portland,120000,Management
Iris,29,Miami,82000,Design
Jack,33,New York,97000,Engineering`)
    setShowInput(false)
  }

  // First 50 rows for context
  const contextPreview = parsed
    ? `Columns: ${parsed.headers.join(', ')}\nRows: ${parsed.rows.length}\n\nSample data (first ${Math.min(50, parsed.rows.length)} rows):\n${parsed.headers.join(',')}\n${parsed.rows.slice(0, 50).map((r) => r.join(',')).join('\n')}`
    : 'No data loaded yet.'

  const systemPrompt = `You are an expert data analyst. The user has loaded data that you should analyze.

${contextPreview}

Help with:
- Summarizing and describing the data (distributions, outliers, patterns)
- Answering natural language questions about the data
- Suggesting analyses, aggregations, and visualizations
- Computing statistics (mean, median, mode, correlations)
- Data cleaning recommendations
- Writing SQL or pandas queries for the analysis

When showing results, use tables (markdown) and be precise with numbers. Reference column names exactly as they appear.`

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <BarChart2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Data Analyst</h1>
            <p className="text-[10px] text-gray-500">Upload data, ask questions, get insights</p>
          </div>
        </div>
        {parsed && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              <Hash className="w-3 h-3 inline mr-1" />
              {parsed.rows.length} rows · {parsed.headers.length} columns
            </span>
            <button
              onClick={() => setShowInput(!showInput)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {showInput ? 'Hide input' : 'Edit data'}
            </button>
          </div>
        )}
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main: Data Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Data input area (collapsible) */}
          {showInput && (
            <div className="border-b border-gray-800 flex-shrink-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <Upload className="w-3 h-3" />
                    Paste CSV or JSON data
                  </label>
                  <button
                    onClick={handleSampleData}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    Load sample
                  </button>
                </div>
                <textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  placeholder={'Paste CSV:\nName,Age,City\nAlice,30,NYC\n\nOr JSON:\n[{"name":"Alice","age":30}]'}
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-xl text-white text-xs font-mono placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Table view */}
          <div className="flex-1 overflow-auto p-4">
            {parsed ? (
              <div className="overflow-auto rounded-xl border border-gray-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/80">
                      <th className="px-3 py-2 text-left text-gray-500 font-medium w-10">#</th>
                      {parsed.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-gray-300 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {parsed.rows.slice(0, 200).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-3 py-1.5 text-gray-600">{i + 1}</td>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-[200px] truncate">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 200 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-800/30 text-center">
                    Showing 200 of {parsed.rows.length} rows
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4">
                  <Table2 className="w-8 h-8 text-amber-400/50" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Load your data</h2>
                <p className="text-gray-500 text-sm max-w-sm mb-4">
                  Paste CSV or JSON data above, or load the sample dataset.
                  Then ask the AI anything about your data.
                </p>
                <button
                  onClick={handleSampleData}
                  className="px-4 py-2 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-colors"
                >
                  Try sample dataset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <WorkshopChat
          systemPrompt={systemPrompt}
          contextLabel={parsed ? `${parsed.rows.length} rows · ${parsed.headers.length} cols` : 'No data loaded'}
          providerPriority={['groq', 'google', 'openrouter']}
          accentColor="amber"
          onResponse={handleResponse}
          queryKeySuffix="data-analyst"
        />
      </div>
    </div>
  )
}
