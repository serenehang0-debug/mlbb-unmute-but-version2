import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import logger from "./logger.js";
import config from "./config.js";
import cache from "./cache.js";
import cooldowns from "./cooldowns.js";
import { handleMuteKickCommand, handleConfigCommand, batchLogMessages, initializeHandlers } from "./handlers.js";

// --------------------- CONFIG ---------------------
// Configuration is now handled by config.js
// All constants are available through the config object

// Track ongoing mute checks (avoid duplicate timers)
const activeMuteTimers = new Map();

// Log batching
let logQueue = [];
let logCooldownActive = false;

// Bot state
let enforcementEnabled = true;
let isReady = false;
// ---------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// ---------------- REGISTER SLASH COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("mutekick")
    .setDescription("Toggle or check mute kick enforcement")
    .addSubcommand((sub) =>
      sub.setName("on").setDescription("Turn ON mute kick enforcement")
    )
    .addSubcommand((sub) =>
      sub.setName("off").setDescription("Turn OFF mute kick enforcement")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check the current mute kick status")
    ),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("Bot configuration commands (Admin only)")
    .addSubcommand((sub) =>
      sub.setName("reload").setDescription("Reload bot cache and configuration")
    )
    .addSubcommand((sub) =>
      sub.setName("stats").setDescription("Show bot statistics")
    )
    .addSubcommand((sub) =>
      sub.setName("exempt").setDescription("List exempt voice channels")
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(config.TOKEN);

// ---------------- READY ----------------
client.once("ready", async () => {
  try {
    logger.info(`Bot logged in as ${client.user.tag}`);
    
    // Validate configuration
    const guild = config.validateGuild(client);
    config.validateChannels(guild);
    config.validateRoles(guild);
    
    // Initialize cache
    await cache.updateCache(guild);
    
    // Initialize handlers with global state
    initializeHandlers({
      enforcementEnabled,
      activeMuteTimers,
      logQueue,
      client,
      isReady
    });
    
    // Register commands
    await rest.put(Routes.applicationGuildCommands(config.APP_ID, config.GUILD_ID), {
      body: commands,
    });
    
    logger.info("Bot initialization completed successfully");
    isReady = true;
    
    // Update handlers state after ready
    initializeHandlers({
      enforcementEnabled,
      activeMuteTimers,
      logQueue,
      client,
      isReady
    });
    
  } catch (error) {
    logger.error("Bot initialization failed", { error: error.message });
    process.exit(1);
  }
});

// ---------------- SLASH COMMAND HANDLER ----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Check cooldown
  if (cooldowns.isOnCooldown(interaction.user.id, interaction.commandName)) {
    const remaining = Math.ceil(cooldowns.getRemainingTime(interaction.user.id, interaction.commandName) / 1000);
    return interaction.reply({
      content: `⏱️ Please wait ${remaining}s before using this command again.`,
      ephemeral: true
    });
  }
  
  try {
    if (interaction.commandName === "mutekick") {
      const newState = await handleMuteKickCommand(interaction);
      // Update local state with returned value
      if (newState !== undefined) {
        enforcementEnabled = newState;
      }
      // Update handlers state after command
      initializeHandlers({
        enforcementEnabled,
        activeMuteTimers,
        logQueue,
        client,
        isReady
      });
    } else if (interaction.commandName === "config") {
      await handleConfigCommand(interaction);
    }
    
    // Set cooldown after successful command
    cooldowns.setCooldown(interaction.user.id, interaction.commandName, config.COOLDOWN_TIME);
    
  } catch (error) {
    logger.error("Command execution failed", {
      command: interaction.commandName,
      user: interaction.user.tag,
      error: error.message
    });
    
    const errorMessage = interaction.replied || interaction.deferred
      ? "❌ An error occurred while processing your command."
      : "❌ An error occurred while processing your command.";
      
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// ---------------- VOICE STATE UPDATE ----------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!enforcementEnabled || !isReady) return;
  
  try {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const newChannel = newState.channel;
    const oldChannel = oldState.channel;

    // Update cache if needed (force update for new channels)
    if (cache.needsUpdate() || !cache.getChannel(newChannel.id)) {
      await cache.updateCache(newState.guild);
      logger.debug("Cache updated for new channel", { 
        channelId: newChannel.id, 
        channelName: newChannel.name 
      });
    }

    // If user left VC — clear timer
    if (!newChannel) {
      if (activeMuteTimers.has(member.id)) {
        clearTimeout(activeMuteTimers.get(member.id));
        activeMuteTimers.delete(member.id);
        logger.debug("Cleared timer for user who left VC", { user: member.user.tag });
      }
      return;
    }

    // Ignore exempt channels
    if (config.EXEMPT_CHANNELS.includes(newChannel.id)) {
      logger.debug("Channel is exempt from enforcement", { 
        channelId: newChannel.id, 
        channelName: newChannel.name,
        user: member.user.tag 
      });
      if (activeMuteTimers.has(member.id)) {
        clearTimeout(activeMuteTimers.get(member.id));
        activeMuteTimers.delete(member.id);
      }
      return;
    }

    logger.debug("Enforcing mute rules on channel", { 
      channelId: newChannel.id, 
      channelName: newChannel.name,
      user: member.user.tag 
    });

    // 🚫 Skip Owner/Admin BEFORE anything else
    const allowedRoles = [
      "1437118510877900810", // Owner/Creator
      "1437222279745372252"  // Admin
    ];
    
    if (member.roles.cache.some(role =>
      allowedRoles.includes(role.id)
    )) return;

    // Handle muted join
    if (member.voice.selfMute || member.voice.selfDeaf) {
      if (activeMuteTimers.has(member.id)) return;

      const logChannel = cache.getChannel(config.LOG_CHANNEL_ID);
      if (!logChannel?.isTextBased()) {
        logger.error("Log channel missing or not text-based", { channelId: config.LOG_CHANNEL_ID });
        return;
      }

      // Batch logs
      logQueue.push(
        `⚠️ **${member.user.tag}** joined **${newChannel.name}** muted/deafened.`
      );
      
      if (!logCooldownActive) {
        logCooldownActive = true;
        setTimeout(() => {
          batchLogMessages(logChannel);
          logCooldownActive = false;
        }, config.LOG_BATCH_DELAY);
      }

      // DM user with error handling
      try {
        await member.send(
          `🏆 **Hey ${member.displayName}!** You're muted/deafened in **${newChannel.name}**.\n⏱️ You have **${config.TIMEOUT / 1000}s** to unmute or you'll be disconnected. ⚔️`
        );
        logger.debug("Sent warning DM to user", { user: member.user.tag, channel: newChannel.name });
      } catch (err) {
        logger.warn("Failed to send DM to user", { 
          user: member.user.tag, 
          error: err.message 
        });
      }

      // Start timer
      const timer = setTimeout(async () => {
        try {
          const updatedMember = await newState.guild.members.fetch(member.id).catch(() => null);
          
          if (!updatedMember) {
            logger.debug("Member left guild during timer", { userId: member.id });
            activeMuteTimers.delete(member.id);
            return;
          }

          if (
            updatedMember.voice.channelId === newChannel.id &&
            (updatedMember.voice.selfMute || updatedMember.voice.selfDeaf)
          ) {
            try {
              await updatedMember.voice.disconnect("Muted for too long");
              
              await logChannel.send(
                `❌ **${updatedMember.user.tag}** was disconnected from **${newChannel.name}** for staying muted too long ⏱️💀`
              );
              
              logger.info("User disconnected for staying muted", {
                user: updatedMember.user.tag,
                channel: newChannel.name
              });
              
              try {
                await updatedMember.send("❌ You were disconnected for staying muted too long ⏱️💀");
              } catch (dmErr) {
                logger.debug("Failed to send disconnect DM", { 
                  user: updatedMember.user.tag, 
                  error: dmErr.message 
                });
              }
            } catch (disconnectErr) {
              logger.error("Error disconnecting user", {
                user: updatedMember.user.tag,
                error: disconnectErr.message
              });
            }
          }
        } catch (err) {
          logger.error("Error in mute timer callback", {
            user: member.user.tag,
            error: err.message
          });
        } finally {
          activeMuteTimers.delete(member.id);
        }
      }, config.TIMEOUT);

      activeMuteTimers.set(member.id, timer);
      logger.debug("Started mute timer", { 
        user: member.user.tag, 
        channel: newChannel.name,
        timeout: config.TIMEOUT 
      });
    }
  } catch (error) {
    logger.error("Error in voice state update", {
      error: error.message,
      userId: newState.member?.user?.id
    });
  }
});

// ---------------- LOGIN ----------------
// Graceful shutdown handling
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  // Clear all active timers
  activeMuteTimers.forEach(timer => clearTimeout(timer));
  activeMuteTimers.clear();
  
  // Destroy client
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', { error: error.message, stack: error.stack });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start the bot
client.login(config.TOKEN);
