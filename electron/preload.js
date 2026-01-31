const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Trades
  getTrades: (filters) => ipcRenderer.invoke('db:getTrades', filters),
  getTrade: (id) => ipcRenderer.invoke('db:getTrade', id),
  createTrade: (trade) => ipcRenderer.invoke('db:createTrade', trade),
  updateTrade: (id, updates) => ipcRenderer.invoke('db:updateTrade', id, updates),
  deleteTrade: (id) => ipcRenderer.invoke('db:deleteTrade', id),

  // Trade Notes
  getTradeNote: (tradeId) => ipcRenderer.invoke('db:getTradeNote', tradeId),
  upsertTradeNote: (note) => ipcRenderer.invoke('db:upsertTradeNote', note),

  // Token Notes (position-level)
  getTokenNote: (tokenSymbol) => ipcRenderer.invoke('db:getTokenNote', tokenSymbol),
  getAllTokenNotes: () => ipcRenderer.invoke('db:getAllTokenNotes'),
  upsertTokenNote: (note) => ipcRenderer.invoke('db:upsertTokenNote', note),

  // Tags
  getTags: () => ipcRenderer.invoke('db:getTags'),
  createTag: (tag) => ipcRenderer.invoke('db:createTag', tag),
  deleteTag: (id) => ipcRenderer.invoke('db:deleteTag', id),
  getTradeTagIds: (tradeId) => ipcRenderer.invoke('db:getTradeTagIds', tradeId),
  setTradeTags: (tradeId, tagIds) => ipcRenderer.invoke('db:setTradeTags', tradeId, tagIds),

  // Token Tags (position-level)
  getTokenTagIds: (tokenSymbol) => ipcRenderer.invoke('db:getTokenTagIds', tokenSymbol),
  setTokenTags: (tokenSymbol, tagIds) => ipcRenderer.invoke('db:setTokenTags', tokenSymbol, tagIds),

  // Influencers
  getInfluencers: () => ipcRenderer.invoke('db:getInfluencers'),
  getInfluencer: (id) => ipcRenderer.invoke('db:getInfluencer', id),
  createInfluencer: (influencer) => ipcRenderer.invoke('db:createInfluencer', influencer),
  updateInfluencer: (id, updates) => ipcRenderer.invoke('db:updateInfluencer', id, updates),
  deleteInfluencer: (id) => ipcRenderer.invoke('db:deleteInfluencer', id),

  // Influencer Calls
  getInfluencerCalls: (influencerId) => ipcRenderer.invoke('db:getInfluencerCalls', influencerId),
  createInfluencerCall: (call) => ipcRenderer.invoke('db:createInfluencerCall', call),
  updateInfluencerCall: (id, updates) => ipcRenderer.invoke('db:updateInfluencerCall', id, updates),
  deleteInfluencerCall: (id) => ipcRenderer.invoke('db:deleteInfluencerCall', id),

  // Reviews
  getReviews: () => ipcRenderer.invoke('db:getReviews'),
  getReview: (id) => ipcRenderer.invoke('db:getReview', id),
  createReview: (review) => ipcRenderer.invoke('db:createReview', review),
  updateReview: (id, updates) => ipcRenderer.invoke('db:updateReview', id, updates),
  deleteReview: (id) => ipcRenderer.invoke('db:deleteReview', id),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('db:getSetting', key),
  setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),

  // Analytics
  getAnalytics: (dateRange) => ipcRenderer.invoke('db:getAnalytics', dateRange),

  // Bulk import
  bulkImportTrades: (trades) => ipcRenderer.invoke('db:bulkImportTrades', trades),

  // Remove duplicates
  removeDuplicateTrades: () => ipcRenderer.invoke('db:removeDuplicateTrades'),

  // Search
  search: (query) => ipcRenderer.invoke('db:search', query),
})
