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
  await interaction.deferReply({ ephemeral: true });
  
  const member = interaction.member;
  const sub = interaction.options.getSubcommand();

  // Debug: Log user roles
  console.log("User roles:", member.roles.cache.map(r => r.id));
  
  // Exact role check
  const allowedRoles = [
    "1437118510877900810", // Owner/Creator
    "1437222279745372252"  // Admin
  ];
  
  const hasPermission = member.roles.cache.some(role =>
    allowedRoles.includes(role.id)
  );

  // Only owner/admin can toggle, others only see status
  if (!hasPermission && sub !== "status") {
    return interaction.editReply({
      content: "❌ Only Admin and Owner can use this command!"
    });
  }

  // Update enforcement state and return it
  let newState = enforcementEnabled;
  if (sub === "on") {
    newState = true;
    enforcementEnabled = true;
    logger.info("Mute kick enforcement enabled", { user: interaction.user.tag });
  } else if (sub === "off") {
    newState = false;
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

  await interaction.editReply({ embeds: [embed] });
  
  // Return the updated state
  return newState;
}

export async function handleConfigCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const member = interaction.member;
  const sub = interaction.options.getSubcommand();

  // Debug: Log user roles
  console.log("User roles:", member.roles.cache.map(r => r.id));
  
  // Exact role check - only Owner can use config commands
  const allowedRoles = [
    "1437118510877900810" // Owner/Creator only
  ];
  
  const hasPermission = member.roles.cache.some(role =>
    allowedRoles.includes(role.id)
  );

  if (!hasPermission) {
    return interaction.editReply({
      content: "❌ Only Owner can use configuration commands!"
    });
  }

  if (sub === "reload") {
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
    
    await interaction.editReply({ embeds: [embed] });
  } else if (sub === "exempt") {
    const guild = interaction.guild;
    
    let exemptList = "";
    for (const channelId of config.EXEMPT_CHANNELS) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        exemptList += `• <#${channelId}> - **${channel.name}**\n`;
      } else {
        exemptList += `• \`${channelId}\` - *Channel not found*\n`;
      }
    }
    
    const embed = new EmbedBuilder()
      .setTitle("🔇 Exempt Voice Channels")
      .setColor(0xffaa00)
      .setDescription(`These channels are **exempt** from mute kick enforcement:\n\n${exemptList}`)
      .addFields(
        { name: "📊 Total", value: `${config.EXEMPT_CHANNELS.length} channels`, inline: true },
        { name: "🎯 Enforcement", value: enforcementEnabled ? "✅ Active" : "❌ Disabled", inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });
    
    await interaction.editReply({ embeds: [embed] });
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
