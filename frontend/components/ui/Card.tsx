'use client'

import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient' | 'stat'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  accent?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
}

const accentClasses = {
  violet: 'accent-line-violet',
  cyan: 'accent-line-cyan',
  emerald: 'accent-line-emerald',
  amber: 'accent-line-amber',
  rose: 'accent-line-violet',
}

export function Card({
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
  accent,
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'glass-card',
    elevated: 'bg-gray-800/60 shadow-card border border-white/[0.04] rounded-card',
    bordered: 'glass-card',
    gradient: 'glass-card bg-gradient-to-br from-gray-800/30 to-gray-900/30',
    stat: 'glass-card',
  }

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        variants[variant],
        paddings[padding],
        accent && accentClasses[accent],
        hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({ className, as: Tag = 'h3', children, ...props }: CardTitleProps) {
  return (
    <Tag className={cn('text-sm font-semibold text-white tracking-tight', className)} {...props}>
      {children}
    </Tag>
  )
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-400 mt-1', className)} {...props}>
      {children}
    </p>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-white/[0.04]', className)} {...props}>
      {children}
    </div>
  )
}
