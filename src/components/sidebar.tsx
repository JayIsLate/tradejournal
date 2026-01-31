'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  BookOpen,
  Users,
  Tags,
  BarChart3,
  FileText,
  Settings,
  Search,
  Moon,
  Sun,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from './theme-provider'
import { Button } from './ui/button'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Influencers', href: '/influencers', icon: Users },
  { name: 'Tags', href: '/tags', icon: Tags },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reviews', href: '/reviews', icon: FileText },
]

const secondaryNav = [
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Drag region for window controls */}
      <div className="h-8 drag-region" />

      {/* Logo */}
      <div className="px-6 py-4 no-drag">
        <h1 className="text-xl font-bold">Trade Journal</h1>
        <p className="text-xs text-muted-foreground">Track your crypto trades</p>
      </div>

      {/* Search */}
      <div className="px-4 pb-4 no-drag">
        <Link
          href="/search"
          className="flex items-center gap-2 border bg-background px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 no-drag">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="border-t px-3 py-4 space-y-1 no-drag">
        {secondaryNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
      </div>
    </div>
  )
}
