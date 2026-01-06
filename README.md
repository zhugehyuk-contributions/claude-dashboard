# claude-dashboard

Comprehensive status line plugin for Claude Code with context usage, API rate limits, and cost tracking.

## Features

- 🤖 **Model Display**: Shows current model (Opus, Sonnet, Haiku)
- 📊 **Progress Bar**: Color-coded context usage (green → yellow → red)
- 📈 **Token Count**: Current/total tokens in K/M format
- 💰 **Cost Tracking**: Cumulative session cost in USD
- ⏱️ **Rate Limits**: 5h session limit with reset countdown, 7d usage (all models & Sonnet)
- 🌐 **i18n**: English and Korean support (auto-detect)

## Output Examples

**Max Plan:**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5h: 42% (2h30m) │ 7d: 69% │ 7d-S: 2%
```

**Pro Plan:**
```
🤖 Sonnet │ ██████░░░░ 60% │ 120K/200K │ $0.45 │ 5h: 42% (2h30m)
```

**Korean:**
```
🤖 Opus │ ████████░░ 80% │ 160K/200K │ $1.25 │ 5시간: 42% (2시간30분) │ 7일: 69% │ 7일-S: 2%
```

## Installation

### From Plugin Marketplace

```
/plugin marketplace add uppinote20/claude-dashboard
/plugin install claude-dashboard
/claude-dashboard:setup
```

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/uppinote20/claude-dashboard.git ~/.claude/plugins/claude-dashboard
```

2. Run setup:
```
/claude-dashboard:setup
```

## Configuration

Run `/claude-dashboard:setup` with optional arguments:

```
# Default: auto language detection, max plan
/claude-dashboard:setup

# English, pro plan
/claude-dashboard:setup en pro

# Korean, max plan
/claude-dashboard:setup ko max
```

### Configuration File

Settings are stored in `~/.claude/claude-dashboard.local.json`:

```json
{
  "language": "auto",
  "plan": "max",
  "cache": {
    "ttlSeconds": 60
  }
}
```

## Requirements

- **Claude Code** v1.0.80+
- **Node.js** 18+

## Color Legend

| Color | Usage % | Meaning |
|-------|---------|---------|
| 🟢 Green | 0-50% | Safe |
| 🟡 Yellow | 51-80% | Warning |
| 🔴 Red | 81-100% | Critical |

## Plan Differences

| Feature | Max | Pro |
|---------|-----|-----|
| 5h rate limit | ✅ | ✅ |
| Reset countdown | ✅ | ✅ |
| 7d all models | ✅ | ❌ |
| 7d Sonnet only | ✅ | ❌ |

## Troubleshooting

### Status line not showing

1. Check if plugin is installed: `/plugin list`
2. Verify settings.json has statusLine config
3. Restart Claude Code

### Rate limits showing ⚠️

- API token may be expired - re-login to Claude Code
- Network issue - check internet connection
- API rate limited - wait 60 seconds for cache refresh

### Wrong language

Run setup with explicit language:
```
/claude-dashboard:setup ko  # Korean
/claude-dashboard:setup en  # English
```

### Cache Issues

API response cache is stored in `~/.cache/claude-dashboard/`. To clear:

```bash
rm -rf ~/.cache/claude-dashboard/
```

Cache files are automatically cleaned up after 1 hour.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test locally
echo '{"model":{"display_name":"Opus"},"context_window":{"context_window_size":200000,"current_usage":{"input_tokens":50000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"cost":{"total_cost_usd":0.5}}' | node dist/index.js
```

## License

MIT
