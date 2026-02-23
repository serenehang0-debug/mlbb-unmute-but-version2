# Discord Voice Mute Enforcement Bot

A Discord bot that automatically disconnects users who stay muted/deafened in voice channels for too long.

## Features

- ⚡ **Automatic Mute Detection** - Detects when users join voice channels muted/deafened
- ⏱️ **Configurable Timeout** - Customizable time limit before disconnection
- 🎮 **Exempt Channels** - Configure specific voice channels to ignore
- 👥 **Role-Based Permissions** - Different access levels for owners, editors, leaders
- 📊 **Admin Commands** - Real-time statistics and configuration management
- 📝 **Structured Logging** - Comprehensive logging with file output
- 🔄 **Graceful Shutdown** - Proper cleanup on restart/shutdown

## Commands

### `/mutekick`
- `on` - Enable mute kick enforcement
- `off` - Disable mute kick enforcement  
- `status` - Check current enforcement status

### `/config` (Owner only)
- `reload` - Reload bot cache and configuration
- `stats` - Show detailed bot statistics

## Deployment

### Railway Deployment

1. **Fork/Clone this repository**
2. **Add to Railway**:
   - Go to Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

3. **Set Environment Variables** in Railway:
   ```env
   TOKEN=your_discord_bot_token
   GUILD_ID=1437111707997831220
   APP_ID=1437828014917419120
   LOG_CHANNEL_ID=1437859790213742752
   OWNER_ROLE=1437118510877900810
   EDITOR_ROLE=1437222279745372252
   LEADER_ROLE=1437117538336112831
   EXEMPT_CHANNELS=1437116705447874650,1437224251550732399,1437224547211411528
   TIMEOUT=10000
   COOLDOWN_TIME=5000
   LOG_BATCH_SIZE=10
   LOG_BATCH_DELAY=3000
   ```

4. **Deploy** - Railway will automatically build and deploy your bot

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TOKEN` | Discord bot token | **Required** |
| `GUILD_ID` | Discord server ID | `1437111707997831220` |
| `APP_ID` | Discord application ID | `1437828014917419120` |
| `LOG_CHANNEL_ID` | Channel for bot logs | `1437859790213742752` |
| `OWNER_ROLE` | Owner role ID | `1437118510877900810` |
| `EDITOR_ROLE` | Editor role ID | `1437222279745372252` |
| `LEADER_ROLE` | Leader role ID | `1437117538336112831` |
| `EXEMPT_CHANNELS` | Comma-separated exempt channel IDs | `1437116705447874650,1437224251550732399,1437224547211411528` |
| `TIMEOUT` | Mute timeout in milliseconds | `10000` |
| `COOLDOWN_TIME` | Command cooldown in milliseconds | `5000` |
| `LOG_BATCH_SIZE` | Max log messages per batch | `10` |
| `LOG_BATCH_DELAY` | Log batch delay in milliseconds | `3000` |

## Development

### Local Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** with your actual values

4. **Start the bot**:
   ```bash
   npm start
   ```

### Project Structure

```
├── index.js          # Main bot file
├── config.js         # Configuration management
├── logger.js         # Structured logging system
├── cache.js          # Role/channel caching
├── cooldowns.js      # Command cooldown management
├── handlers.js       # Command handlers
├── package.json      # Dependencies and scripts
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore file
└── README.md         # This file
```

## Logs

The bot creates structured logs in:
- **Console**: Color-coded output with log levels
- **File**: `./logs/bot.log` with detailed information

Log levels: `ERROR`, `WARN`, `INFO`, `DEBUG`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License
