const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Database = require('better-sqlite3')

let mainWindow
let db

const isDev = process.env.NODE_ENV !== 'production'

function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'tradejournal.db')
}

function initDatabase() {
  const dbPath = getDbPath()
  console.log('Database path:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      token_symbol TEXT NOT NULL,
      token_name TEXT,
      token_chain TEXT,
      token_contract_address TEXT,
      direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
      entry_price REAL NOT NULL,
      exit_price REAL,
      quantity REAL NOT NULL,
      total_value REAL NOT NULL,
      entry_date TEXT NOT NULL,
      exit_date TEXT,
      platform TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'partial')),
      pnl_amount REAL,
      pnl_percent REAL
    );

    CREATE TABLE IF NOT EXISTS trade_notes (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      pre_trade_thesis TEXT,
      market_narrative TEXT,
      post_trade_reflection TEXT,
      lessons_learned TEXT,
      rich_content TEXT,
      confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 10),
      emotional_state TEXT CHECK (emotional_state IN ('calm', 'fomo', 'fear', 'greed', 'disciplined', 'anxious', 'confident', 'uncertain')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS influencers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      handle TEXT,
      link TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS influencer_calls (
      id TEXT PRIMARY KEY,
      influencer_id TEXT NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
      trade_id TEXT REFERENCES trades(id) ON DELETE SET NULL,
      call_date TEXT NOT NULL,
      call_content TEXT,
      source_link TEXT,
      your_result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('narrative', 'technical', 'meta')),
      parent_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trade_tags (
      trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (trade_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly', 'custom')),
      date_range_start TEXT NOT NULL,
      date_range_end TEXT NOT NULL,
      content TEXT,
      key_learnings TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_notes (
      id TEXT PRIMARY KEY,
      token_symbol TEXT NOT NULL UNIQUE,
      thesis TEXT,
      narrative TEXT,
      reflection TEXT,
      lessons_learned TEXT,
      rich_content TEXT,
      confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 10),
      emotional_state TEXT,
      sell_reason TEXT,
      copy_trader TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS token_tags (
      token_symbol TEXT NOT NULL,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (token_symbol, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_trades_entry_date ON trades(entry_date);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trade_notes_trade_id ON trade_notes(trade_id);
    CREATE INDEX IF NOT EXISTS idx_influencer_calls_influencer_id ON influencer_calls(influencer_id);
    CREATE INDEX IF NOT EXISTS idx_trade_tags_trade_id ON trade_tags(trade_id);
    CREATE INDEX IF NOT EXISTS idx_trade_tags_tag_id ON trade_tags(tag_id);
  `)

  // Migration: Add base currency tracking columns
  const columns = db.prepare("PRAGMA table_info(trades)").all()
  const columnNames = columns.map(c => c.name)

  if (!columnNames.includes('base_currency')) {
    db.exec("ALTER TABLE trades ADD COLUMN base_currency TEXT DEFAULT 'SOL'")
  }
  if (!columnNames.includes('base_currency_usd_price')) {
    db.exec("ALTER TABLE trades ADD COLUMN base_currency_usd_price REAL")
  }
  if (!columnNames.includes('total_value_usd')) {
    db.exec("ALTER TABLE trades ADD COLUMN total_value_usd REAL")
  }

  return db
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b'
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }
}

// IPC Handlers for database operations
function setupIpcHandlers() {
  // Trades
  ipcMain.handle('db:getTrades', (_, filters) => {
    let query = 'SELECT * FROM trades WHERE 1=1'
    const params = []

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.startDate) {
      query += ' AND entry_date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += ' AND entry_date <= ?'
      params.push(filters.endDate)
    }
    if (filters?.search) {
      query += ' AND (token_symbol LIKE ? OR token_name LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY entry_date DESC'

    return db.prepare(query).all(...params)
  })

  ipcMain.handle('db:getTrade', (_, id) => {
    return db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  })

  ipcMain.handle('db:createTrade', (_, trade) => {
    const stmt = db.prepare(`
      INSERT INTO trades (id, token_symbol, token_name, token_chain, token_contract_address,
        direction, entry_price, exit_price, quantity, total_value, entry_date, exit_date,
        platform, status, pnl_amount, pnl_percent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      trade.id, trade.token_symbol, trade.token_name, trade.token_chain,
      trade.token_contract_address, trade.direction, trade.entry_price,
      trade.exit_price, trade.quantity, trade.total_value, trade.entry_date,
      trade.exit_date, trade.platform, trade.status, trade.pnl_amount, trade.pnl_percent
    )
    return trade
  })

  ipcMain.handle('db:updateTrade', (_, id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE trades SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM trades WHERE id = ?').get(id)
  })

  ipcMain.handle('db:deleteTrade', (_, id) => {
    db.prepare('DELETE FROM trades WHERE id = ?').run(id)
    return { success: true }
  })

  // Trade Notes
  ipcMain.handle('db:getTradeNote', (_, tradeId) => {
    return db.prepare('SELECT * FROM trade_notes WHERE trade_id = ?').get(tradeId)
  })

  ipcMain.handle('db:upsertTradeNote', (_, note) => {
    const existing = db.prepare('SELECT id FROM trade_notes WHERE trade_id = ?').get(note.trade_id)

    if (existing) {
      db.prepare(`
        UPDATE trade_notes SET
          pre_trade_thesis = ?, market_narrative = ?, post_trade_reflection = ?,
          lessons_learned = ?, rich_content = ?, confidence_level = ?,
          emotional_state = ?, updated_at = datetime('now')
        WHERE trade_id = ?
      `).run(
        note.pre_trade_thesis, note.market_narrative, note.post_trade_reflection,
        note.lessons_learned, note.rich_content, note.confidence_level,
        note.emotional_state, note.trade_id
      )
    } else {
      db.prepare(`
        INSERT INTO trade_notes (id, trade_id, pre_trade_thesis, market_narrative,
          post_trade_reflection, lessons_learned, rich_content, confidence_level, emotional_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        note.id, note.trade_id, note.pre_trade_thesis, note.market_narrative,
        note.post_trade_reflection, note.lessons_learned, note.rich_content,
        note.confidence_level, note.emotional_state
      )
    }
    return db.prepare('SELECT * FROM trade_notes WHERE trade_id = ?').get(note.trade_id)
  })

  // Token Notes (position-level)
  ipcMain.handle('db:getTokenNote', (_, tokenSymbol) => {
    return db.prepare('SELECT * FROM token_notes WHERE UPPER(token_symbol) = UPPER(?)').get(tokenSymbol)
  })

  ipcMain.handle('db:getAllTokenNotes', () => {
    return db.prepare('SELECT * FROM token_notes').all()
  })

  ipcMain.handle('db:upsertTokenNote', (_, note) => {
    const existing = db.prepare('SELECT id FROM token_notes WHERE UPPER(token_symbol) = UPPER(?)').get(note.token_symbol)

    if (existing) {
      db.prepare(`
        UPDATE token_notes SET
          thesis = ?, narrative = ?, reflection = ?,
          lessons_learned = ?, rich_content = ?, confidence_level = ?,
          emotional_state = ?, sell_reason = ?, copy_trader = ?, updated_at = datetime('now')
        WHERE UPPER(token_symbol) = UPPER(?)
      `).run(
        note.thesis, note.narrative, note.reflection,
        note.lessons_learned, note.rich_content, note.confidence_level,
        note.emotional_state, note.sell_reason, note.copy_trader, note.token_symbol
      )
    } else {
      db.prepare(`
        INSERT INTO token_notes (id, token_symbol, thesis, narrative,
          reflection, lessons_learned, rich_content, confidence_level, emotional_state, sell_reason, copy_trader)
        VALUES (?, UPPER(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        note.id, note.token_symbol, note.thesis, note.narrative,
        note.reflection, note.lessons_learned, note.rich_content,
        note.confidence_level, note.emotional_state, note.sell_reason, note.copy_trader
      )
    }
    return db.prepare('SELECT * FROM token_notes WHERE UPPER(token_symbol) = UPPER(?)').get(note.token_symbol)
  })

  // Tags
  ipcMain.handle('db:getTags', () => {
    return db.prepare('SELECT * FROM tags ORDER BY category, name').all()
  })

  ipcMain.handle('db:createTag', (_, tag) => {
    db.prepare('INSERT INTO tags (id, name, category, parent_tag_id, color) VALUES (?, ?, ?, ?, ?)').run(
      tag.id, tag.name, tag.category, tag.parent_tag_id, tag.color
    )
    return tag
  })

  ipcMain.handle('db:deleteTag', (_, id) => {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('db:getTradeTagIds', (_, tradeId) => {
    return db.prepare('SELECT tag_id FROM trade_tags WHERE trade_id = ?').all(tradeId).map(r => r.tag_id)
  })

  ipcMain.handle('db:setTradeTags', (_, tradeId, tagIds) => {
    db.prepare('DELETE FROM trade_tags WHERE trade_id = ?').run(tradeId)
    const insert = db.prepare('INSERT INTO trade_tags (trade_id, tag_id) VALUES (?, ?)')
    for (const tagId of tagIds) {
      insert.run(tradeId, tagId)
    }
    return { success: true }
  })

  // Token Tags (position-level)
  ipcMain.handle('db:getTokenTagIds', (_, tokenSymbol) => {
    return db.prepare('SELECT tag_id FROM token_tags WHERE UPPER(token_symbol) = UPPER(?)').all(tokenSymbol).map(r => r.tag_id)
  })

  ipcMain.handle('db:setTokenTags', (_, tokenSymbol, tagIds) => {
    db.prepare('DELETE FROM token_tags WHERE UPPER(token_symbol) = UPPER(?)').run(tokenSymbol)
    const insert = db.prepare('INSERT INTO token_tags (token_symbol, tag_id) VALUES (UPPER(?), ?)')
    for (const tagId of tagIds) {
      insert.run(tokenSymbol, tagId)
    }
    return { success: true }
  })

  // Influencers
  ipcMain.handle('db:getInfluencers', () => {
    return db.prepare('SELECT * FROM influencers ORDER BY name').all()
  })

  ipcMain.handle('db:getInfluencer', (_, id) => {
    return db.prepare('SELECT * FROM influencers WHERE id = ?').get(id)
  })

  ipcMain.handle('db:createInfluencer', (_, influencer) => {
    db.prepare('INSERT INTO influencers (id, name, platform, handle, link, notes) VALUES (?, ?, ?, ?, ?, ?)').run(
      influencer.id, influencer.name, influencer.platform, influencer.handle, influencer.link, influencer.notes
    )
    return influencer
  })

  ipcMain.handle('db:updateInfluencer', (_, id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE influencers SET ${fields} WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM influencers WHERE id = ?').get(id)
  })

  ipcMain.handle('db:deleteInfluencer', (_, id) => {
    db.prepare('DELETE FROM influencers WHERE id = ?').run(id)
    return { success: true }
  })

  // Influencer Calls
  ipcMain.handle('db:getInfluencerCalls', (_, influencerId) => {
    if (influencerId) {
      return db.prepare('SELECT * FROM influencer_calls WHERE influencer_id = ? ORDER BY call_date DESC').all(influencerId)
    }
    return db.prepare('SELECT * FROM influencer_calls ORDER BY call_date DESC').all()
  })

  ipcMain.handle('db:createInfluencerCall', (_, call) => {
    db.prepare(`
      INSERT INTO influencer_calls (id, influencer_id, trade_id, call_date, call_content, source_link, your_result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(call.id, call.influencer_id, call.trade_id, call.call_date, call.call_content, call.source_link, call.your_result)
    return call
  })

  ipcMain.handle('db:updateInfluencerCall', (_, id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE influencer_calls SET ${fields} WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM influencer_calls WHERE id = ?').get(id)
  })

  ipcMain.handle('db:deleteInfluencerCall', (_, id) => {
    db.prepare('DELETE FROM influencer_calls WHERE id = ?').run(id)
    return { success: true }
  })

  // Reviews
  ipcMain.handle('db:getReviews', () => {
    return db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all()
  })

  ipcMain.handle('db:getReview', (_, id) => {
    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id)
  })

  ipcMain.handle('db:createReview', (_, review) => {
    db.prepare(`
      INSERT INTO reviews (id, type, date_range_start, date_range_end, content, key_learnings)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(review.id, review.type, review.date_range_start, review.date_range_end, review.content, review.key_learnings)
    return review
  })

  ipcMain.handle('db:updateReview', (_, id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    db.prepare(`UPDATE reviews SET ${fields} WHERE id = ?`).run(...values, id)
    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id)
  })

  ipcMain.handle('db:deleteReview', (_, id) => {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id)
    return { success: true }
  })

  // Settings
  ipcMain.handle('db:getSetting', (_, key) => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return result?.value
  })

  ipcMain.handle('db:setSetting', (_, key, value) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    return { success: true }
  })

  // Analytics
  ipcMain.handle('db:getAnalytics', (_, dateRange) => {
    let whereClause = "WHERE status = 'closed'"
    const params = []

    if (dateRange?.start) {
      whereClause += ' AND entry_date >= ?'
      params.push(dateRange.start)
    }
    if (dateRange?.end) {
      whereClause += ' AND entry_date <= ?'
      params.push(dateRange.end)
    }

    const totalTrades = db.prepare(`SELECT COUNT(*) as count FROM trades ${whereClause}`).get(...params).count
    const winners = db.prepare(`SELECT COUNT(*) as count FROM trades ${whereClause} AND pnl_amount > 0`).get(...params).count
    const losers = db.prepare(`SELECT COUNT(*) as count FROM trades ${whereClause} AND pnl_amount < 0`).get(...params).count
    const totalPnl = db.prepare(`SELECT COALESCE(SUM(pnl_amount), 0) as total FROM trades ${whereClause}`).get(...params).total
    const avgWin = db.prepare(`SELECT COALESCE(AVG(pnl_amount), 0) as avg FROM trades ${whereClause} AND pnl_amount > 0`).get(...params).avg
    const avgLoss = db.prepare(`SELECT COALESCE(AVG(pnl_amount), 0) as avg FROM trades ${whereClause} AND pnl_amount < 0`).get(...params).avg
    const biggestWin = db.prepare(`SELECT COALESCE(MAX(pnl_amount), 0) as max FROM trades ${whereClause}`).get(...params).max
    const biggestLoss = db.prepare(`SELECT COALESCE(MIN(pnl_amount), 0) as min FROM trades ${whereClause}`).get(...params).min

    // Performance by tag
    const byTag = db.prepare(`
      SELECT t.name, t.category, t.color,
        COUNT(tr.id) as trade_count,
        SUM(CASE WHEN tr.pnl_amount > 0 THEN 1 ELSE 0 END) as wins,
        COALESCE(SUM(tr.pnl_amount), 0) as total_pnl
      FROM tags t
      JOIN trade_tags tt ON t.id = tt.tag_id
      JOIN trades tr ON tt.trade_id = tr.id
      ${whereClause.replace('WHERE', 'WHERE tr.')}
      GROUP BY t.id
      ORDER BY total_pnl DESC
    `).all(...params)

    // Performance by emotional state
    const byEmotion = db.prepare(`
      SELECT tn.emotional_state,
        COUNT(tr.id) as trade_count,
        SUM(CASE WHEN tr.pnl_amount > 0 THEN 1 ELSE 0 END) as wins,
        COALESCE(SUM(tr.pnl_amount), 0) as total_pnl
      FROM trades tr
      JOIN trade_notes tn ON tr.id = tn.trade_id
      ${whereClause.replace('WHERE', 'WHERE tr.')}
      AND tn.emotional_state IS NOT NULL
      GROUP BY tn.emotional_state
    `).all(...params)

    // Monthly PnL
    const monthlyPnl = db.prepare(`
      SELECT strftime('%Y-%m', entry_date) as month,
        COALESCE(SUM(pnl_amount), 0) as total_pnl,
        COUNT(*) as trade_count
      FROM trades
      ${whereClause}
      GROUP BY strftime('%Y-%m', entry_date)
      ORDER BY month DESC
      LIMIT 12
    `).all(...params)

    return {
      totalTrades,
      winners,
      losers,
      winRate: totalTrades > 0 ? (winners / totalTrades) * 100 : 0,
      totalPnl,
      avgWin,
      avgLoss,
      biggestWin,
      biggestLoss,
      profitFactor: avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0,
      byTag,
      byEmotion,
      monthlyPnl
    }
  })

  // Bulk import
  ipcMain.handle('db:bulkImportTrades', (_, trades) => {
    const insert = db.prepare(`
      INSERT INTO trades (id, token_symbol, token_name, token_chain, token_contract_address,
        direction, entry_price, exit_price, quantity, total_value, entry_date, exit_date,
        platform, status, pnl_amount, pnl_percent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const importMany = db.transaction((trades) => {
      for (const trade of trades) {
        insert.run(
          trade.id, trade.token_symbol, trade.token_name, trade.token_chain,
          trade.token_contract_address, trade.direction, trade.entry_price,
          trade.exit_price, trade.quantity, trade.total_value, trade.entry_date,
          trade.exit_date, trade.platform, trade.status, trade.pnl_amount, trade.pnl_percent
        )
      }
    })

    importMany(trades)
    return { success: true, count: trades.length }
  })

  // Remove duplicate trades
  ipcMain.handle('db:removeDuplicateTrades', () => {
    // Get all trades with their signatures
    const allTrades = db.prepare('SELECT * FROM trades ORDER BY created_at ASC').all()

    const seen = new Map()
    const duplicateIds = []

    for (const trade of allTrades) {
      // First try to dedupe by tx_signature (most reliable)
      if (trade.tx_signature) {
        if (seen.has(`sig:${trade.tx_signature}`)) {
          duplicateIds.push(trade.id)
          continue
        }
        seen.set(`sig:${trade.tx_signature}`, trade)
      }

      // Also create a backup key based on symbol, direction, quantity, date
      const dateOnly = trade.entry_date.split('T')[0]
      const qtyRounded = parseFloat(trade.quantity).toFixed(2)
      const key = `${trade.token_symbol.toUpperCase()}-${trade.direction}-${qtyRounded}-${dateOnly}`

      if (seen.has(key)) {
        // This is a duplicate - mark for removal
        duplicateIds.push(trade.id)
      } else {
        seen.set(key, trade)
      }
    }

    // Delete duplicates
    if (duplicateIds.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM trades WHERE id = ?')
      duplicateIds.forEach(id => deleteStmt.run(id))
    }

    console.log(`Removed ${duplicateIds.length} duplicate trades, kept ${allTrades.length - duplicateIds.length}`)
    return { removed: duplicateIds.length, kept: allTrades.length - duplicateIds.length }
  })

  // Search
  ipcMain.handle('db:search', (_, query) => {
    const searchTerm = `%${query}%`

    const trades = db.prepare(`
      SELECT 'trade' as type, id, token_symbol as title, token_name as subtitle
      FROM trades
      WHERE token_symbol LIKE ? OR token_name LIKE ? OR platform LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm)

    const notes = db.prepare(`
      SELECT 'note' as type, tn.trade_id as id, t.token_symbol as title,
        SUBSTR(COALESCE(tn.pre_trade_thesis, tn.market_narrative, ''), 1, 50) as subtitle
      FROM trade_notes tn
      JOIN trades t ON tn.trade_id = t.id
      WHERE tn.pre_trade_thesis LIKE ? OR tn.market_narrative LIKE ?
        OR tn.post_trade_reflection LIKE ? OR tn.lessons_learned LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm)

    const influencers = db.prepare(`
      SELECT 'influencer' as type, id, name as title, platform as subtitle
      FROM influencers
      WHERE name LIKE ? OR handle LIKE ?
      LIMIT 5
    `).all(searchTerm, searchTerm)

    return [...trades, ...notes, ...influencers]
  })
}

app.whenReady().then(() => {
  initDatabase()
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (db) {
    db.close()
  }
})
