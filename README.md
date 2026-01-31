# Trade Journal

A local-first, privacy-focused crypto trading journal desktop app. Track your trades, document your thesis, analyze your performance, and learn from your trading history.

## Features

- **Trade Tracking**: Log buy/sell trades with entry/exit prices, quantity, and platform
- **Rich Journaling**: Document pre-trade thesis, market narrative, and post-trade reflections
- **Emotional State Tracking**: Track your emotional state and confidence level for each trade
- **Tagging System**: Organize trades with custom tags (narrative, technical, meta)
- **Influencer Attribution**: Track calls from influencers and your performance on them
- **Analytics Dashboard**: Visualize your P&L, win rate, and performance by various factors
- **Review System**: Create weekly/monthly reviews to reflect on your trading
- **CSV Import**: Bulk import trades from CSV files
- **Search**: Full-text search across all your trading data
- **Meme Generator**: Generate memes based on your trade outcomes
- **Dark Mode**: System preference detection with manual toggle
- **Local-First**: All data stored locally in SQLite, no cloud sync

## Tech Stack

- **Frontend**: Next.js 14 + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui inspired components
- **Rich Text**: Tiptap editor
- **Charts**: Recharts
- **Desktop**: Electron
- **Database**: SQLite via better-sqlite3

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm/yarn/pnpm/bun

### Installation

```bash
# Install dependencies
npm install

# Run in development mode (browser only)
npm run dev

# Run as desktop app (Electron)
npm run electron:dev
```

### Build for Production

```bash
# Build and package desktop app
npm run electron:build
```

## Project Structure

```
tradejournal/
├── electron/           # Electron main process
│   ├── main.js        # Main process entry
│   └── preload.js     # IPC bridge
├── src/
│   ├── app/           # Next.js app router pages
│   ├── components/    # React components
│   │   └── ui/       # Base UI components
│   ├── lib/
│   │   ├── db/       # Database layer
│   │   ├── types/    # TypeScript types
│   │   └── utils/    # Utility functions
│   └── hooks/        # React hooks
├── public/            # Static assets
└── package.json
```

## Usage

1. **Add Trades**: Click "New Trade" to log a trade with token details, entry/exit prices, and initial thesis
2. **Add Notes**: Click on any trade to add detailed journal notes, reflections, and lessons learned
3. **Tag Trades**: Create tags under Narrative/Technical/Meta categories and assign them to trades
4. **Track Influencers**: Add influencers and log their calls, optionally linking to trades you took
5. **View Analytics**: See your overall performance, win rate, P&L by tag, and emotional state correlations
6. **Create Reviews**: Set up weekly or monthly reviews to reflect on your trading performance
7. **Import Trades**: Use the import feature to bulk import trades from CSV files

## Data Storage

All data is stored locally in a SQLite database file located in your system's app data folder:

- **macOS**: `~/Library/Application Support/Trade Journal/tradejournal.db`
- **Windows**: `%APPDATA%/Trade Journal/tradejournal.db`
- **Linux**: `~/.config/Trade Journal/tradejournal.db`

Your data never leaves your computer.

## License

MIT
