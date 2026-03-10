'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, User, Settings, LogOut, Coins, ChevronDown, Key, HelpCircle, Cloud, Command } from 'lucide-react'
import { useAuthStore, useWalletStore } from '@/lib/store'
import { formatNumber, tokensToUsd, formatCurrency } from '@/lib/utils'

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const balance = useWalletStore((s) => s.balance)
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const getBreadcrumb = () => {
    if (!pathname) return 'Dashboard'
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return 'Dashboard'
    return parts.map(p => p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' / ')
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.04] bg-surface-primary/80 backdrop-blur-glass">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 font-medium">{getBreadcrumb()}</span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger */}
        <button className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-button bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-gray-400 hover:bg-white/[0.05] transition-all text-xs">
          <Command className="w-3 h-3" />
          <span>Search</span>
          <kbd className="ml-1 px-1 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono">K</kbd>
        </button>

        {/* Token Balance */}
        <Link
          href="/tokens"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-button bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
        >
          <Coins className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-white">{formatNumber(balance)}</span>
          <span className="text-[10px] text-gray-600">{formatCurrency(tokensToUsd(balance))}</span>
        </Link>

        {/* Storage */}
        <Link
          href="/storage"
          className="p-2 text-gray-600 hover:text-gray-400 transition-colors rounded-button hover:bg-white/[0.03]"
          title="CaffeSpace Storage"
        >
          <Cloud className="w-4 h-4" />
        </Link>

        {/* Notifications */}
        <button className="relative p-2 text-gray-600 hover:text-gray-400 transition-colors rounded-button hover:bg-white/[0.03]">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
        </button>

        {/* Help */}
        <Link href="/docs" className="p-2 text-gray-600 hover:text-gray-400 transition-colors rounded-button hover:bg-white/[0.03]">
          <HelpCircle className="w-4 h-4" />
        </Link>

        {/* Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-1.5 p-1 rounded-button hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-semibold text-white ring-2 ring-transparent hover:ring-violet-500/20 transition-all">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${showProfile ? 'rotate-180' : ''}`} />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl shadow-xl py-1.5 z-50 animate-scale-in">
              <div className="px-3 py-2.5 border-b border-white/[0.04]">
                <div className="text-sm font-medium text-white">{user?.full_name || 'User'}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{user?.email}</div>
                {user?.organization_name && (
                  <div className="text-[11px] text-violet-400 mt-0.5">{user.organization_name}</div>
                )}
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Account Settings
                </Link>
                <Link
                  href="/settings/api-keys"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <Key className="w-3.5 h-3.5" /> API Keys
                </Link>
                <Link
                  href="/billing"
                  onClick={() => setShowProfile(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  <User className="w-3.5 h-3.5" /> Billing & Usage
                </Link>
              </div>

              <div className="border-t border-white/[0.04] pt-1">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-white/[0.04] transition-colors w-full"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
