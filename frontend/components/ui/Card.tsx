'use client'

import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

export function Card({
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
  children,
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-gray-900/50',
    elevated: 'bg-gray-800/80 shadow-xl',
    bordered: 'bg-gray-900/30 border border-gray-800',
    gradient: 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-800',
  }

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div
      className={cn(
        'rounded-xl',
        variants[variant],
        paddings[padding],
        hover && 'transition-all duration-200 hover:bg-gray-800/60 hover:border-gray-700',
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
    <Tag className={cn('text-lg font-semibold text-white', className)} {...props}>
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
    <div className={cn('mt-4 pt-4 border-t border-gray-800', className)} {...props}>
      {children}
    </div>
  )
}
