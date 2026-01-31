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
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop: Left sidebar */}
      <nav className="hidden md:flex w-10 border-r bg-background flex-col items-center py-2 gap-0.5 no-drag">
        {navItems.slice(0, 4).map((item) => {
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

      {/* Mobile: Bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
