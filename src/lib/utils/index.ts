import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  // For very small amounts, show more decimals
  if (Math.abs(amount) > 0 && Math.abs(amount) < 0.01) {
    // Find significant digits
    const decimals = Math.max(2, -Math.floor(Math.log10(Math.abs(amount))) + 2)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Math.min(decimals, 8),
      maximumFractionDigits: Math.min(decimals, 8),
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`
  }
  return `$${value.toFixed(0)}`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculatePnl(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  direction: 'buy' | 'sell'
): { amount: number; percent: number } {
  const priceDiff = direction === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice
  const amount = priceDiff * quantity
  const percent = (priceDiff / entryPrice) * 100

  return { amount, percent }
}

export function getPnlColor(amount: number | null): string {
  if (amount === null) return 'text-muted-foreground'
  if (amount > 0) return 'text-green-500'
  if (amount < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-blue-500/10 text-blue-500'
    case 'closed':
      return 'bg-gray-500/10 text-gray-500'
    case 'partial':
      return 'bg-yellow-500/10 text-yellow-500'
    default:
      return 'bg-gray-500/10 text-gray-500'
  }
}

export function getEmotionalStateColor(state: string): string {
  switch (state) {
    case 'calm':
    case 'locked_in':
      return 'bg-green-500/10 text-green-500'
    case 'toblast':
      return 'bg-blue-500/10 text-blue-500'
    case 'fomo':
      return 'bg-orange-500/10 text-orange-500'
    case 'distracted':
      return 'bg-red-500/10 text-red-500'
    case 'uncertain':
    case 'unsure':
      return 'bg-yellow-500/10 text-yellow-500'
    default:
      return 'bg-gray-500/10 text-gray-500'
  }
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'narrative':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    case 'technical':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    case 'meta':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number
): (...args: Args) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Args) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export const emotionalStates = [
  { value: 'fomo', label: 'FOMO' },
  { value: 'toblast', label: 'Toblast' },
  { value: 'calm', label: 'Calm' },
  { value: 'distracted', label: 'Distracted' },
  { value: 'uncertain', label: 'Uncertain' },
  { value: 'locked_in', label: 'Locked In' },
  { value: 'unsure', label: 'Unsure' },
] as const

export const tagCategories = [
  { value: 'narrative', label: 'Narrative' },
  { value: 'technical', label: 'Technical' },
  { value: 'meta', label: 'Meta' },
] as const

export const platforms = [
  'Fomo App',
  'Phantom Wallet',
  'MetaMask',
  'Uniswap',
  'Jupiter',
  'Raydium',
  'PancakeSwap',
  'Binance',
  'Coinbase',
  'Other',
] as const

export const chains = [
  'Solana',
  'Ethereum',
  'Base',
  'Arbitrum',
  'Polygon',
  'BNB Chain',
  'Avalanche',
  'Other',
] as const
