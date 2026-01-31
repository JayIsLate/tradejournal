'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import type { Trade, TradeDirection, TradeStatus } from '@/lib/types'
import { calculatePnl, platforms, chains } from '@/lib/utils'

export default function EditTradePage() {
  const params = useParams()
  const router = useRouter()
  const tradeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trade, setTrade] = useState<Trade | null>(null)

  // Form fields
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [tokenChain, setTokenChain] = useState('')
  const [tokenContractAddress, setTokenContractAddress] = useState('')
  const [direction, setDirection] = useState<TradeDirection>('buy')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [exitDate, setExitDate] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState<TradeStatus>('open')

  useEffect(() => {
    async function loadTrade() {
      try {
        const data = await db.getTrade(tradeId)
        if (!data) {
          router.push('/trades')
          return
        }
        setTrade(data)
        setTokenSymbol(data.token_symbol)
        setTokenName(data.token_name || '')
        setTokenChain(data.token_chain || '')
        setTokenContractAddress(data.token_contract_address || '')
        setDirection(data.direction)
        setEntryPrice(data.entry_price.toString())
        setExitPrice(data.exit_price?.toString() || '')
        setQuantity(data.quantity.toString())
        setEntryDate(data.entry_date)
        setExitDate(data.exit_date || '')
        setPlatform(data.platform || '')
        setStatus(data.status)
      } catch (error) {
        console.error('Failed to load trade:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTrade()
  }, [tradeId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trade) return

    setSaving(true)

    try {
      const entry = parseFloat(entryPrice)
      const exit = exitPrice ? parseFloat(exitPrice) : null
      const qty = parseFloat(quantity)
      const totalValue = entry * qty

      let pnlAmount: number | null = null
      let pnlPercent: number | null = null

      if (exit !== null && status === 'closed') {
        const pnl = calculatePnl(entry, exit, qty, direction)
        pnlAmount = pnl.amount
        pnlPercent = pnl.percent
      }

      await db.updateTrade(trade.id, {
        token_symbol: tokenSymbol.toUpperCase(),
        token_name: tokenName || null,
        token_chain: tokenChain || null,
        token_contract_address: tokenContractAddress || null,
        direction,
        entry_price: entry,
        exit_price: exit,
        quantity: qty,
        total_value: totalValue,
        entry_date: entryDate,
        exit_date: exitDate || null,
        platform: platform || null,
        status,
        pnl_amount: pnlAmount,
        pnl_percent: pnlPercent,
      })

      router.push(`/trades/${trade.id}`)
    } catch (error) {
      console.error('Failed to update trade:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!trade) return null

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/trades/${trade.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Trade</h1>
          <p className="text-muted-foreground">Update trade details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Info */}
        <Card>
          <CardHeader>
            <CardTitle>Token Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="symbol">Token Symbol *</Label>
              <Input
                id="symbol"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Token Name</Label>
              <Input
                id="name"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chain">Chain</Label>
              <Select value={tokenChain} onChange={(e) => setTokenChain(e.target.value)}>
                <option value="">Select chain</option>
                {chains.map((chain) => (
                  <option key={chain} value={chain}>{chain}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract">Contract Address</Label>
              <Input
                id="contract"
                value={tokenContractAddress}
                onChange={(e) => setTokenContractAddress(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trade Details */}
        <Card>
          <CardHeader>
            <CardTitle>Trade Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction *</Label>
              <Select
                value={direction}
                onChange={(e) => setDirection(e.target.value as TradeDirection)}
              >
                <option value="buy">Buy (Long)</option>
                <option value="sell">Sell (Short)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TradeStatus)}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="partial">Partial</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price *</Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exitPrice">Exit Price</Label>
              <Input
                id="exitPrice"
                type="number"
                step="any"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="">Select platform</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryDate">Entry Date *</Label>
              <Input
                id="entryDate"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exitDate">Exit Date</Label>
              <Input
                id="exitDate"
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Link href={`/trades/${trade.id}`} className="flex-1">
            <Button variant="outline" className="w-full" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
