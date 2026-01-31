# Trade Journal - Project Specification

## Overview
A local-first, privacy-focused desktop application for tracking, analyzing, and reflecting on cryptocurrency trades. Built to develop pattern recognition, maintain trading history, and improve decision-making through structured journaling and analytics.

## User Context
- **Trading Style:** Spot trading only (no perps/futures)
- **Platforms:** Mobile app "fomo", various cross-chain wallets, DEXs
- **Frequency:** Variable depending on market conditions
- **Goal:** Pattern recognition, learning from past trades, tracking influencer performance

---

## Core Features

### 1. Trade Tracking
- Token/pair information (symbol, name, chain, contract address)
- Entry/exit prices and timestamps
- Position size and total value
- Platform used (fomo app, wallet name, DEX)
- Trade status (open, closed, partial)
- Automatic PnL calculation

### 2. Structured Journaling
Each trade includes prompted reflection:
- **Pre-trade thesis:** Why are you entering?
- **Market narrative:** What catalyst or narrative is driving this?
- **Invalidation:** What would make you exit?
- **Confidence level:** 1-10 scale
- **Emotional state:** Calm, FOMO, fear, greed, disciplined, etc.
- **Post-trade reflection:** What happened and why?
- **Lessons learned:** Key takeaways

Plus rich text area for:
- Detailed analysis
- Screenshots and images
- Links to charts, tweets, articles

### 3. Influencer Attribution (Full Tracking)
- **Influencer profiles:** Name, platform, handle, notes
- **Call tracking:** Log specific calls with date, content, source link
- **Trade linking:** Connect trades to influencer calls
- **Performance tracking:** Your win rate on each influencer's trades

### 4. Tagging System
- **Preset categories:** Narrative, Technical, Meta
- **Hierarchical tags:** E.g., Narrative > AI > Agent tokens
- **Custom tags:** Create on-the-fly as needed
- **Filter by tags:** Find all trades of a certain type

### 5. Comprehensive Analytics
- **PnL metrics:** Total, by period, running totals
- **Win rate:** Overall and by category
- **Setup performance:** Which trade types perform best
- **Time analysis:** Performance by day of week, time of day, market phase
- **Influencer performance:** ROI by who influenced the trade
- **Emotional correlation:** How emotions affect outcomes
- **Visualizations:** Charts and graphs for all metrics

### 6. Review System
- **On-demand reviews:** Create when you choose (not scheduled)
- **Date range selection:** Review any period
- **Trade summary:** Auto-populate trades from selected period
- **Reflection prompts:** Guided review questions
- **Saved reviews:** Archive of past reflections

### 7. Import Options
- **Manual entry:** Full form with all fields
- **CSV import:** Bulk import from exports
- **API integration:** Framework for future exchange connections

### 8. Search & Filter
- **Full-text search:** Across trades, notes, tags, influencers
- **Advanced filters:** By date, PnL, status, tags, influencer
- **Saved filters:** Store favorite filter combinations
- **Quick filters:** One-click for winners, losers, open positions

### 9. Dark Mode
- System preference detection
- Manual toggle
- Persistent preference

### 10. Trade Meme Generator
- Auto-generate meme based on trade PnL outcome
- **Templates by result:**
  - Big win: "Wojak in lambo", "Money printer go brrr"
  - Small win: "Modest gains chad"
  - Break even: "It ain't much but it's honest work"
  - Small loss: "Pain wojak", "This is fine"
  - Big loss: "Pink wojak", "Bogdanoff dump it"
- Custom text overlay
- Save and share memes
- Gallery of past trade memes

---

## Technical Decisions

### Platform
- [x] Desktop app with web-based UI (Electron + Next.js)
- Launches like a normal application (double-click)
- Runs locally, no server needed

### Data Storage
- [x] Local SQLite database
- Single file, stored in app data folder
- Private, portable, backup-friendly

### Tech Stack
- **Frontend:** Next.js 14 + React + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Desktop:** Electron
- **Database:** SQLite via better-sqlite3
- **Rich Text:** Tiptap editor
- **Charts:** Recharts or Tremor

---

## Data Model

### Core Entities
- **Trade:** The central entity with price, quantity, dates, platform, status
- **TradeNote:** Structured and rich-text notes linked to trades
- **Influencer:** Profiles of traders you follow
- **InfluencerCall:** Specific calls/recommendations with attribution
- **Tag:** Hierarchical tagging with categories
- **Review:** Periodic reflection entries

### Key Relationships
- Trade has many Notes, Tags, InfluencerCalls
- Influencer has many Calls
- Tag can have parent Tag (hierarchical)
- Review covers many Trades (date range)

---

## UI Structure

### Main Views
1. **Dashboard:** Quick stats, recent trades, PnL overview
2. **Trade List:** Filterable, searchable list of all trades
3. **Trade Detail:** Full trade info with notes, tags, attribution
4. **New Trade:** Entry form with structured prompts
5. **Influencers:** Manage influencer profiles and calls
6. **Analytics:** Charts, metrics, breakdowns
7. **Reviews:** Create and view past reviews

---

## Success Criteria
- App feels intuitive and "normal" to use
- All data stays local and private
- Easy to log trades quickly
- Structured prompts encourage reflection
- Can track which influencers lead to good/bad trades
- Analytics reveal patterns in trading behavior
- Can review and learn from historical trades
