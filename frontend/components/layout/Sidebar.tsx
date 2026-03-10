'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bot, GitCompare, Sparkles, MessageSquare,
  Coins, BarChart3, Settings, ChevronLeft, ChevronRight, Coffee,
  Search, Key, Shield, Layers,
  Zap, Wand2, Code2, FlaskConical, PenTool, BarChart2, Rocket,
  BookOpen, Command
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWalletStore, useAuthStore } from '@/lib/store'
import { formatNumber, tokensToUsd, formatCurrency } from '@/lib/utils'

const CONSUMER_NAV = [
  { type: 'section', label: 'Main' },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI Hub', href: '/ai-hub', icon: Zap },
  { label: 'Smart Query', href: '/smart-query', icon: Sparkles },
  { label: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { type: 'section', label: 'Workshops' },
  { label: 'Code Studio', href: '/workshops/code', icon: Code2 },
  { label: 'Research Lab', href: '/workshops/research', icon: FlaskConical },
  { label: 'Content Forge', href: '/workshops/content', icon: PenTool },
  { label: 'Data Analyst', href: '/workshops/data', icon: BarChart2 },
  { label: 'App Builder', href: '/workshops/app-builder', icon: Rocket },
  { type: 'section', label: 'Discover' },
  { label: 'Explore Models', href: '/models', icon: Bot },
  { label: 'Recommendations', href: '/recommendations', icon: BookOpen },
  { type: 'section', label: 'Account' },
  { label: 'Tokens', href: '/tokens', icon: Coins },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const ADMIN_NAV = [
  { type: 'section', label: 'Main' },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI Hub', href: '/ai-hub', icon: Zap },
  { label: 'Smart Query', href: '/smart-query', icon: Sparkles },
  { label: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { type: 'section', label: 'Workshops' },
  { label: 'Code Studio', href: '/workshops/code', icon: Code2 },
  { label: 'Research Lab', href: '/workshops/research', icon: FlaskConical },
  { label: 'Content Forge', href: '/workshops/content', icon: PenTool },
  { label: 'Data Analyst', href: '/workshops/data', icon: BarChart2 },
  { label: 'App Builder', href: '/workshops/app-builder', icon: Rocket },
  { type: 'section', label: 'Discover' },
  { label: 'Models', href: '/models', icon: Bot },
  { label: 'Compare', href: '/compare', icon: GitCompare },
  { label: 'Recommendations', href: '/recommendations', icon: BookOpen },
  { type: 'section', label: 'Account' },
  { label: 'Tokens', href: '/tokens', icon: Coins },
  { label: 'Usage', href: '/billing', icon: BarChart3 },
  { label: 'API Keys', href: '/settings/api-keys', icon: Key },
  { label: 'Settings', href: '/settings', icon: Settings },
  { type: 'section', label: 'Admin' },
  { label: 'Admin Panel', href: '/admin', icon: Shield },
  { label: 'Agent Builder', href: '/agents', icon: Wand2 },
  { label: 'AI Workspace', href: '/workspace', icon: Layers },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const balance = useWalletStore((s) => s.balance)
  const user = useAuthStore((s) => s.user)

  const isAdmin = user?.role === 'admin'
  const navItems = isAdmin ? ADMIN_NAV : CONSUMER_NAV

  return (
    <aside className={cn(
      'h-screen flex flex-col transition-all duration-300 border-r border-white/[0.04]',
      'bg-surface-primary',
      collapsed ? 'w-[60px]' : 'w-[240px]'
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-white/[0.04]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-[15px] text-white tracking-tight">AICaffe</span>
          )}
        </Link>
      </div>

      {/* Search / Command */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <button className="w-full flex items-center gap-2 px-3 py-[7px] rounded-button bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-gray-400 hover:bg-white/[0.05] transition-all text-xs">
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-500 font-mono">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {navItems.map((item, i) => {
          if (item.type === 'section') {
            if (collapsed) return <div key={i} className="my-2" />
            return (
              <div key={i} className={cn('px-3 pt-4 pb-1.5', i === 0 && 'pt-1')}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-600">
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
                'relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150 group my-[1px]',
                isActive
                  ? 'text-white bg-white/[0.06]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              )}
            >
              {/* Active accent bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-violet-500" />
              )}
              <item.icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors',
                isActive ? 'text-violet-400' : 'text-gray-600 group-hover:text-gray-400'
              )} />
              {!collapsed && (
                <span className={cn(isActive && 'font-medium')}>{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Token Balance Widget */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Balance</span>
            <Coins className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-base font-semibold text-white tracking-tight">
            {formatNumber(balance)} <span className="text-[10px] text-gray-500 font-normal">ACT</span>
          </div>
          <div className="text-[11px] text-gray-600 mt-0.5">{formatCurrency(tokensToUsd(balance))}</div>
          <Link
            href="/tokens"
            className="w-full mt-2.5 py-1.5 text-[11px] text-center block bg-violet-600 hover:bg-violet-500 rounded-button text-white font-medium transition-colors"
          >
            Buy Tokens
          </Link>
        </div>
      )}

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-10 flex items-center justify-center border-t border-white/[0.04] text-gray-600 hover:text-gray-400 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  )
}
