'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bot, GitCompare, Sparkles, MessageSquare,
  Coins, BarChart3, Settings, ChevronLeft, ChevronRight, Coffee,
  Search, Key, Shield, Layers,
  Zap, Wand2, Code2, FlaskConical, PenTool, BarChart2, Rocket,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWalletStore, useAuthStore } from '@/lib/store'
import { formatNumber, tokensToUsd, formatCurrency } from '@/lib/utils'

// Consumer-focused navigation (regular users)
const CONSUMER_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { type: 'divider' },
  { type: 'section', label: 'Workshops' },
  { label: 'Code Studio', href: '/workshops/code', icon: Code2 },
  { label: 'Research Lab', href: '/workshops/research', icon: FlaskConical },
  { label: 'Content Forge', href: '/workshops/content', icon: PenTool },
  { label: 'Data Analyst', href: '/workshops/data', icon: BarChart2 },
  { label: 'App Builder', href: '/workshops/app-builder', icon: Rocket },
  { type: 'divider' },
  { label: 'AI Hub', href: '/ai-hub', icon: Zap },
  { label: 'Smart Query', href: '/smart-query', icon: Sparkles },
  { label: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { type: 'divider' },
  { label: 'Explore Models', href: '/models', icon: Bot },
  { label: 'Recommendations', href: '/recommendations', icon: BookOpen },
  { type: 'divider' },
  { label: 'Tokens', href: '/tokens', icon: Coins },
  { label: 'Settings', href: '/settings', icon: Settings },
]

// Admin/Developer navigation (full access)
const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { type: 'divider' },
  { type: 'section', label: 'Workshops' },
  { label: 'Code Studio', href: '/workshops/code', icon: Code2 },
  { label: 'Research Lab', href: '/workshops/research', icon: FlaskConical },
  { label: 'Content Forge', href: '/workshops/content', icon: PenTool },
  { label: 'Data Analyst', href: '/workshops/data', icon: BarChart2 },
  { label: 'App Builder', href: '/workshops/app-builder', icon: Rocket },
  { type: 'divider' },
  { label: 'AI Hub', href: '/ai-hub', icon: Zap },
  { label: 'Smart Query', href: '/smart-query', icon: Sparkles },
  { label: 'Agent Builder', href: '/agents', icon: Wand2 },
  { label: 'AI Workspace', href: '/workspace', icon: Layers },
  { label: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { type: 'divider' },
  { label: 'Models', href: '/models', icon: Bot },
  { label: 'Compare', href: '/compare', icon: GitCompare },
  { label: 'Recommendations', href: '/recommendations', icon: BookOpen },
  { type: 'divider' },
  { label: 'Tokens', href: '/tokens', icon: Coins },
  { label: 'Usage', href: '/billing', icon: BarChart3 },
  { type: 'divider' },
  { label: 'API Keys', href: '/settings/api-keys', icon: Key },
  { label: 'Settings', href: '/settings', icon: Settings },
  { type: 'divider' },
  { label: 'Admin Panel', href: '/admin', icon: Shield },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { balance } = useWalletStore()
  const { user } = useAuthStore()

  const isAdmin = user?.role === 'admin'
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : CONSUMER_NAV_ITEMS

  return (
    <aside className={cn(
      'h-screen bg-gray-950 border-r border-gray-800 flex flex-col transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-white">AICaffe</span>
          )}
        </Link>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search models..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.type === 'divider') {
            return <div key={i} className="my-2 border-t border-gray-800/50" />
          }
          if (item.type === 'section') {
            if (collapsed) return null
            return (
              <div key={i} className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  {item.label}
                </span>
              </div>
            )
          }
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.label}
              href={item.href!}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-violet-500/10 text-violet-400 font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-violet-400')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Token Balance Widget */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Token Balance</span>
            <Coins className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {formatNumber(balance)} <span className="text-xs text-gray-400">ACT</span>
          </div>
          <div className="text-xs text-gray-500">≈ {formatCurrency(tokensToUsd(balance))}</div>
          <Link
            href="/tokens"
            className="w-full mt-2 py-1.5 text-xs text-center block bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg text-white font-medium hover:from-violet-500 hover:to-cyan-500 transition-all"
          >
            Buy Tokens
          </Link>
        </div>
      )}

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 flex items-center justify-center border-t border-gray-800 text-gray-500 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
