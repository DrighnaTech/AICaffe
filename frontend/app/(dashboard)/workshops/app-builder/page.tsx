'use client';

import { Rocket } from 'lucide-react';

const PHASES = [
  { num: 1, name: 'Discovery & Scoping', desc: 'Smart questioning → PRD generation' },
  { num: 2, name: 'Architecture & Design', desc: 'System diagrams, ADRs, tech stack' },
  { num: 3, name: 'Development & Iteration', desc: 'Full codebase with live preview' },
  { num: 4, name: 'Testing & QA', desc: 'Unit, integration, security tests' },
  { num: 5, name: 'Deployment & DevOps', desc: 'CI/CD + multi-target deployment' },
  { num: 6, name: 'Post-Launch & Evolution', desc: 'Monitoring, error triage, iteration' },
];

export default function AppBuilderPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
          <Rocket className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">App Builder</h1>
          <p className="text-xs text-gray-500">Idea to Deployment — multi-model orchestration per phase</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            In Development
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            From a Napkin Sketch to Production in One Platform
          </h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Tell AiCaffe what you want to build. It will ask the right questions, make the right
            decisions, write production code, test it, and deploy it — with you in control at
            every step.
          </p>

          {/* Phase list */}
          <div className="flex flex-col gap-3">
            {PHASES.map((phase) => (
              <div
                key={phase.num}
                className="flex items-start gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800"
              >
                <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                  {phase.num}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{phase.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{phase.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
