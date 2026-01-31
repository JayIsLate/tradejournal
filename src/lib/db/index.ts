import { mockApi } from './mock'
import type { Trade, TradeNote, TokenNote, Tag, Influencer, InfluencerCall, Review, TradeFilters, Analytics, SearchResult } from '@/lib/types'

function getApi() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI
  }
  return mockApi
}

export const db = {
  // Trades
  getTrades: (filters?: TradeFilters): Promise<Trade[]> => getApi().getTrades(filters),
  getTrade: (id: string): Promise<Trade | undefined> => getApi().getTrade(id),
  createTrade: (trade: Trade): Promise<Trade> => getApi().createTrade(trade),
  updateTrade: (id: string, updates: Partial<Trade>): Promise<Trade> => getApi().updateTrade(id, updates),
  deleteTrade: (id: string): Promise<{ success: boolean }> => getApi().deleteTrade(id),

  // Trade Notes
  getTradeNote: (tradeId: string): Promise<TradeNote | undefined> => getApi().getTradeNote(tradeId),
  upsertTradeNote: (note: Partial<TradeNote> & { trade_id: string; id: string }): Promise<TradeNote> => getApi().upsertTradeNote(note),

  // Token Notes (position-level journaling)
  getTokenNote: (tokenSymbol: string): Promise<TokenNote | undefined> => getApi().getTokenNote(tokenSymbol),
  getAllTokenNotes: (): Promise<TokenNote[]> => getApi().getAllTokenNotes(),
  upsertTokenNote: (note: Partial<TokenNote> & { token_symbol: string; id: string }): Promise<TokenNote> => getApi().upsertTokenNote(note),

  // Tags
  getTags: (): Promise<Tag[]> => getApi().getTags(),
  createTag: (tag: Tag): Promise<Tag> => getApi().createTag(tag),
  deleteTag: (id: string): Promise<{ success: boolean }> => getApi().deleteTag(id),
  getTradeTagIds: (tradeId: string): Promise<string[]> => getApi().getTradeTagIds(tradeId),
  setTradeTags: (tradeId: string, tagIds: string[]): Promise<{ success: boolean }> => getApi().setTradeTags(tradeId, tagIds),

  // Token Tags (position-level tags)
  getTokenTagIds: (tokenSymbol: string): Promise<string[]> => getApi().getTokenTagIds(tokenSymbol),
  setTokenTags: (tokenSymbol: string, tagIds: string[]): Promise<{ success: boolean }> => getApi().setTokenTags(tokenSymbol, tagIds),

  // Influencers
  getInfluencers: (): Promise<Influencer[]> => getApi().getInfluencers(),
  getInfluencer: (id: string): Promise<Influencer | undefined> => getApi().getInfluencer(id),
  createInfluencer: (influencer: Influencer): Promise<Influencer> => getApi().createInfluencer(influencer),
  updateInfluencer: (id: string, updates: Partial<Influencer>): Promise<Influencer> => getApi().updateInfluencer(id, updates),
  deleteInfluencer: (id: string): Promise<{ success: boolean }> => getApi().deleteInfluencer(id),

  // Influencer Calls
  getInfluencerCalls: (influencerId?: string): Promise<InfluencerCall[]> => getApi().getInfluencerCalls(influencerId),
  createInfluencerCall: (call: InfluencerCall): Promise<InfluencerCall> => getApi().createInfluencerCall(call),
  updateInfluencerCall: (id: string, updates: Partial<InfluencerCall>): Promise<InfluencerCall> => getApi().updateInfluencerCall(id, updates),
  deleteInfluencerCall: (id: string): Promise<{ success: boolean }> => getApi().deleteInfluencerCall(id),

  // Reviews
  getReviews: (): Promise<Review[]> => getApi().getReviews(),
  getReview: (id: string): Promise<Review | undefined> => getApi().getReview(id),
  createReview: (review: Review): Promise<Review> => getApi().createReview(review),
  updateReview: (id: string, updates: Partial<Review>): Promise<Review> => getApi().updateReview(id, updates),
  deleteReview: (id: string): Promise<{ success: boolean }> => getApi().deleteReview(id),

  // Settings
  getSetting: (key: string): Promise<string | undefined> => getApi().getSetting(key),
  setSetting: (key: string, value: string): Promise<{ success: boolean }> => getApi().setSetting(key, value),

  // Analytics
  getAnalytics: (dateRange?: { start?: string; end?: string }): Promise<Analytics> => getApi().getAnalytics(dateRange),

  // Bulk import
  bulkImportTrades: (trades: Trade[]): Promise<{ success: boolean; count: number }> => getApi().bulkImportTrades(trades),

  // Search
  search: (query: string): Promise<SearchResult[]> => getApi().search(query),

  // Utilities
  removeDuplicateTrades: (): Promise<{ removed: number; kept: number }> => (getApi() as any).removeDuplicateTrades(),
}
