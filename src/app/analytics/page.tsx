'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity,
  Brain,
  Lightbulb,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { db } from '@/lib/db'
import type { Analytics, Trade, TokenNote } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

interface PositionStats {
  symbol: string
  contractAddress: string | null
  totalInvested: number
  totalReturned: number
  realizedPnl: number
  pnlPercent: number
  hasOpenPosition: boolean
  firstTradeDate: string
  lastTradeDate: string
  holdDurationDays: number
  numBuys: number
  numSells: number
  avgBuyPrice: number
  avgSellPrice: number
  note: TokenNote | null
  tags: string[]
}

interface Insight {
  type: 'tip' | 'warning' | 'success' | 'info'
  title: string
  description: string
}

interface MarketSentiment {
  btc: { price: number; change24h: number }
  sol: { price: number; change24h: number }
  eth: { price: number; change24h: number }
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [bestTrade, setBestTrade] = useState<PositionStats | null>(null)
  const [worstTrade, setWorstTrade] = useState<PositionStats | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [allPositions, setAllPositions] = useState<PositionStats[]>([])
  const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null)
  const [loading, setLoading] = useState(true)
  const [portfolioPnl, setPortfolioPnl] = useState<number | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        // Load portfolio settings for accurate P&L display
        const savedTotalPortfolio = localStorage.getItem('totalPortfolioValue')
        const savedInitialCapital = localStorage.getItem('initialCapital')
        const totalPortfolioValue = savedTotalPortfolio ? parseFloat(savedTotalPortfolio) : null
        const initialCapital = savedInitialCapital ? parseFloat(savedInitialCapital) : null

        if (totalPortfolioValue !== null && initialCapital !== null) {
          setPortfolioPnl(totalPortfolioValue - initialCapital)
        }
        // Fetch market sentiment data (BTC, SOL, ETH 24h performance)
        try {
          const sentimentRes = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,ethereum&vs_currencies=usd&include_24hr_change=true'
          )
          if (sentimentRes.ok) {
            const data = await sentimentRes.json()
            setMarketSentiment({
              btc: {
                price: data.bitcoin?.usd || 0,
                change24h: data.bitcoin?.usd_24h_change || 0
              },
              sol: {
                price: data.solana?.usd || 0,
                change24h: data.solana?.usd_24h_change || 0
              },
              eth: {
                price: data.ethereum?.usd || 0,
                change24h: data.ethereum?.usd_24h_change || 0
              }
            })
          }
        } catch (e) {
          console.log('Failed to fetch market sentiment')
        }

        // Get trades and calculate position-level P&L
        const trades = await db.getTrades()
        const allTags = await db.getTags()
        const allNotes = await db.getAllTokenNotes()

        // Fetch current SOL price for USD conversion
        let currentSolPrice = 100 // Default
        try {
          const solPriceRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112')
          if (solPriceRes.ok) {
            const solPriceData = await solPriceRes.json()
            if (solPriceData.pairs?.[0]?.priceUsd) {
              currentSolPrice = parseFloat(solPriceData.pairs[0].priceUsd)
            }
          }
        } catch (e) {
          console.log('Failed to fetch SOL price, using default')
        }

        // Helper to get USD value for a trade
        // Prioritize total_value_usd since entry_price may be in SOL (not USD) for SOL-denominated trades
        const getTradeUsdValue = (trade: Trade): number => {
          // First, use stored total_value_usd if available (most accurate)
          if (trade.total_value_usd != null && trade.total_value_usd > 0) {
            return trade.total_value_usd
          }

          // For stablecoin trades, entry_price * quantity gives USD value
          const baseCurrency = (trade as any).base_currency?.toUpperCase() || ''
          const stablecoinBases = ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USD1', 'USDbC']
          if (stablecoinBases.includes(baseCurrency)) {
            const calculatedValue = trade.entry_price * trade.quantity
            if (calculatedValue > 0) {
              return calculatedValue
            }
          }

          // For SOL-denominated trades, convert using stored price or current price
          const baseCurrencyUsdPrice = (trade as any).base_currency_usd_price || currentSolPrice
          const baseAmount = trade.total_value || (trade.entry_price * trade.quantity)
          return baseAmount * baseCurrencyUsdPrice
        }

        // Filter out stablecoins, unsigned duplicates, fees, and broken entries
        const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USD1', 'USDbC', 'SOL', 'WETH', 'ETH']

        // Build set of tokens that have ANY signed trade (from Helius sync)
        const signedTokens = new Set<string>()
        const signedContracts = new Set<string>()
        trades.forEach(t => {
          if ((t as any).tx_signature) {
            signedTokens.add(t.token_symbol.toUpperCase())
            if (t.token_contract_address) {
              signedContracts.add(t.token_contract_address.toLowerCase())
            }
          }
        })

        const filteredTrades = trades.filter(t => {
          const symbol = t.token_symbol.toUpperCase()
          if (stablecoins.includes(symbol)) return false

          // Remove ALL unsigned trades for tokens that have signed trades
          if (!(t as any).tx_signature) {
            const tokenHasSigned = signedTokens.has(symbol) ||
              (t.token_contract_address && signedContracts.has(t.token_contract_address.toLowerCase()))
            if (tokenHasSigned) return false
          }

          // Remove broken and fee entries
          if (t.total_value === 0 && t.entry_price === 0) return false
          if (Math.abs(t.total_value - 0.95) < 0.05) return false

          return true
        })

        // Group trades by token (using contract address for uniqueness)
        const positionMap: Record<string, { buys: Trade[]; sells: Trade[]; symbol: string; contractAddress: string | null }> = {}

        filteredTrades.forEach(trade => {
          const key = trade.token_contract_address?.toLowerCase() || trade.token_symbol.toUpperCase()
          if (!positionMap[key]) {
            positionMap[key] = { buys: [], sells: [], symbol: trade.token_symbol, contractAddress: trade.token_contract_address }
          }
          if (trade.direction === 'buy') {
            positionMap[key].buys.push(trade)
          } else {
            positionMap[key].sells.push(trade)
          }
        })

        // Calculate position stats with enhanced data (using USD values)
        const positions: PositionStats[] = await Promise.all(
          Object.values(positionMap).map(async pos => {
            const totalInvested = pos.buys.reduce((sum, t) => sum + getTradeUsdValue(t), 0)
            const totalReturned = pos.sells.reduce((sum, t) => sum + getTradeUsdValue(t), 0)
            const totalBought = pos.buys.reduce((sum, t) => sum + t.quantity, 0)
            const totalSold = pos.sells.reduce((sum, t) => sum + t.quantity, 0)

            const avgBuyPrice = totalBought > 0 ? totalInvested / totalBought : 0
            const avgSellPrice = totalSold > 0 ? totalReturned / totalSold : 0

            // Realized P&L calculation
            // For closed/mostly-closed positions: P&L = returned - invested
            // Cap quantity sold at quantity bought to avoid cost basis inflation from missing buys
            const effectiveSoldQty = Math.min(totalSold, totalBought)
            const costBasisOfSold = totalBought > 0
              ? (totalInvested / totalBought) * effectiveSoldQty
              : totalInvested

            // If sold more than we have records of buying, use simple: returned - invested
            const realizedPnl = totalSold > totalBought
              ? totalReturned - totalInvested
              : totalReturned - costBasisOfSold

            // P&L percent based on what was actually invested/sold
            const pnlPercent = totalInvested > 0 ? (realizedPnl / totalInvested) * 100 : 0

            const allTrades = [...pos.buys, ...pos.sells].sort((a, b) =>
              new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
            )
            const firstTradeDate = allTrades[0]?.entry_date || ''
            const lastTradeDate = allTrades[allTrades.length - 1]?.entry_date || ''

            const holdDurationDays = firstTradeDate && lastTradeDate
              ? Math.ceil((new Date(lastTradeDate).getTime() - new Date(firstTradeDate).getTime()) / (1000 * 60 * 60 * 24))
              : 0

            // Get note for this token
            const note = allNotes.find(n => n.token_symbol.toUpperCase() === pos.symbol.toUpperCase()) || null

            // Get tags for this token
            const tagIds = await db.getTokenTagIds(pos.symbol)
            const tags = allTags.filter(t => tagIds.includes(t.id)).map(t => t.name)

            return {
              symbol: pos.symbol,
              contractAddress: pos.contractAddress,
              totalInvested,
              totalReturned,
              realizedPnl,
              pnlPercent,
              hasOpenPosition: totalBought > totalSold,
              firstTradeDate,
              lastTradeDate,
              holdDurationDays,
              numBuys: pos.buys.length,
              numSells: pos.sells.length,
              avgBuyPrice,
              avgSellPrice,
              note,
              tags,
            }
          })
        )

        setAllPositions(positions)

        // Filter to only positions with sells (closed or partially closed)
        const closedPositions = positions.filter(p => p.totalReturned > 0)
        const winners = closedPositions.filter(p => p.realizedPnl > 0)
        const losers = closedPositions.filter(p => p.realizedPnl < 0)

        // Find best and worst trades
        const sortedByPnl = [...closedPositions].sort((a, b) => b.realizedPnl - a.realizedPnl)
        const best = sortedByPnl[0] || null
        const worst = sortedByPnl[sortedByPnl.length - 1] || null

        setBestTrade(best)
        setWorstTrade(worst && worst.realizedPnl < 0 ? worst : null)

        // Realized P&L from closed positions
        const realizedPnl = closedPositions.reduce((sum, p) => sum + p.realizedPnl, 0)

        // Use portfolio P&L (from user settings) if available, otherwise use realized P&L
        const portfolioP = (totalPortfolioValue !== null && initialCapital !== null)
          ? totalPortfolioValue - initialCapital
          : null
        const totalPnl = portfolioP !== null ? portfolioP : realizedPnl
        const winRate = closedPositions.length > 0 ? (winners.length / closedPositions.length) * 100 : 0

        const avgWin = winners.length > 0 ? winners.reduce((sum, p) => sum + p.realizedPnl, 0) / winners.length : 0
        const avgLoss = losers.length > 0 ? losers.reduce((sum, p) => sum + p.realizedPnl, 0) / losers.length : 0

        const biggestWin = winners.length > 0 ? Math.max(...winners.map(p => p.realizedPnl)) : 0
        const biggestLoss = losers.length > 0 ? Math.min(...losers.map(p => p.realizedPnl)) : 0

        const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0

        // Calculate monthly P&L
        const monthlyMap: Record<string, { total_pnl: number; trade_count: number }> = {}
        closedPositions.forEach(p => {
          if (p.firstTradeDate) {
            const month = p.firstTradeDate.substring(0, 7)
            if (!monthlyMap[month]) {
              monthlyMap[month] = { total_pnl: 0, trade_count: 0 }
            }
            monthlyMap[month].total_pnl += p.realizedPnl
            monthlyMap[month].trade_count += 1
          }
        })
        const monthlyPnl = Object.entries(monthlyMap)
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => b.month.localeCompare(a.month))
          .slice(0, 12)

        // Generate insights
        const generatedInsights: Insight[] = []

        // Win rate insight
        if (winRate < 40) {
          generatedInsights.push({
            type: 'warning',
            title: 'Low Win Rate',
            description: `Your win rate is ${winRate.toFixed(0)}%. Consider being more selective with entries or improving your research process before buying.`
          })
        } else if (winRate >= 60) {
          generatedInsights.push({
            type: 'success',
            title: 'Strong Win Rate',
            description: `Your ${winRate.toFixed(0)}% win rate is excellent. Keep doing what you're doing with your entry selection.`
          })
        }

        // Position sizing insight
        const avgInvestment = closedPositions.length > 0
          ? closedPositions.reduce((sum, p) => sum + p.totalInvested, 0) / closedPositions.length
          : 0
        const bigLosses = losers.filter(p => Math.abs(p.realizedPnl) > avgInvestment * 0.5)
        if (bigLosses.length > 0) {
          generatedInsights.push({
            type: 'warning',
            title: 'Large Losses Detected',
            description: `You have ${bigLosses.length} position(s) with losses exceeding 50% of your average investment. Consider using stop losses or smaller position sizes.`
          })
        }

        // Hold duration analysis
        const avgHoldDuration = closedPositions.length > 0
          ? closedPositions.reduce((sum, p) => sum + p.holdDurationDays, 0) / closedPositions.length
          : 0
        const quickWins = winners.filter(p => p.holdDurationDays <= 1)
        const quickLosses = losers.filter(p => p.holdDurationDays <= 1)

        if (quickLosses.length > quickWins.length && quickLosses.length >= 3) {
          generatedInsights.push({
            type: 'tip',
            title: 'Quick Trades Underperforming',
            description: `You have more quick losses (${quickLosses.length}) than quick wins (${quickWins.length}). Consider holding positions longer or being more patient with entries.`
          })
        }

        // Profit factor insight
        if (profitFactor > 0 && profitFactor < 1) {
          generatedInsights.push({
            type: 'warning',
            title: 'Negative Expectancy',
            description: `Your profit factor is ${profitFactor.toFixed(2)}, meaning your losses outweigh your wins. Focus on cutting losses quickly and letting winners run.`
          })
        } else if (profitFactor >= 2) {
          generatedInsights.push({
            type: 'success',
            title: 'Strong Risk/Reward',
            description: `Your profit factor of ${profitFactor.toFixed(2)} shows excellent risk management. Your wins are significantly larger than your losses.`
          })
        }

        // Average position size
        if (avgInvestment > 0) {
          const largePositions = closedPositions.filter(p => p.totalInvested > avgInvestment * 2)
          if (largePositions.length > 0) {
            const largePosWinRate = largePositions.filter(p => p.realizedPnl > 0).length / largePositions.length * 100
            if (largePosWinRate < 50) {
              generatedInsights.push({
                type: 'tip',
                title: 'Large Positions Risky',
                description: `Your oversized positions (>${formatCurrency(avgInvestment * 2)}) have a ${largePosWinRate.toFixed(0)}% win rate. Consider sizing down on high-conviction plays.`
              })
            }
          }
        }

        // DCA pattern analysis
        const dcaPositions = closedPositions.filter(p => p.numBuys >= 3)
        if (dcaPositions.length >= 3) {
          const dcaWinRate = dcaPositions.filter(p => p.realizedPnl > 0).length / dcaPositions.length * 100
          if (dcaWinRate > winRate + 10) {
            generatedInsights.push({
              type: 'success',
              title: 'DCA Strategy Working',
              description: `Positions where you averaged in (3+ buys) have a ${dcaWinRate.toFixed(0)}% win rate vs ${winRate.toFixed(0)}% overall. Consider using DCA more often.`
            })
          } else if (dcaWinRate < winRate - 10) {
            generatedInsights.push({
              type: 'warning',
              title: 'DCA May Be Hurting',
              description: `Positions where you averaged in have a lower win rate (${dcaWinRate.toFixed(0)}%) than your overall (${winRate.toFixed(0)}%). You might be averaging into losing trades.`
            })
          }
        }

        // Open positions insight
        const openPositions = positions.filter(p => p.hasOpenPosition && p.totalInvested > 0)
        if (openPositions.length > 10) {
          generatedInsights.push({
            type: 'info',
            title: 'Many Open Positions',
            description: `You have ${openPositions.length} open positions. Consider consolidating to your highest conviction plays for better focus and capital efficiency.`
          })
        }

        setInsights(generatedInsights)

        setAnalytics({
          totalTrades: closedPositions.length,
          winners: winners.length,
          losers: losers.length,
          winRate,
          totalPnl,
          avgWin,
          avgLoss,
          biggestWin,
          biggestLoss,
          profitFactor,
          byTag: [],
          byEmotion: [],
          monthlyPnl,
        })
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Failed to load analytics</p>
      </div>
    )
  }

  const winLossData = [
    { name: 'Wins', value: analytics.winners, color: '#22c55e' },
    { name: 'Losses', value: analytics.losers, color: '#ef4444' },
  ]

  const monthlyData = analytics.monthlyPnl
    .map((m) => ({
      month: m.month,
      pnl: m.total_pnl,
      trades: m.trade_count,
    }))
    .reverse()

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'tip': return <Lightbulb className="h-5 w-5 text-blue-500" />
      default: return <Zap className="h-5 w-5 text-purple-500" />
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Deep dive into your trading performance
        </p>
      </div>

      {/* Market Sentiment */}
      {marketSentiment && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Market Sentiment (24h)
            </CardTitle>
            <CardDescription>
              Context for current market conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {/* Bitcoin */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-xs md:text-sm font-medium">BTC</div>
                  <div className="text-sm md:text-lg font-bold">
                    ${marketSentiment.btc.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs md:text-sm font-medium ${
                  marketSentiment.btc.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {marketSentiment.btc.change24h >= 0 ? (
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                  {marketSentiment.btc.change24h >= 0 ? '+' : ''}{marketSentiment.btc.change24h.toFixed(1)}%
                </div>
              </div>

              {/* Solana */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-xs md:text-sm font-medium">SOL</div>
                  <div className="text-sm md:text-lg font-bold">
                    ${marketSentiment.sol.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs md:text-sm font-medium ${
                  marketSentiment.sol.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {marketSentiment.sol.change24h >= 0 ? (
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                  {marketSentiment.sol.change24h >= 0 ? '+' : ''}{marketSentiment.sol.change24h.toFixed(1)}%
                </div>
              </div>

              {/* Ethereum */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="text-xs md:text-sm font-medium">ETH</div>
                  <div className="text-sm md:text-lg font-bold">
                    ${marketSentiment.eth.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs md:text-sm font-medium ${
                  marketSentiment.eth.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {marketSentiment.eth.change24h >= 0 ? (
                    <TrendingUp className="h-3 w-3 md:h-4 md:w-4" />
                  ) : (
                    <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                  {marketSentiment.eth.change24h >= 0 ? '+' : ''}{marketSentiment.eth.change24h.toFixed(1)}%
                </div>
              </div>
            </div>
            {/* Market mood indicator */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Market mood:</span>
                {(() => {
                  const avgChange = (marketSentiment.btc.change24h + marketSentiment.sol.change24h + marketSentiment.eth.change24h) / 3
                  if (avgChange >= 5) return <Badge className="bg-green-500">Very Bullish</Badge>
                  if (avgChange >= 2) return <Badge className="bg-green-500/70">Bullish</Badge>
                  if (avgChange >= -2) return <Badge variant="secondary">Neutral</Badge>
                  if (avgChange >= -5) return <Badge className="bg-red-500/70">Bearish</Badge>
                  return <Badge className="bg-red-500">Very Bearish</Badge>
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              analytics.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatCurrency(analytics.totalPnl)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.totalTrades} closed positions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.winners}W / {analytics.losers}L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.profitFactor.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.profitFactor >= 1.5 ? 'Excellent' : analytics.profitFactor >= 1 ? 'Good' : 'Needs work'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Win vs Loss</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-500">
                {formatCurrency(analytics.avgWin)}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg font-bold text-red-500">
                {formatCurrency(Math.abs(analytics.avgLoss))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best & Worst Trades */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Best Trade */}
        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Best Trade
            </CardTitle>
            <CardDescription>Your most profitable position</CardDescription>
          </CardHeader>
          <CardContent>
            {bestTrade ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{bestTrade.symbol}</span>
                  <span className="text-3xl font-bold text-green-500">
                    +{formatCurrency(bestTrade.realizedPnl)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invested:</span>
                    <span className="ml-2 font-medium">{formatCurrency(bestTrade.totalInvested)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Returned:</span>
                    <span className="ml-2 font-medium">{formatCurrency(bestTrade.totalReturned)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Return:</span>
                    <span className="ml-2 font-medium text-green-500">+{bestTrade.pnlPercent.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hold:</span>
                    <span className="ml-2 font-medium">{bestTrade.holdDurationDays} days</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Why It Worked
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {bestTrade.pnlPercent > 100 && (
                      <p>• Caught a {bestTrade.pnlPercent.toFixed(0)}% move - exceptional entry timing</p>
                    )}
                    {bestTrade.numBuys > 1 && (
                      <p>• Averaged in over {bestTrade.numBuys} buys - good DCA strategy</p>
                    )}
                    {bestTrade.holdDurationDays <= 3 && bestTrade.pnlPercent > 50 && (
                      <p>• Quick {bestTrade.holdDurationDays}-day flip - captured momentum</p>
                    )}
                    {bestTrade.holdDurationDays > 7 && (
                      <p>• Held for {bestTrade.holdDurationDays} days - patience paid off</p>
                    )}
                    {bestTrade.note?.thesis && (
                      <p className="italic mt-2">"{bestTrade.note.thesis.substring(0, 100)}{bestTrade.note.thesis.length > 100 ? '...' : ''}"</p>
                    )}
                    {bestTrade.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {bestTrade.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No winning trades yet</p>
            )}
          </CardContent>
        </Card>

        {/* Worst Trade */}
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Worst Trade
            </CardTitle>
            <CardDescription>Learn from this one</CardDescription>
          </CardHeader>
          <CardContent>
            {worstTrade ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{worstTrade.symbol}</span>
                  <span className="text-3xl font-bold text-red-500">
                    {formatCurrency(worstTrade.realizedPnl)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invested:</span>
                    <span className="ml-2 font-medium">{formatCurrency(worstTrade.totalInvested)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Returned:</span>
                    <span className="ml-2 font-medium">{formatCurrency(worstTrade.totalReturned)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loss:</span>
                    <span className="ml-2 font-medium text-red-500">{worstTrade.pnlPercent.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hold:</span>
                    <span className="ml-2 font-medium">{worstTrade.holdDurationDays} days</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    What Went Wrong
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {worstTrade.pnlPercent < -50 && (
                      <p>• Lost {Math.abs(worstTrade.pnlPercent).toFixed(0)}% - consider using stop losses</p>
                    )}
                    {worstTrade.numBuys > 2 && worstTrade.realizedPnl < 0 && (
                      <p>• Averaged down {worstTrade.numBuys} times into a losing position</p>
                    )}
                    {worstTrade.holdDurationDays <= 1 && (
                      <p>• Panic sold within {worstTrade.holdDurationDays} day - was it too early?</p>
                    )}
                    {worstTrade.totalInvested > (analytics.avgWin + Math.abs(analytics.avgLoss)) && (
                      <p>• Position size was larger than average - size down on uncertain plays</p>
                    )}
                    {worstTrade.note?.reflection && (
                      <p className="italic mt-2">"{worstTrade.note.reflection.substring(0, 100)}{worstTrade.note.reflection.length > 100 ? '...' : ''}"</p>
                    )}
                    {worstTrade.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {worstTrade.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No losing trades yet - nice!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights & Tips */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Insights & Tips
            </CardTitle>
            <CardDescription>
              Personalized analysis based on your trading patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    insight.type === 'success' ? 'border-green-500/30 bg-green-500/5' :
                    insight.type === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                    insight.type === 'tip' ? 'border-blue-500/30 bg-blue-500/5' :
                    'border-purple-500/30 bg-purple-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div>
                      <h4 className="font-semibold">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Win/Loss Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
            <CardDescription>Breakdown of winning vs losing positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500" />
                <span className="text-sm">Wins ({analytics.winners})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500" />
                <span className="text-sm">Losses ({analytics.losers})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly P&L */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly P&L</CardTitle>
            <CardDescription>Your performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Bar
                      dataKey="pnl"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No monthly data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {analytics.totalTrades === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No closed positions yet</h3>
            <p className="text-muted-foreground">
              Close some positions to see your analytics here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
