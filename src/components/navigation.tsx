'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Upload,
  BarChart3,
  FileText,
  BookOpen,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Positions' },
  { href: '/journal', icon: BookOpen, label: 'Journal' },
  { href: '/import', icon: Upload, label: 'Import' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="w-10 border-r bg-background flex flex-col items-center py-2 gap-0.5 no-drag">
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'w-8 h-8 flex items-center justify-center transition-colors',
              isActive
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={item.label}
          >
            <item.icon className="h-3.5 w-3.5" />
          </Link>
        )
      })}

      <div className="flex-1" />

      <Link
        href="/settings"
        className={cn(
          'w-8 h-8 flex items-center justify-center transition-colors',
          pathname === '/settings'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        title="Settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </Link>
    </nav>
  )
}
