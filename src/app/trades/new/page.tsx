'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/db'
import type { Trade, TradeNote, TradeDirection, TradeStatus, EmotionalState } from '@/lib/types'
import { generateId, calculatePnl, emotionalStates, platforms, chains } from '@/lib/utils'

export default function NewTradePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Trade fields
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [tokenChain, setTokenChain] = useState('')
  const [tokenContractAddress, setTokenContractAddress] = useState('')
  const [direction, setDirection] = useState<TradeDirection>('buy')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [exitDate, setExitDate] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState<TradeStatus>('open')

  // Note fields
  const [preTradeThesis, setPreTradeThesis] = useState('')
  const [marketNarrative, setMarketNarrative] = useState('')
  const [confidenceLevel, setConfidenceLevel] = useState(5)
  const [emotionalState, setEmotionalState] = useState<EmotionalState | ''>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const tradeId = generateId()
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

      const trade: Trade = {
        id: tradeId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        token_symbol: tokenSymbol.toUpperCase(),
        token_name: tokenName || null,
        token_chain: tokenChain || null,
        token_contract_address: tokenContractAddress || null,
        token_image: null,
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
        market_cap_at_trade: null,
        base_currency: null, // Unknown for manual entry
        base_currency_usd_price: null,
        total_value_usd: totalValue, // Assume manual entries are in USD
      }

      await db.createTrade(trade)

      // Save note if any content provided
      if (preTradeThesis || marketNarrative || emotionalState) {
        const note: Partial<TradeNote> & { trade_id: string; id: string } = {
          id: generateId(),
          trade_id: tradeId,
          pre_trade_thesis: preTradeThesis || null,
          market_narrative: marketNarrative || null,
          confidence_level: confidenceLevel,
          emotional_state: emotionalState || null,
        }
        await db.upsertTradeNote(note)
      }

      router.push(`/trades/${tradeId}`)
    } catch (error) {
      console.error('Failed to create trade:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/trades">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Trade</h1>
          <p className="text-muted-foreground">Log a new trade entry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Info */}
        <Card>
          <CardHeader>
            <CardTitle>Token Information</CardTitle>
            <CardDescription>Basic details about the token you traded</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="symbol">Token Symbol *</Label>
              <Input
                id="symbol"
                placeholder="e.g., SOL, ETH, BONK"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Token Name</Label>
              <Input
                id="name"
                placeholder="e.g., Solana, Ethereum"
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
                placeholder="0x... or Solana address"
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
            <CardDescription>Entry, exit, and position information</CardDescription>
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
                placeholder="0.00"
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
                placeholder="0.00"
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
                placeholder="0"
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

        {/* Pre-Trade Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-Trade Journaling</CardTitle>
            <CardDescription>Document your thesis and emotional state before entering</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thesis">What&apos;s your thesis for this trade?</Label>
              <Textarea
                id="thesis"
                placeholder="Why are you entering this trade? What's the expected outcome?"
                value={preTradeThesis}
                onChange={(e) => setPreTradeThesis(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="narrative">What narrative/catalyst is driving this?</Label>
              <Textarea
                id="narrative"
                placeholder="Market conditions, news, technical setup, etc."
                value={marketNarrative}
                onChange={(e) => setMarketNarrative(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>How confident are you? (1-10)</Label>
                <Slider
                  value={confidenceLevel}
                  onValueChange={setConfidenceLevel}
                  min={1}
                  max={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emotion">How are you feeling emotionally?</Label>
                <Select
                  value={emotionalState}
                  onChange={(e) => setEmotionalState(e.target.value as EmotionalState)}
                >
                  <option value="">Select emotional state</option>
                  {emotionalStates.map((state) => (
                    <option key={state.value} value={state.value}>{state.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Link href="/trades" className="flex-1">
            <Button variant="outline" className="w-full" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Saving...' : 'Create Trade'}
          </Button>
        </div>
      </form>
    </div>
  )
}
