export type TradeDirection = 'buy' | 'sell'
export type TradeStatus = 'open' | 'closed' | 'partial'
export type EmotionalState = 'fomo' | 'toblast' | 'calm' | 'distracted' | 'uncertain' | 'locked_in' | 'unsure'
export type TagCategory = 'narrative' | 'technical' | 'meta'
export type ReviewType = 'weekly' | 'monthly' | 'custom'

export interface Trade {
  id: string
  created_at: string
  updated_at: string
  token_symbol: string
  token_name: string | null
  token_chain: string | null
  token_contract_address: string | null
  token_image: string | null
  direction: TradeDirection
  entry_price: number
  exit_price: number | null
  quantity: number
  total_value: number
  entry_date: string
  exit_date: string | null
  platform: string | null
  status: TradeStatus
  pnl_amount: number | null
  pnl_percent: number | null
  market_cap_at_trade: number | null
  base_currency: string | null
  base_currency_usd_price: number | null
  total_value_usd: number | null
}

export interface TradeNote {
  id: string
  trade_id: string
  pre_trade_thesis: string | null
  market_narrative: string | null
  post_trade_reflection: string | null
  lessons_learned: string | null
  rich_content: string | null
  confidence_level: number | null
  emotional_state: EmotionalState | null
  created_at: string
  updated_at: string
}

// Token-level notes (for journaling at the position level)
export interface TokenNote {
  id: string
  token_symbol: string
  thesis: string | null
  narrative: string | null
  reflection: string | null
  lessons_learned: string | null
  rich_content: string | null
  confidence_level: number | null
  emotional_state: EmotionalState | null
  sell_reason: string | null
  copy_trader: string | null
  created_at: string
  updated_at: string
}

export interface Influencer {
  id: string
  name: string
  platform: string
  handle: string | null
  link: string | null
  notes: string | null
  created_at: string
}

export interface InfluencerCall {
  id: string
  influencer_id: string
  trade_id: string | null
  call_date: string
  call_content: string | null
  source_link: string | null
  your_result: string | null
  created_at: string
}

export interface Tag {
  id: string
  name: string
  category: TagCategory
  parent_tag_id: string | null
  color: string | null
  created_at: string
}

export interface Review {
  id: string
  type: ReviewType
  date_range_start: string
  date_range_end: string
  content: string | null
  key_learnings: string | null
  created_at: string
}

export interface TradeFilters {
  status?: TradeStatus
  startDate?: string
  endDate?: string
  search?: string
  tagIds?: string[]
}

export interface Analytics {
  totalTrades: number
  winners: number
  losers: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  biggestWin: number
  biggestLoss: number
  profitFactor: number
  byTag: Array<{
    name: string
    category: string
    color: string | null
    trade_count: number
    wins: number
    total_pnl: number
  }>
  byEmotion: Array<{
    emotional_state: string
    trade_count: number
    wins: number
    total_pnl: number
  }>
  monthlyPnl: Array<{
    month: string
    total_pnl: number
    trade_count: number
  }>
}

export interface SearchResult {
  type: 'trade' | 'note' | 'influencer'
  id: string
  title: string
  subtitle: string | null
}

// Form types
export interface TradeFormData {
  token_symbol: string
  token_name?: string
  token_chain?: string
  token_contract_address?: string
  direction: TradeDirection
  entry_price: number
  exit_price?: number
  quantity: number
  entry_date: string
  exit_date?: string
  platform?: string
  status: TradeStatus
}

export interface TradeNoteFormData {
  pre_trade_thesis?: string
  market_narrative?: string
  post_trade_reflection?: string
  lessons_learned?: string
  rich_content?: string
  confidence_level?: number
  emotional_state?: EmotionalState
}

export interface InfluencerFormData {
  name: string
  platform: string
  handle?: string
  link?: string
  notes?: string
}

export interface TagFormData {
  name: string
  category: TagCategory
  parent_tag_id?: string
  color?: string
}

// Electron API type
declare global {
  interface Window {
    electronAPI: {
      getTrades: (filters?: TradeFilters) => Promise<Trade[]>
      getTrade: (id: string) => Promise<Trade | undefined>
      createTrade: (trade: Trade) => Promise<Trade>
      updateTrade: (id: string, updates: Partial<Trade>) => Promise<Trade>
      deleteTrade: (id: string) => Promise<{ success: boolean }>
      getTradeNote: (tradeId: string) => Promise<TradeNote | undefined>
      upsertTradeNote: (note: Partial<TradeNote> & { trade_id: string; id: string }) => Promise<TradeNote>
      getTokenNote: (tokenSymbol: string) => Promise<TokenNote | undefined>
      getAllTokenNotes: () => Promise<TokenNote[]>
      upsertTokenNote: (note: Partial<TokenNote> & { token_symbol: string; id: string }) => Promise<TokenNote>
      getTags: () => Promise<Tag[]>
      createTag: (tag: Tag) => Promise<Tag>
      deleteTag: (id: string) => Promise<{ success: boolean }>
      getTradeTagIds: (tradeId: string) => Promise<string[]>
      setTradeTags: (tradeId: string, tagIds: string[]) => Promise<{ success: boolean }>
      getTokenTagIds: (tokenSymbol: string) => Promise<string[]>
      setTokenTags: (tokenSymbol: string, tagIds: string[]) => Promise<{ success: boolean }>
      getInfluencers: () => Promise<Influencer[]>
      getInfluencer: (id: string) => Promise<Influencer | undefined>
      createInfluencer: (influencer: Influencer) => Promise<Influencer>
      updateInfluencer: (id: string, updates: Partial<Influencer>) => Promise<Influencer>
      deleteInfluencer: (id: string) => Promise<{ success: boolean }>
      getInfluencerCalls: (influencerId?: string) => Promise<InfluencerCall[]>
      createInfluencerCall: (call: InfluencerCall) => Promise<InfluencerCall>
      updateInfluencerCall: (id: string, updates: Partial<InfluencerCall>) => Promise<InfluencerCall>
      deleteInfluencerCall: (id: string) => Promise<{ success: boolean }>
      getReviews: () => Promise<Review[]>
      getReview: (id: string) => Promise<Review | undefined>
      createReview: (review: Review) => Promise<Review>
      updateReview: (id: string, updates: Partial<Review>) => Promise<Review>
      deleteReview: (id: string) => Promise<{ success: boolean }>
      getSetting: (key: string) => Promise<string | undefined>
      setSetting: (key: string, value: string) => Promise<{ success: boolean }>
      getAnalytics: (dateRange?: { start?: string; end?: string }) => Promise<Analytics>
      bulkImportTrades: (trades: Trade[]) => Promise<{ success: boolean; count: number }>
      search: (query: string) => Promise<SearchResult[]>
    }
  }
}

export {}
