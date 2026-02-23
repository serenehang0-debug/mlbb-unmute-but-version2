import logger from './logger.js';

class Config {
  constructor() {
    this.validateEnvironment();
    this.loadConfig();
  }

  validateEnvironment() {
    const required = ['TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      logger.error('Missing required environment variables', { missing });
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
  }

  loadConfig() {
    // Discord Configuration
    this.TOKEN = process.env.TOKEN;
    this.GUILD_ID = process.env.GUILD_ID || "1437111707997831220";
    this.APP_ID = process.env.APP_ID || "1437828014917419120";
    this.LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "1437859790213742752";

    // Role IDs
    this.ROLES = {
      OWNER: process.env.OWNER_ROLE || "1437118510877900810",
      EDITOR: process.env.EDITOR_ROLE || "1437222279745372252",
      LEADER: process.env.LEADER_ROLE || "1437117538336112831"
    };

    // Permission arrays
    this.ALLOWED_ROLES = [this.ROLES.OWNER, this.ROLES.EDITOR];
    this.IGNORED_ROLES = [this.ROLES.OWNER, this.ROLES.LEADER, this.ROLES.EDITOR];

    // Voice channels exempt from mute enforcement
    this.EXEMPT_CHANNELS = process.env.EXEMPT_CHANNELS 
      ? process.env.EXEMPT_CHANNELS.split(',')
      : [
          "1437116705447874650",
          "1437224251550732399", 
          "1437224547211411528"
        ];

    // Bot settings
    this.TIMEOUT = parseInt(process.env.TIMEOUT) || 10000; // 10 seconds
    this.COOLDOWN_TIME = parseInt(process.env.COOLDOWN_TIME) || 5000; // 5 seconds
    this.LOG_BATCH_SIZE = parseInt(process.env.LOG_BATCH_SIZE) || 10;
    this.LOG_BATCH_DELAY = parseInt(process.env.LOG_BATCH_DELAY) || 3000;

    logger.info('Configuration loaded successfully', {
      guildId: this.GUILD_ID,
      appId: this.APP_ID,
      timeout: this.TIMEOUT,
      exemptChannels: this.EXEMPT_CHANNELS.length
    });
  }

  validateGuild(client) {
    const guild = client.guilds.cache.get(this.GUILD_ID);
    if (!guild) {
      logger.error('Bot is not in the configured guild', { guildId: this.GUILD_ID });
      throw new Error(`Bot is not in guild ${this.GUILD_ID}`);
    }
    return guild;
  }

  validateChannels(guild) {
    const logChannel = guild.channels.cache.get(this.LOG_CHANNEL_ID);
    if (!logChannel) {
      logger.error('Log channel not found', { channelId: this.LOG_CHANNEL_ID });
      throw new Error(`Log channel ${this.LOG_CHANNEL_ID} not found`);
    }
    if (!logChannel.isTextBased()) {
      logger.error('Log channel is not text-based', { channelId: this.LOG_CHANNEL_ID });
      throw new Error(`Log channel ${this.LOG_CHANNEL_ID} is not text-based`);
    }
    return logChannel;
  }

  validateRoles(guild) {
    const missingRoles = [];
    
    for (const [name, roleId] of Object.entries(this.ROLES)) {
      if (!guild.roles.cache.has(roleId)) {
        missingRoles.push({ name, roleId });
      }
    }
    
    if (missingRoles.length > 0) {
      logger.warn('Some roles not found in guild', { missingRoles });
    }
    
    return missingRoles.length === 0;
  }
}

export default new Config();
