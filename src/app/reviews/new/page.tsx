'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, Review, ReviewType } from '@/lib/types'
import { generateId, formatCurrency, formatPercent, formatDate, getPnlColor, getStatusColor } from '@/lib/utils'

export default function NewReviewPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [trades, setTrades] = useState<Trade[]>([])
  const [filteredTrades, setFilteredTrades] = useState<Trade[]>([])

  // Form fields
  const [type, setType] = useState<ReviewType>('weekly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [content, setContent] = useState('')
  const [keyLearnings, setKeyLearnings] = useState('')

  useEffect(() => {
    // Set default date range based on type
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    let start: string

    if (type === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      start = weekAgo.toISOString().split('T')[0]
    } else if (type === 'monthly') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      start = monthAgo.toISOString().split('T')[0]
    } else {
      start = end
    }

    setStartDate(start)
    setEndDate(end)
  }, [type])

  useEffect(() => {
    db.getTrades().then(setTrades)
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      const filtered = trades.filter(
        (t) => t.entry_date >= startDate && t.entry_date <= endDate
      )
      setFilteredTrades(filtered)
    }
  }, [trades, startDate, endDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const review: Review = {
        id: generateId(),
        type,
        date_range_start: startDate,
        date_range_end: endDate,
        content: content || null,
        key_learnings: keyLearnings || null,
        created_at: new Date().toISOString(),
      }

      await db.createReview(review)
      router.push('/reviews')
    } catch (error) {
      console.error('Failed to create review:', error)
    } finally {
      setSaving(false)
    }
  }

  // Calculate stats for filtered trades
  const closedTrades = filteredTrades.filter((t) => t.status === 'closed')
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0)
  const winners = closedTrades.filter((t) => (t.pnl_amount || 0) > 0).length
  const winRate = closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reviews">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Review</h1>
          <p className="text-muted-foreground">Reflect on your trading performance</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Review Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Review Period</CardTitle>
            <CardDescription>Select the time period for this review</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Review Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as ReviewType)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Period Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Period Summary</CardTitle>
            <CardDescription>
              {filteredTrades.length} trades in this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="text-center p-4 bg-muted">
                <div className="text-2xl font-bold">{filteredTrades.length}</div>
                <div className="text-sm text-muted-foreground">Total Trades</div>
              </div>
              <div className="text-center p-4 bg-muted">
                <div className={`text-2xl font-bold ${getPnlColor(totalPnl)}`}>
                  {formatCurrency(totalPnl)}
                </div>
                <div className="text-sm text-muted-foreground">Total P&L</div>
              </div>
              <div className="text-center p-4 bg-muted">
                <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center p-4 bg-muted">
                <div className="text-2xl font-bold">{closedTrades.length}</div>
                <div className="text-sm text-muted-foreground">Closed Trades</div>
              </div>
            </div>

            {/* Trade List */}
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {filteredTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 border"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{trade.token_symbol}</span>
                    <Badge variant="outline" className={getStatusColor(trade.status)}>
                      {trade.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(trade.entry_date)}
                    </span>
                  </div>
                  <div className="text-right">
                    {trade.pnl_amount !== null ? (
                      <span className={`font-medium ${getPnlColor(trade.pnl_amount)}`}>
                        {formatCurrency(trade.pnl_amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Open</span>
                    )}
                  </div>
                </div>
              ))}
              {filteredTrades.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No trades in this period
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reflection */}
        <Card>
          <CardHeader>
            <CardTitle>Reflection</CardTitle>
            <CardDescription>What did you learn during this period?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Overall Reflection</Label>
              <Textarea
                id="content"
                placeholder="How did this period go? What patterns did you notice? What went well or poorly?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyLearnings">Key Learnings</Label>
              <Textarea
                id="keyLearnings"
                placeholder="What are the most important lessons from this period? What will you do differently?"
                value={keyLearnings}
                onChange={(e) => setKeyLearnings(e.target.value)}
                rows={4}
              />
            </div>

            {/* Reflection prompts */}
            <div className="bg-muted p-4">
              <h4 className="font-medium mb-2">Reflection Prompts</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- What was your best trade this period? Why did it work?</li>
                <li>- What was your worst trade? What could you have done differently?</li>
                <li>- Did you follow your trading plan consistently?</li>
                <li>- How did your emotions affect your trading?</li>
                <li>- What will you focus on improving next period?</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Link href="/reviews" className="flex-1">
            <Button variant="outline" className="w-full" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Create Review'}
          </Button>
        </div>
      </form>
    </div>
  )
}
