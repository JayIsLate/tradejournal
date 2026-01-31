'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import type { Trade, TokenNote, Tag } from '@/lib/types'
import { formatCurrency, formatDate, formatPercent, getPnlColor } from '@/lib/utils'
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Users,
  Target,
  Heart,
  Zap
} from 'lucide-react'

interface JournalEntry {
  symbol: string
  name: string | null
  image: string | null
  contractAddress: string | null
  firstTradeDate: string
  totalInvested: number
  totalReturned: number
  realizedPnl: number
  pnlPercent: number
  note: TokenNote | null
  tags: Tag[]
}

interface JournalInsight {
  type: 'lesson' | 'pattern' | 'tip' | 'warning' | 'success'
  title: string
  description: string
  source?: string
}

interface EmotionPerformance {
  state: string
  count: number
  wins: number
  losses: number
  totalPnl: number
  avgPnl: number
}

interface TagPerformance {
  name: string
  count: number
  wins: number
  losses: number
  totalPnl: number
}

interface CopyTraderPerformance {
  name: string
  count: number
  wins: number
  losses: number
  totalPnl: number
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'entries' | 'insights'>('entries')

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      const [trades, allTags, allNotes] = await Promise.all([
        db.getTrades(),
        db.getTags(),
        db.getAllTokenNotes(),
      ])

      // Group trades by token
      const stablecoins = ['USDC', 'USDT', 'PYUSD', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'SOL', 'USD1']
      const tokenMap: Record<string, {
        symbol: string
        name: string | null
        image: string | null
        contractAddress: string | null
        trades: Trade[]
      }> = {}

      trades
        .filter(t => !stablecoins.includes(t.token_symbol.toUpperCase()))
        .forEach(trade => {
          const key = trade.token_symbol.toUpperCase()
          if (!tokenMap[key]) {
            tokenMap[key] = {
              symbol: trade.token_symbol,
              name: trade.token_name,
              image: trade.token_image,
              contractAddress: trade.token_contract_address,
              trades: [],
            }
          }
          if (!tokenMap[key].image && trade.token_image) {
            tokenMap[key].image = trade.token_image
          }
          tokenMap[key].trades.push(trade)
        })

      // Build entries with notes
      const journalEntries: JournalEntry[] = await Promise.all(
        Object.values(tokenMap).map(async (token) => {
          const note = allNotes.find(n => n.token_symbol.toUpperCase() === token.symbol.toUpperCase()) || null
          const tagIds = await db.getTokenTagIds(token.symbol)
          const tags = allTags.filter(t => tagIds.includes(t.id))

          const buys = token.trades.filter(t => t.direction === 'buy')
          const sells = token.trades.filter(t => t.direction === 'sell')

          const totalInvested = buys.reduce((sum, t) => sum + t.total_value, 0)
          const totalReturned = sells.reduce((sum, t) => sum + t.total_value, 0)
          const totalBought = buys.reduce((sum, t) => sum + t.quantity, 0)
          const totalSold = sells.reduce((sum, t) => sum + t.quantity, 0)

          const avgBuyPrice = totalBought > 0 ? totalInvested / totalBought : 0
          const avgSellPrice = totalSold > 0 ? totalReturned / totalSold : 0
          const realizedPnl = totalSold > 0 && avgBuyPrice > 0 ? (avgSellPrice - avgBuyPrice) * totalSold : 0
          const pnlPercent = totalInvested > 0 ? ((totalReturned - totalInvested) / totalInvested) * 100 : 0

          // Get first trade date (earliest buy)
          const firstTradeDate = token.trades
            .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())[0]?.entry_date || ''

          return {
            symbol: token.symbol,
            name: token.name,
            image: token.image,
            contractAddress: token.contractAddress,
            firstTradeDate,
            totalInvested,
            totalReturned,
            realizedPnl,
            pnlPercent,
            note,
            tags,
          }
        })
      )

      // Sort by last updated (note updated_at), falling back to first trade date
      journalEntries.sort((a, b) => {
        const aDate = a.note?.updated_at || a.firstTradeDate
        const bDate = b.note?.updated_at || b.firstTradeDate
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })

      // Only include entries that have saved journal content
      const entriesWithNotes = journalEntries.filter(entry =>
        entry.note?.thesis ||
        entry.note?.reflection ||
        entry.note?.lessons_learned ||
        entry.note?.narrative ||
        entry.tags.length > 0
      )

      setEntries(entriesWithNotes)
    } catch (error) {
      console.error('Failed to load entries:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate insights from journal entries - live updates when entries change
  const { insights, emotionPerformance, tagPerformance, copyTraderPerformance, aggregatedLessons } = useMemo(() => {
    const generatedInsights: JournalInsight[] = []
    const emotionMap: Record<string, EmotionPerformance> = {}
    const tagMap: Record<string, TagPerformance> = {}
    const copyTraderMap: Record<string, CopyTraderPerformance> = {}
    const lessons: string[] = []

    // Entries with P&L data
    const entriesWithPnl = entries.filter(e => e.totalReturned > 0)

    // Analyze each entry
    entries.forEach(entry => {
      const isWin = entry.realizedPnl > 0
      const hasRealized = entry.totalReturned > 0

      // Collect lessons
      if (entry.note?.lessons_learned) {
        lessons.push(entry.note.lessons_learned)
      }

      // Emotion performance
      if (entry.note?.emotional_state && hasRealized) {
        const state = entry.note.emotional_state
        if (!emotionMap[state]) {
          emotionMap[state] = { state, count: 0, wins: 0, losses: 0, totalPnl: 0, avgPnl: 0 }
        }
        emotionMap[state].count++
        emotionMap[state].totalPnl += entry.realizedPnl
        if (isWin) emotionMap[state].wins++
        else emotionMap[state].losses++
      }

      // Tag performance
      if (hasRealized) {
        entry.tags.forEach(tag => {
          if (!tagMap[tag.name]) {
            tagMap[tag.name] = { name: tag.name, count: 0, wins: 0, losses: 0, totalPnl: 0 }
          }
          tagMap[tag.name].count++
          tagMap[tag.name].totalPnl += entry.realizedPnl
          if (isWin) tagMap[tag.name].wins++
          else tagMap[tag.name].losses++
        })
      }

      // Copy trader performance
      const copyTrader = (entry.note as any)?.copy_trader
      if (copyTrader && hasRealized) {
        const traderName = copyTrader.trim().toLowerCase()
        if (!copyTraderMap[traderName]) {
          copyTraderMap[traderName] = { name: copyTrader.trim(), count: 0, wins: 0, losses: 0, totalPnl: 0 }
        }
        copyTraderMap[traderName].count++
        copyTraderMap[traderName].totalPnl += entry.realizedPnl
        if (isWin) copyTraderMap[traderName].wins++
        else copyTraderMap[traderName].losses++
      }
    })

    // Calculate averages for emotion performance
    Object.values(emotionMap).forEach(e => {
      e.avgPnl = e.count > 0 ? e.totalPnl / e.count : 0
    })

    // Generate insights from emotion data
    const emotionArr = Object.values(emotionMap).filter(e => e.count >= 2)
    if (emotionArr.length > 0) {
      const bestEmotion = emotionArr.reduce((best, curr) =>
        curr.avgPnl > best.avgPnl ? curr : best
      )
      const worstEmotion = emotionArr.reduce((worst, curr) =>
        curr.avgPnl < worst.avgPnl ? curr : worst
      )

      if (bestEmotion.avgPnl > 0) {
        generatedInsights.push({
          type: 'success',
          title: `Best State: ${bestEmotion.state.replace('_', ' ')}`,
          description: `When you trade feeling "${bestEmotion.state.replace('_', ' ')}", you average ${formatCurrency(bestEmotion.avgPnl)} per trade with a ${((bestEmotion.wins / bestEmotion.count) * 100).toFixed(0)}% win rate. Try to identify and replicate this mental state.`
        })
      }

      if (worstEmotion.avgPnl < 0 && worstEmotion.state !== bestEmotion.state) {
        generatedInsights.push({
          type: 'warning',
          title: `Avoid Trading When: ${worstEmotion.state.replace('_', ' ')}`,
          description: `Trades made while "${worstEmotion.state.replace('_', ' ')}" average ${formatCurrency(worstEmotion.avgPnl)}. Consider stepping away when you notice this state.`
        })
      }
    }

    // Generate insights from tag data
    const tagArr = Object.values(tagMap).filter(t => t.count >= 2)
    if (tagArr.length > 0) {
      const bestTag = tagArr.reduce((best, curr) =>
        curr.totalPnl > best.totalPnl ? curr : best
      )
      const worstTag = tagArr.reduce((worst, curr) =>
        curr.totalPnl < worst.totalPnl ? curr : worst
      )

      if (bestTag.totalPnl > 0) {
        const winRate = (bestTag.wins / bestTag.count) * 100
        generatedInsights.push({
          type: 'success',
          title: `Best Setup: ${bestTag.name}`,
          description: `"${bestTag.name}" trades have made ${formatCurrency(bestTag.totalPnl)} total with a ${winRate.toFixed(0)}% win rate across ${bestTag.count} positions. Lean into this setup more.`
        })
      }

      if (worstTag.totalPnl < 0 && worstTag.name !== bestTag.name) {
        generatedInsights.push({
          type: 'warning',
          title: `Weak Setup: ${worstTag.name}`,
          description: `"${worstTag.name}" trades are down ${formatCurrency(Math.abs(worstTag.totalPnl))} total. Consider avoiding or reducing size on these setups.`
        })
      }
    }

    // Generate insights from copy trader data
    const traderArr = Object.values(copyTraderMap).filter(t => t.count >= 2)
    if (traderArr.length > 0) {
      const bestTrader = traderArr.reduce((best, curr) =>
        curr.totalPnl > best.totalPnl ? curr : best
      )
      const worstTrader = traderArr.reduce((worst, curr) =>
        curr.totalPnl < worst.totalPnl ? curr : worst
      )

      if (bestTrader.totalPnl > 0) {
        generatedInsights.push({
          type: 'success',
          title: `Best Copy Trader: ${bestTrader.name}`,
          description: `Following ${bestTrader.name}'s calls has made ${formatCurrency(bestTrader.totalPnl)} across ${bestTrader.count} trades. Keep following their alpha.`
        })
      }

      if (worstTrader.totalPnl < 0 && worstTrader.name !== bestTrader.name) {
        generatedInsights.push({
          type: 'warning',
          title: `Reconsider: ${worstTrader.name}`,
          description: `Trades copying ${worstTrader.name} are down ${formatCurrency(Math.abs(worstTrader.totalPnl))}. Either their style doesn't match yours or timing is off.`
        })
      }
    }

    // Analyze confidence levels
    const confidentTrades = entries.filter(e => e.note?.confidence_level && e.note.confidence_level >= 7 && e.totalReturned > 0)
    const lowConfTrades = entries.filter(e => e.note?.confidence_level && e.note.confidence_level <= 4 && e.totalReturned > 0)

    if (confidentTrades.length >= 3 && lowConfTrades.length >= 3) {
      const highConfWinRate = confidentTrades.filter(e => e.realizedPnl > 0).length / confidentTrades.length * 100
      const lowConfWinRate = lowConfTrades.filter(e => e.realizedPnl > 0).length / lowConfTrades.length * 100

      if (highConfWinRate > lowConfWinRate + 15) {
        generatedInsights.push({
          type: 'tip',
          title: 'Trust Your Conviction',
          description: `High confidence trades (7+) win ${highConfWinRate.toFixed(0)}% vs ${lowConfWinRate.toFixed(0)}% for low confidence. Size up on your best ideas and skip the uncertain ones.`
        })
      } else if (lowConfWinRate > highConfWinRate + 15) {
        generatedInsights.push({
          type: 'pattern',
          title: 'Overconfidence Issue',
          description: `Surprisingly, your low-confidence trades (${lowConfWinRate.toFixed(0)}% win rate) outperform high-confidence ones (${highConfWinRate.toFixed(0)}%). You may be overconfident on certain setups.`
        })
      }
    }

    // Thesis presence analysis
    const withThesis = entriesWithPnl.filter(e => e.note?.thesis)
    const withoutThesis = entriesWithPnl.filter(e => !e.note?.thesis)

    if (withThesis.length >= 3 && withoutThesis.length >= 3) {
      const thesisWinRate = withThesis.filter(e => e.realizedPnl > 0).length / withThesis.length * 100
      const noThesisWinRate = withoutThesis.filter(e => e.realizedPnl > 0).length / withoutThesis.length * 100

      if (thesisWinRate > noThesisWinRate + 10) {
        generatedInsights.push({
          type: 'tip',
          title: 'Write Your Thesis',
          description: `Trades where you documented a thesis win ${thesisWinRate.toFixed(0)}% vs ${noThesisWinRate.toFixed(0)}% without. Writing forces clearer thinking - keep doing it!`
        })
      }
    }

    // General tips based on data
    if (entries.length > 0 && entries.filter(e => e.note?.reflection).length < entries.length * 0.3) {
      generatedInsights.push({
        type: 'tip',
        title: 'Reflect More',
        description: `Only ${((entries.filter(e => e.note?.reflection).length / entries.length) * 100).toFixed(0)}% of your entries have reflections. Adding post-trade analysis helps you learn faster from both wins and losses.`
      })
    }

    if (lessons.length === 0 && entries.length > 5) {
      generatedInsights.push({
        type: 'tip',
        title: 'Document Lessons',
        description: `You haven't recorded any lessons learned. After each trade, write down one thing you'd do differently or one thing that worked well.`
      })
    }

    return {
      insights: generatedInsights,
      emotionPerformance: Object.values(emotionMap).sort((a, b) => b.avgPnl - a.avgPnl),
      tagPerformance: Object.values(tagMap).sort((a, b) => b.totalPnl - a.totalPnl),
      copyTraderPerformance: Object.values(copyTraderMap).sort((a, b) => b.totalPnl - a.totalPnl),
      aggregatedLessons: lessons,
    }
  }, [entries])

  const getInsightIcon = (type: JournalInsight['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
      case 'tip': return <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0" />
      case 'pattern': return <Brain className="h-5 w-5 text-purple-500 flex-shrink-0" />
      default: return <Zap className="h-5 w-5 text-orange-500 flex-shrink-0" />
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground text-xs">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-baseline gap-3 md:gap-4 mb-3 md:mb-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold uppercase tracking-[0.2em]">Journal</h1>
          <span className="text-xs text-muted-foreground tabular-nums">{entries.length} entries</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === 'entries'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Entries
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeTab === 'insights'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            Insights
            {insights.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'insights' ? 'bg-background/20' : 'bg-foreground/10'
              }`}>
                {insights.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'entries' ? (
          /* Entries Tab */
          <div className="max-w-3xl mx-auto py-8 px-6">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                No entries yet. Add notes to your positions to see them here.
              </div>
            ) : (
              <div className="divide-y divide-border/0">
                {entries.map((entry) => (
                  <div key={entry.symbol} className="py-10 first:pt-0">
                    {/* Entry Card */}
                    <div className="border-2 border-border/80 rounded-lg overflow-hidden bg-card">
                      {/* Entry Header Bar */}
                      <div className="px-6 py-4 border-b border-border/40 bg-muted/30 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {entry.image ? (
                              <img src={entry.image} alt="" className="w-6 h-6 rounded" />
                            ) : (
                              <div className="w-6 h-6 bg-muted flex items-center justify-center text-[10px] font-bold rounded">
                                {entry.symbol.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold">{entry.symbol}</span>
                            {entry.name && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">{entry.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(entry.firstTradeDate)}
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="px-6 py-4 border-b border-border/30 bg-muted/10">
                        <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs tabular-nums">
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">In</span>
                              <span className="font-medium">{formatCurrency(entry.totalInvested)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Out</span>
                              <span className="font-medium">{formatCurrency(entry.totalReturned)}</span>
                            </div>
                          </div>
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground uppercase tracking-wider text-[10px]">P&L</span>
                              <span className={`font-bold ${getPnlColor(entry.realizedPnl)}`}>
                                {formatCurrency(entry.realizedPnl)}
                              </span>
                            </div>
                            {entry.pnlPercent !== 0 && entry.totalReturned > 0 && (
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${getPnlColor(entry.realizedPnl)}`}>
                                  {formatPercent(entry.pnlPercent)}
                                </span>
                              </div>
                            )}
                          </div>
                          {(entry.note?.confidence_level || entry.note?.emotional_state) && (
                            <div className="flex gap-6">
                              {entry.note?.confidence_level && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Conf</span>
                                  <span className="font-medium">{entry.note.confidence_level}/10</span>
                                </div>
                              )}
                              {entry.note?.emotional_state && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground uppercase tracking-wider text-[10px]">State</span>
                                  <span className="font-medium capitalize">{entry.note.emotional_state.replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Entry Content */}
                      <div className="p-6">
                        <div className="flex flex-col gap-6">
                          {entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {entry.tags.map(tag => (
                                <span
                                  key={tag.id}
                                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-foreground/60 rounded-full"
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.note?.thesis && (
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground mb-2 underline underline-offset-4">
                                Thesis
                              </h3>
                              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{entry.note.thesis}</p>
                            </div>
                          )}
                          {entry.note?.reflection && (
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground mb-2 underline underline-offset-4">
                                Reflection
                              </h3>
                              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{entry.note.reflection}</p>
                            </div>
                          )}
                          {entry.note?.lessons_learned && (
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground mb-2 underline underline-offset-4">
                                Lessons
                              </h3>
                              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{entry.note.lessons_learned}</p>
                            </div>
                          )}
                          {(entry.note as any)?.sell_reason && (
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground mb-2 underline underline-offset-4">
                                Sell Reason
                              </h3>
                              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{(entry.note as any).sell_reason}</p>
                            </div>
                          )}
                          {(entry.note as any)?.copy_trader && (
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground mb-2 underline underline-offset-4">
                                Copy Trade
                              </h3>
                              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{(entry.note as any).copy_trader}</p>
                            </div>
                          )}
                          {!entry.note?.thesis && !entry.note?.reflection && !entry.note?.lessons_learned && entry.tags.length === 0 && (
                            <div className="text-xs text-muted-foreground/50">
                              No notes recorded
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Insights Tab */
          <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
            {entries.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground">
                Add journal entries to see personalized insights.
              </div>
            ) : (
              <>
                {/* Key Insights */}
                {insights.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Key Insights
                    </h2>
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
                  </div>
                )}

                {/* Emotion Performance */}
                {emotionPerformance.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Performance by Emotional State
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {emotionPerformance.map(emotion => {
                        const winRate = emotion.count > 0 ? (emotion.wins / emotion.count) * 100 : 0
                        return (
                          <div key={emotion.state} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium capitalize">{emotion.state.replace('_', ' ')}</span>
                              <span className={`font-bold ${getPnlColor(emotion.avgPnl)}`}>
                                {formatCurrency(emotion.avgPnl)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emotion.count} trades • {winRate.toFixed(0)}% win rate • {formatCurrency(emotion.totalPnl)} total
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Tag Performance */}
                {tagPerformance.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Performance by Tag/Setup
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {tagPerformance.map(tag => {
                        const winRate = tag.count > 0 ? (tag.wins / tag.count) * 100 : 0
                        return (
                          <div key={tag.name} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{tag.name}</span>
                              <span className={`font-bold ${getPnlColor(tag.totalPnl)}`}>
                                {formatCurrency(tag.totalPnl)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tag.count} trades • {winRate.toFixed(0)}% win rate
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Copy Trader Performance */}
                {copyTraderPerformance.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Copy Trader Performance
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {copyTraderPerformance.map(trader => {
                        const winRate = trader.count > 0 ? (trader.wins / trader.count) * 100 : 0
                        return (
                          <div key={trader.name} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{trader.name}</span>
                              <span className={`font-bold ${getPnlColor(trader.totalPnl)}`}>
                                {formatCurrency(trader.totalPnl)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {trader.count} trades • {winRate.toFixed(0)}% win rate
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Aggregated Lessons */}
                {aggregatedLessons.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Your Lessons Learned
                    </h2>
                    <div className="space-y-3">
                      {aggregatedLessons.slice(0, 10).map((lesson, index) => (
                        <div key={index} className="p-4 border rounded-lg bg-muted/30">
                          <p className="text-sm whitespace-pre-wrap">{lesson}</p>
                        </div>
                      ))}
                      {aggregatedLessons.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center">
                          + {aggregatedLessons.length - 10} more lessons in your entries
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty insights state */}
                {insights.length === 0 && emotionPerformance.length === 0 && tagPerformance.length === 0 && (
                  <div className="text-center py-16">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Keep Journaling</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Add emotional states, tags, and close more positions to unlock personalized insights about your trading patterns.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
