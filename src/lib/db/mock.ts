import type { Trade, TradeNote, TokenNote, Tag, Influencer, InfluencerCall, Review, TradeFilters, Analytics, SearchResult } from '@/lib/types'

// localStorage keys
const STORAGE_KEYS = {
  trades: 'tj_trades',
  tradeNotes: 'tj_trade_notes',
  tokenNotes: 'tj_token_notes',
  tags: 'tj_tags',
  tradeTags: 'tj_trade_tags',
  tokenTags: 'tj_token_tags',
  influencers: 'tj_influencers',
  influencerCalls: 'tj_influencer_calls',
  reviews: 'tj_reviews',
  settings: 'tj_settings',
  hiddenTokens: 'tj_hidden_tokens',
}

// Helper to safely access localStorage (not available during SSR)
const getStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

const setStorage = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

// In-memory storage with localStorage persistence
let trades: Trade[] = []
let tradeNotes: TradeNote[] = []
let tokenNotes: TokenNote[] = []
let tags: Tag[] = []
let tradeTags: { trade_id: string; tag_id: string }[] = []
let tokenTags: { token_symbol: string; tag_id: string }[] = []
let influencers: Influencer[] = []
let influencerCalls: InfluencerCall[] = []
let reviews: Review[] = []
let settings: Record<string, string> = {}
let hiddenTokens: string[] = [] // Contract addresses or symbols of hidden tokens

// Initialize from localStorage on first access
let initialized = false
const initFromStorage = () => {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  trades = getStorage(STORAGE_KEYS.trades, [])
  tradeNotes = getStorage(STORAGE_KEYS.tradeNotes, [])
  tokenNotes = getStorage(STORAGE_KEYS.tokenNotes, [])
  tags = getStorage(STORAGE_KEYS.tags, [])
  tradeTags = getStorage(STORAGE_KEYS.tradeTags, [])
  tokenTags = getStorage(STORAGE_KEYS.tokenTags, [])
  influencers = getStorage(STORAGE_KEYS.influencers, [])
  influencerCalls = getStorage(STORAGE_KEYS.influencerCalls, [])
  reviews = getStorage(STORAGE_KEYS.reviews, [])
  settings = getStorage(STORAGE_KEYS.settings, {})
  hiddenTokens = getStorage(STORAGE_KEYS.hiddenTokens, [])
}

export const mockApi = {
  // Trades
  getTrades: async (filters?: TradeFilters): Promise<Trade[]> => {
    initFromStorage()
    let result = [...trades]

    if (filters?.status) {
      result = result.filter(t => t.status === filters.status)
    }
    if (filters?.startDate) {
      result = result.filter(t => t.entry_date >= filters.startDate!)
    }
    if (filters?.endDate) {
      result = result.filter(t => t.entry_date <= filters.endDate!)
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(t =>
        t.token_symbol.toLowerCase().includes(search) ||
        t.token_name?.toLowerCase().includes(search)
      )
    }

    return result.sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  },

  getTrade: async (id: string): Promise<Trade | undefined> => {
    initFromStorage()
    return trades.find(t => t.id === id)
  },

  createTrade: async (trade: Trade): Promise<Trade> => {
    initFromStorage()
    trades.push(trade)
    setStorage(STORAGE_KEYS.trades, trades)
    return trade
  },

  updateTrade: async (id: string, updates: Partial<Trade>): Promise<Trade> => {
    initFromStorage()
    const index = trades.findIndex(t => t.id === id)
    if (index !== -1) {
      trades[index] = { ...trades[index], ...updates, updated_at: new Date().toISOString() }
      setStorage(STORAGE_KEYS.trades, trades)
      return trades[index]
    }
    throw new Error('Trade not found')
  },

  deleteTrade: async (id: string): Promise<{ success: boolean }> => {
    initFromStorage()
    trades = trades.filter(t => t.id !== id)
    tradeNotes = tradeNotes.filter(n => n.trade_id !== id)
    tradeTags = tradeTags.filter(tt => tt.trade_id !== id)
    setStorage(STORAGE_KEYS.trades, trades)
    setStorage(STORAGE_KEYS.tradeNotes, tradeNotes)
    setStorage(STORAGE_KEYS.tradeTags, tradeTags)
    return { success: true }
  },

  // Trade Notes
  getTradeNote: async (tradeId: string): Promise<TradeNote | undefined> => {
    initFromStorage()
    return tradeNotes.find(n => n.trade_id === tradeId)
  },

  upsertTradeNote: async (note: Partial<TradeNote> & { trade_id: string; id: string }): Promise<TradeNote> => {
    initFromStorage()
    const index = tradeNotes.findIndex(n => n.trade_id === note.trade_id)
    const now = new Date().toISOString()

    if (index !== -1) {
      tradeNotes[index] = { ...tradeNotes[index], ...note, updated_at: now } as TradeNote
      setStorage(STORAGE_KEYS.tradeNotes, tradeNotes)
      return tradeNotes[index]
    } else {
      const newNote: TradeNote = {
        id: note.id,
        trade_id: note.trade_id,
        pre_trade_thesis: note.pre_trade_thesis || null,
        market_narrative: note.market_narrative || null,
        post_trade_reflection: note.post_trade_reflection || null,
        lessons_learned: note.lessons_learned || null,
        rich_content: note.rich_content || null,
        confidence_level: note.confidence_level || null,
        emotional_state: note.emotional_state || null,
        created_at: now,
        updated_at: now
      }
      tradeNotes.push(newNote)
      setStorage(STORAGE_KEYS.tradeNotes, tradeNotes)
      return newNote
    }
  },

  // Token Notes (position-level)
  getTokenNote: async (tokenSymbol: string): Promise<TokenNote | undefined> => {
    initFromStorage()
    return tokenNotes.find(n => n.token_symbol.toUpperCase() === tokenSymbol.toUpperCase())
  },

  getAllTokenNotes: async (): Promise<TokenNote[]> => {
    initFromStorage()
    return [...tokenNotes]
  },

  upsertTokenNote: async (note: Partial<TokenNote> & { token_symbol: string; id: string }): Promise<TokenNote> => {
    initFromStorage()
    const index = tokenNotes.findIndex(n => n.token_symbol.toUpperCase() === note.token_symbol.toUpperCase())
    const now = new Date().toISOString()

    if (index !== -1) {
      tokenNotes[index] = { ...tokenNotes[index], ...note, updated_at: now } as TokenNote
      setStorage(STORAGE_KEYS.tokenNotes, tokenNotes)
      return tokenNotes[index]
    } else {
      const newNote: TokenNote = {
        id: note.id,
        token_symbol: note.token_symbol.toUpperCase(),
        thesis: note.thesis || null,
        narrative: note.narrative || null,
        reflection: note.reflection || null,
        lessons_learned: note.lessons_learned || null,
        rich_content: note.rich_content || null,
        confidence_level: note.confidence_level || null,
        emotional_state: note.emotional_state || null,
        sell_reason: (note as any).sell_reason || null,
        copy_trader: (note as any).copy_trader || null,
        created_at: now,
        updated_at: now
      }
      tokenNotes.push(newNote)
      setStorage(STORAGE_KEYS.tokenNotes, tokenNotes)
      return newNote
    }
  },

  // Tags
  getTags: async (): Promise<Tag[]> => {
    initFromStorage()
    return [...tags]
  },

  createTag: async (tag: Tag): Promise<Tag> => {
    initFromStorage()
    tags.push(tag)
    setStorage(STORAGE_KEYS.tags, tags)
    return tag
  },

  deleteTag: async (id: string): Promise<{ success: boolean }> => {
    initFromStorage()
    tags = tags.filter(t => t.id !== id)
    tradeTags = tradeTags.filter(tt => tt.tag_id !== id)
    setStorage(STORAGE_KEYS.tags, tags)
    setStorage(STORAGE_KEYS.tradeTags, tradeTags)
    return { success: true }
  },

  getTradeTagIds: async (tradeId: string): Promise<string[]> => {
    initFromStorage()
    return tradeTags.filter(tt => tt.trade_id === tradeId).map(tt => tt.tag_id)
  },

  setTradeTags: async (tradeId: string, tagIds: string[]): Promise<{ success: boolean }> => {
    initFromStorage()
    tradeTags = tradeTags.filter(tt => tt.trade_id !== tradeId)
    tagIds.forEach(tagId => tradeTags.push({ trade_id: tradeId, tag_id: tagId }))
    setStorage(STORAGE_KEYS.tradeTags, tradeTags)
    return { success: true }
  },

  // Token Tags (position-level)
  getTokenTagIds: async (tokenSymbol: string): Promise<string[]> => {
    initFromStorage()
    return tokenTags.filter(tt => tt.token_symbol.toUpperCase() === tokenSymbol.toUpperCase()).map(tt => tt.tag_id)
  },

  setTokenTags: async (tokenSymbol: string, tagIds: string[]): Promise<{ success: boolean }> => {
    initFromStorage()
    const upperSymbol = tokenSymbol.toUpperCase()
    tokenTags = tokenTags.filter(tt => tt.token_symbol.toUpperCase() !== upperSymbol)
    // Guard against undefined tagIds
    if (tagIds && Array.isArray(tagIds)) {
      tagIds.forEach(tagId => tokenTags.push({ token_symbol: upperSymbol, tag_id: tagId }))
    }
    setStorage(STORAGE_KEYS.tokenTags, tokenTags)
    return { success: true }
  },

  // Influencers
  getInfluencers: async (): Promise<Influencer[]> => {
    initFromStorage()
    return [...influencers]
  },

  getInfluencer: async (id: string): Promise<Influencer | undefined> => {
    initFromStorage()
    return influencers.find(i => i.id === id)
  },

  createInfluencer: async (influencer: Influencer): Promise<Influencer> => {
    initFromStorage()
    influencers.push(influencer)
    setStorage(STORAGE_KEYS.influencers, influencers)
    return influencer
  },

  updateInfluencer: async (id: string, updates: Partial<Influencer>): Promise<Influencer> => {
    initFromStorage()
    const index = influencers.findIndex(i => i.id === id)
    if (index !== -1) {
      influencers[index] = { ...influencers[index], ...updates }
      setStorage(STORAGE_KEYS.influencers, influencers)
      return influencers[index]
    }
    throw new Error('Influencer not found')
  },

  deleteInfluencer: async (id: string): Promise<{ success: boolean }> => {
    initFromStorage()
    influencers = influencers.filter(i => i.id !== id)
    influencerCalls = influencerCalls.filter(c => c.influencer_id !== id)
    setStorage(STORAGE_KEYS.influencers, influencers)
    setStorage(STORAGE_KEYS.influencerCalls, influencerCalls)
    return { success: true }
  },

  // Influencer Calls
  getInfluencerCalls: async (influencerId?: string): Promise<InfluencerCall[]> => {
    initFromStorage()
    if (influencerId) {
      return influencerCalls.filter(c => c.influencer_id === influencerId)
    }
    return [...influencerCalls]
  },

  createInfluencerCall: async (call: InfluencerCall): Promise<InfluencerCall> => {
    initFromStorage()
    influencerCalls.push(call)
    setStorage(STORAGE_KEYS.influencerCalls, influencerCalls)
    return call
  },

  updateInfluencerCall: async (id: string, updates: Partial<InfluencerCall>): Promise<InfluencerCall> => {
    initFromStorage()
    const index = influencerCalls.findIndex(c => c.id === id)
    if (index !== -1) {
      influencerCalls[index] = { ...influencerCalls[index], ...updates }
      setStorage(STORAGE_KEYS.influencerCalls, influencerCalls)
      return influencerCalls[index]
    }
    throw new Error('Influencer call not found')
  },

  deleteInfluencerCall: async (id: string): Promise<{ success: boolean }> => {
    initFromStorage()
    influencerCalls = influencerCalls.filter(c => c.id !== id)
    setStorage(STORAGE_KEYS.influencerCalls, influencerCalls)
    return { success: true }
  },

  // Reviews
  getReviews: async (): Promise<Review[]> => {
    initFromStorage()
    return [...reviews]
  },

  getReview: async (id: string): Promise<Review | undefined> => {
    initFromStorage()
    return reviews.find(r => r.id === id)
  },

  createReview: async (review: Review): Promise<Review> => {
    initFromStorage()
    reviews.push(review)
    setStorage(STORAGE_KEYS.reviews, reviews)
    return review
  },

  updateReview: async (id: string, updates: Partial<Review>): Promise<Review> => {
    initFromStorage()
    const index = reviews.findIndex(r => r.id === id)
    if (index !== -1) {
      reviews[index] = { ...reviews[index], ...updates }
      setStorage(STORAGE_KEYS.reviews, reviews)
      return reviews[index]
    }
    throw new Error('Review not found')
  },

  deleteReview: async (id: string): Promise<{ success: boolean }> => {
    initFromStorage()
    reviews = reviews.filter(r => r.id !== id)
    setStorage(STORAGE_KEYS.reviews, reviews)
    return { success: true }
  },

  // Settings
  getSetting: async (key: string): Promise<string | undefined> => {
    initFromStorage()
    return settings[key]
  },

  setSetting: async (key: string, value: string): Promise<{ success: boolean }> => {
    initFromStorage()
    settings[key] = value
    setStorage(STORAGE_KEYS.settings, settings)
    return { success: true }
  },

  // Analytics
  getAnalytics: async (dateRange?: { start?: string; end?: string }): Promise<Analytics> => {
    initFromStorage()
    let filtered = trades.filter(t => t.status === 'closed')

    if (dateRange?.start) {
      filtered = filtered.filter(t => t.entry_date >= dateRange.start!)
    }
    if (dateRange?.end) {
      filtered = filtered.filter(t => t.entry_date <= dateRange.end!)
    }

    const winners = filtered.filter(t => (t.pnl_amount || 0) > 0)
    const losers = filtered.filter(t => (t.pnl_amount || 0) < 0)
    const totalPnl = filtered.reduce((sum, t) => sum + (t.pnl_amount || 0), 0)
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / winners.length : 0
    const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / losers.length : 0

    return {
      totalTrades: filtered.length,
      winners: winners.length,
      losers: losers.length,
      winRate: filtered.length > 0 ? (winners.length / filtered.length) * 100 : 0,
      totalPnl,
      avgWin,
      avgLoss,
      biggestWin: Math.max(0, ...filtered.map(t => t.pnl_amount || 0)),
      biggestLoss: Math.min(0, ...filtered.map(t => t.pnl_amount || 0)),
      profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
      byTag: [],
      byEmotion: [],
      monthlyPnl: []
    }
  },

  // Bulk import
  bulkImportTrades: async (newTrades: Trade[]): Promise<{ success: boolean; count: number }> => {
    initFromStorage()
    trades.push(...newTrades)
    setStorage(STORAGE_KEYS.trades, trades)
    return { success: true, count: newTrades.length }
  },

  // Remove duplicate trades
  removeDuplicateTrades: async (): Promise<{ removed: number; kept: number }> => {
    initFromStorage()

    const duplicates: string[] = []

    // Strategy 1: Remove exact duplicates by tx_signature
    const sigSeen = new Map<string, Trade>()
    for (const trade of trades) {
      const sig = (trade as any).tx_signature
      if (sig) {
        if (sigSeen.has(sig)) {
          // Keep the one with the signature that was created first
          duplicates.push(trade.id)
        } else {
          sigSeen.set(sig, trade)
        }
      }
    }

    // Strategy 2: Remove unsigned trades that match a signed trade
    // (same symbol OR contract address, direction, date, and similar value)
    const signedTrades = trades.filter(t => (t as any).tx_signature)
    const unsignedTrades = trades.filter(t => !(t as any).tx_signature)

    // Build index of signed trades by date for faster lookup
    const signedByDate = new Map<string, Trade[]>()
    for (const signed of signedTrades) {
      const date = signed.entry_date.split('T')[0]
      if (!signedByDate.has(date)) signedByDate.set(date, [])
      signedByDate.get(date)!.push(signed)
    }

    for (const unsigned of unsignedTrades) {
      if (duplicates.includes(unsigned.id)) continue
      const dateOnly = unsigned.entry_date.split('T')[0]
      const value = unsigned.total_value
      const candidates = signedByDate.get(dateOnly) || []

      // Match by symbol OR contract address
      const match = candidates.find(signed => {
        if (signed.direction !== unsigned.direction) return false
        // Match by symbol or contract address
        const symbolMatch = signed.token_symbol.toUpperCase() === unsigned.token_symbol.toUpperCase()
        const contractMatch = signed.token_contract_address && unsigned.token_contract_address &&
          signed.token_contract_address.toLowerCase() === unsigned.token_contract_address.toLowerCase()
        if (!symbolMatch && !contractMatch) return false
        // Check if value is within 10% tolerance
        const valueDiff = Math.abs(signed.total_value - value)
        const tolerance = Math.max(value * 0.1, 0.5) // 10% or $0.50
        return valueDiff <= tolerance
      })

      if (match) {
        duplicates.push(unsigned.id)
        console.log(`Removing unsigned duplicate: ${unsigned.token_symbol} $${value.toFixed(2)} on ${dateOnly} (matches signed trade)`)
      }
    }

    // Also remove $0.00 value trades (clearly broken)
    for (const trade of trades) {
      if (!duplicates.includes(trade.id) && trade.total_value === 0 && trade.entry_price === 0) {
        duplicates.push(trade.id)
        console.log(`Removing zero-value trade: ${trade.token_symbol}`)
      }
    }

    // Strategy 3: Standard key-based dedup for remaining trades
    const remaining = trades.filter(t => !duplicates.includes(t.id))
    const keySeen = new Map<string, Trade>()
    // Sort: prefer trades WITH signatures (put them first)
    const sorted = [...remaining].sort((a, b) => {
      const aHasSig = (a as any).tx_signature ? 0 : 1
      const bHasSig = (b as any).tx_signature ? 0 : 1
      return aHasSig - bHasSig
    })

    for (const trade of sorted) {
      if (duplicates.includes(trade.id)) continue
      const qtyRounded = trade.quantity.toFixed(2)
      // Use contract address as primary identifier, fall back to symbol
      const tokenId = trade.token_contract_address?.toLowerCase() || trade.token_symbol.toUpperCase()
      // Use full timestamp for more precise matching
      const key = `${tokenId}-${trade.direction}-${qtyRounded}-${trade.entry_date}`

      if (keySeen.has(key)) {
        duplicates.push(trade.id)
        console.log(`Removing key duplicate: ${trade.token_symbol} qty=${qtyRounded} on ${trade.entry_date}`)
      } else {
        keySeen.set(key, trade)
      }
    }

    // Strategy 4b: Remove exact duplicates (same qty, price, value, date - even if different IDs)
    const exactSeen = new Map<string, Trade>()
    const remaining2 = trades.filter(t => !duplicates.includes(t.id))
    for (const trade of remaining2) {
      const tokenId = trade.token_contract_address?.toLowerCase() || trade.token_symbol.toUpperCase()
      const exactKey = `${tokenId}-${trade.direction}-${trade.quantity}-${trade.entry_price}-${trade.total_value}-${trade.entry_date}`
      if (exactSeen.has(exactKey)) {
        duplicates.push(trade.id)
        console.log(`Removing exact duplicate: ${trade.token_symbol}`)
      } else {
        exactSeen.set(exactKey, trade)
      }
    }

    // Strategy 4: Normalize token symbols for remaining trades (fix case mismatches like CLAWD vs clawd)
    const finalRemaining = trades.filter(t => !duplicates.includes(t.id))
    const contractToSymbol = new Map<string, string>()
    for (const trade of finalRemaining) {
      if (trade.token_contract_address) {
        const contract = trade.token_contract_address.toLowerCase()
        if (!contractToSymbol.has(contract)) {
          contractToSymbol.set(contract, trade.token_symbol.toUpperCase())
        }
      }
    }
    // Log any mismatched symbols (for debugging)
    for (const trade of finalRemaining) {
      if (trade.token_contract_address) {
        const contract = trade.token_contract_address.toLowerCase()
        const expected = contractToSymbol.get(contract)
        if (expected && trade.token_symbol.toUpperCase() !== expected) {
          console.log(`Symbol mismatch: ${trade.token_symbol} vs ${expected} for contract ${contract}`)
        }
      }
    }

    // Remove all identified duplicates
    const uniqueDuplicates = [...new Set(duplicates)]
    if (uniqueDuplicates.length > 0) {
      trades = trades.filter(t => !uniqueDuplicates.includes(t.id))
      setStorage(STORAGE_KEYS.trades, trades)
    }

    console.log(`Removed ${uniqueDuplicates.length} duplicate trades, kept ${trades.length}`)
    return { removed: uniqueDuplicates.length, kept: trades.length }
  },

  // Search
  search: async (query: string): Promise<SearchResult[]> => {
    initFromStorage()
    const searchTerm = query.toLowerCase()
    const results: SearchResult[] = []

    trades.forEach(t => {
      if (t.token_symbol.toLowerCase().includes(searchTerm) || t.token_name?.toLowerCase().includes(searchTerm)) {
        results.push({ type: 'trade', id: t.id, title: t.token_symbol, subtitle: t.token_name })
      }
    })

    influencers.forEach(i => {
      if (i.name.toLowerCase().includes(searchTerm) || i.handle?.toLowerCase().includes(searchTerm)) {
        results.push({ type: 'influencer', id: i.id, title: i.name, subtitle: i.platform })
      }
    })

    return results.slice(0, 15)
  },

  // Hidden Tokens - tokens that should not reappear after sync
  getHiddenTokens: async (): Promise<string[]> => {
    initFromStorage()
    return [...hiddenTokens]
  },

  hideToken: async (identifier: string): Promise<{ success: boolean }> => {
    initFromStorage()
    const normalized = identifier.toLowerCase()
    if (!hiddenTokens.includes(normalized)) {
      hiddenTokens.push(normalized)
      setStorage(STORAGE_KEYS.hiddenTokens, hiddenTokens)
    }
    return { success: true }
  },

  unhideToken: async (identifier: string): Promise<{ success: boolean }> => {
    initFromStorage()
    const normalized = identifier.toLowerCase()
    hiddenTokens = hiddenTokens.filter(t => t !== normalized)
    setStorage(STORAGE_KEYS.hiddenTokens, hiddenTokens)
    return { success: true }
  },

  isTokenHidden: async (identifier: string): Promise<boolean> => {
    initFromStorage()
    return hiddenTokens.includes(identifier.toLowerCase())
  },

  // Delete token and hide it permanently
  deleteAndHideToken: async (symbol: string, contractAddress?: string | null): Promise<{ success: boolean }> => {
    initFromStorage()
    // Remove all trades for this token
    const upperSymbol = symbol.toUpperCase()
    trades = trades.filter(t => {
      const matchesSymbol = t.token_symbol.toUpperCase() === upperSymbol
      const matchesContract = contractAddress && t.token_contract_address?.toLowerCase() === contractAddress.toLowerCase()
      return !matchesSymbol && !matchesContract
    })
    setStorage(STORAGE_KEYS.trades, trades)

    // Also remove token notes and tags
    tokenNotes = tokenNotes.filter(n => n.token_symbol.toUpperCase() !== upperSymbol)
    setStorage(STORAGE_KEYS.tokenNotes, tokenNotes)
    tokenTags = tokenTags.filter(tt => tt.token_symbol.toUpperCase() !== upperSymbol)
    setStorage(STORAGE_KEYS.tokenTags, tokenTags)

    // Hide both symbol and contract address so it doesn't come back
    if (!hiddenTokens.includes(upperSymbol.toLowerCase())) {
      hiddenTokens.push(upperSymbol.toLowerCase())
    }
    if (contractAddress && !hiddenTokens.includes(contractAddress.toLowerCase())) {
      hiddenTokens.push(contractAddress.toLowerCase())
    }
    setStorage(STORAGE_KEYS.hiddenTokens, hiddenTokens)

    return { success: true }
  }
}
