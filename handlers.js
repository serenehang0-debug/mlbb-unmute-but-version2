import { EmbedBuilder } from "discord.js";
import logger from "./logger.js";
import config from "./config.js";
import cache from "./cache.js";
import cooldowns from "./cooldowns.js";

// Global state (will be imported from index.js)
let enforcementEnabled = true;
let activeMuteTimers = new Map();
let logQueue = [];
let client = null;
let isReady = false;

// Initialize function to set global state
export function initializeHandlers(state) {
  enforcementEnabled = state.enforcementEnabled;
  activeMuteTimers = state.activeMuteTimers;
  logQueue = state.logQueue;
  client = state.client;
  isReady = state.isReady;
}

export async function handleMuteKickCommand(interaction) {
  const member = interaction.member;
  const sub = interaction.options.getSubcommand();

  // Check permissions using cache
  const hasPermission = cache.hasAnyRole(member.id, config.ALLOWED_ROLES);

  // Only owner/editors can toggle, others only see status
  if (!hasPermission && sub !== "status") {
    return interaction.reply({
      content: "❌ **Only Editors and the Owner can use this command!**",
      ephemeral: true,
    });
  }

  // Update enforcement state
  if (sub === "on") {
    enforcementEnabled = true;
    logger.info("Mute kick enforcement enabled", { user: interaction.user.tag });
  } else if (sub === "off") {
    enforcementEnabled = false;
    logger.info("Mute kick enforcement disabled", { user: interaction.user.tag });
  }

  const embed = new EmbedBuilder()
    .setTitle("🎮 Mute Kick Enforcement")
    .setColor(
      sub === "on" ? 0x00ff00 : sub === "off" ? 0xff0000 : 0x0099ff
    )
    .setDescription(
      sub === "status"
        ? `🟢 Enforcement is **${enforcementEnabled ? "ENABLED" : "DISABLED"}**`
        : `${sub === "on" ? "🟢" : "🔴"} Enforcement is now **${sub.toUpperCase()}**`
    )
    .addFields(
      { name: "📊 Statistics", value: `Active timers: ${activeMuteTimers.size}`, inline: true },
      { name: "⏱️ Timeout", value: `${config.TIMEOUT / 1000}s`, inline: true },
      { name: "🔧 Cooldown", value: `${config.COOLDOWN_TIME / 1000}s`, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `Requested by ${interaction.user.tag}` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export async function handleConfigCommand(interaction) {
  const member = interaction.member;
  const sub = interaction.options.getSubcommand();

  // Only owners can use config commands
  if (!cache.hasRole(member.id, config.ROLES.OWNER)) {
    return interaction.reply({
      content: "❌ **Only the Owner can use configuration commands!**",
      ephemeral: true,
    });
  }

  if (sub === "reload") {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Reload cache
      const guild = interaction.guild;
      await cache.updateCache(guild);
      
      logger.info("Configuration reloaded", { user: interaction.user.tag });
      
      const embed = new EmbedBuilder()
        .setTitle("🔄 Configuration Reloaded")
        .setColor(0x00ff00)
        .setDescription("✅ Bot cache and configuration have been reloaded successfully.")
        .addFields(
          { name: "📊 Cache Stats", value: `Roles: ${cache.roles.size}\nChannels: ${cache.channels.size}\nMembers: ${cache.members.size}`, inline: true },
          { name: "⚡ Active Cooldowns", value: cooldowns.getActiveCooldownsCount().toString(), inline: true }
        )
        .setTimestamp();
      
      await interaction.followUp({ embeds: [embed] });
      
    } catch (error) {
      logger.error("Configuration reload failed", { error: error.message });
      await interaction.followUp({
        content: "❌ Failed to reload configuration. Check logs for details.",
        ephemeral: true
      });
    }
    
  } else if (sub === "stats") {
    const guild = interaction.guild;
    
    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Statistics")
      .setColor(0x0099ff)
      .addFields(
        { name: "🤖 Bot Info", value: `Uptime: <t:${Math.floor(Date.now() / 1000) - client.uptime / 1000}:R>\nGuild: ${guild.name}\nReady: ${isReady ? "✅" : "❌"}`, inline: true },
        { name: "🎮 Enforcement", value: `Status: ${enforcementEnabled ? "✅ ON" : "❌ OFF"}\nActive Timers: ${activeMuteTimers.size}\nTimeout: ${config.TIMEOUT / 1000}s`, inline: true },
        { name: "📈 Cache", value: `Roles: ${cache.roles.size}\nChannels: ${cache.channels.size}\nMembers: ${cache.members.size}`, inline: true },
        { name: "⚡ Performance", value: `Cooldowns: ${cooldowns.getActiveCooldownsCount()}\nLog Queue: ${logQueue.length}`, inline: true },
        { name: "🔧 Config", value: `Exempt Channels: ${config.EXEMPT_CHANNELS.length}\nLog Channel: <#${config.LOG_CHANNEL_ID}>`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

export async function batchLogMessages(logChannel) {
  if (logQueue.length === 0) return;
  
  try {
    const messages = [...logQueue];
    logQueue = [];
    
    await logChannel.send(`🎮 **Mute Alerts:**\n${messages.join("\n")}`);
    logger.debug("Batch log sent", { messageCount: messages.length });
    
  } catch (error) {
    logger.error("Failed to send batch log", { error: error.message });
  }
}
