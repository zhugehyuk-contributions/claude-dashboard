# Claude Code Configuration

## Project Overview

**claude-dashboard** is a Claude Code plugin that provides a comprehensive status line showing context usage, API rate limits, and cost tracking.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0+
- **Build**: esbuild
- **Target**: Claude Code Plugin

## Project Structure

```
claude-dashboard/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # Marketplace metadata
├── commands/
│   └── setup.md             # /claude-dashboard:setup command
├── scripts/
│   ├── statusline.ts        # Main entry point
│   ├── types.ts             # TypeScript interfaces
│   └── utils/
│       ├── api-client.ts    # OAuth API client with caching
│       ├── colors.ts        # ANSI color codes
│       ├── credentials.ts   # Keychain/credentials extraction
│       ├── formatters.ts    # Token/cost/time formatting
│       ├── i18n.ts          # Internationalization
│       └── progress-bar.ts  # Progress bar rendering
├── locales/
│   ├── en.json              # English translations
│   └── ko.json              # Korean translations
├── dist/
│   └── index.js             # Built output (committed)
└── package.json
```

## Development Workflow

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
echo '{"model":{"display_name":"Opus"},...}' | node dist/index.js
```

## Code Style

- Use TypeScript strict mode
- ESM modules (import/export)
- Functional style preferred
- No external runtime dependencies (Node.js built-ins only)

## Key Conventions

1. **dist/index.js is committed** - Plugin users don't need to build
2. **60-second API cache** - Avoid rate limiting
3. **Graceful degradation** - Show ⚠️ on API errors, not crash
4. **i18n** - All user-facing strings in locales/*.json

## Testing Checklist

Before committing:
- [ ] `npm run build` succeeds
- [ ] Max plan output format correct
- [ ] Pro plan output format correct
- [ ] Korean/English switching works
- [ ] API error shows ⚠️ instead of crash

## Common Tasks

### Adding a new locale

1. Create `locales/{lang}.json` copying from `en.json`
2. Update `scripts/utils/i18n.ts` to import new locale
3. Test with `/claude-dashboard:setup {lang}`

### Modifying status line format

1. Edit `scripts/statusline.ts` `formatOutput()` function
2. Update `README.md` examples
3. Update `commands/setup.md` examples
4. Rebuild and test

### Updating API client

1. Edit `scripts/utils/api-client.ts`
2. Check cache invalidation logic
3. Test with expired cache (`rm -rf ~/.cache/claude-dashboard/`)

## Cache Architecture

### Multi-Account Support

- Each OAuth token is hashed (SHA-256, 16 chars) for cache key separation
- Cache files: `~/.cache/claude-dashboard/cache-{hash}.json`
- Supports concurrent account switching without cache conflicts

### Three-Tier Caching

1. **Memory cache** - In-process Map, fastest
2. **File cache** - Persists across process restarts
3. **API fetch** - Falls back when cache misses

### Cleanup Behavior

- **Trigger**: Time-based (once per hour maximum)
- **Target**: Files older than `CACHE_MAX_AGE_SECONDS` (1 hour)
- **Pattern**: Only `cache-*.json` files in cache directory

### Request Deduplication

- `pendingRequests` Map prevents concurrent duplicate API calls
- Same token hash → shares single in-flight request
