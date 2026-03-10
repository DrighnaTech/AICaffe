'use client'

import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline' | 'dot'
  size?: 'sm' | 'md' | 'lg'
  dotColor?: string
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  dotColor,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-white/[0.06] text-gray-300 border border-white/[0.06]',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/15',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/15',
    info: 'bg-blue-500/10 text-blue-400 border border-blue-500/15',
    purple: 'bg-violet-500/10 text-violet-400 border border-violet-500/15',
    outline: 'border border-gray-700 text-gray-400',
    dot: 'bg-transparent text-gray-400 gap-1.5',
  }

  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-xs',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {variant === 'dot' && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColor || 'bg-emerald-400')} />
      )}
      {children}
    </span>
  )
}
