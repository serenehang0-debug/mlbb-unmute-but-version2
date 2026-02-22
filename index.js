import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
} from "discord.js";

// --------------------- CONFIG ---------------------
const TOKEN = process.env.TOKEN;
const GUILD_ID = "1437111707997831220";
const APP_ID = "1437828014917419120";
const LOG_CHANNEL_ID = "1437859790213742752"; // tournament-muted-logs

// Role IDs
const ownerRole = "1437118510877900810";  // Owner
const editorRole = "1437222279745372252"; // Editors
const leaderRole = "1437117538336112831"; // Leaders

// Only Owner + Editors can control commands
const allowedRoles = [ownerRole, editorRole];

// Ignored roles for mute enforcement
const ignoredRoles = [ownerRole, leaderRole, editorRole];

// Exempt Voice Channels
const exemptChannels = [
  "1437116705447874650",
  "1437224251550732399",
  "1437224547211411528",
];

const TIMEOUT = 10000; // 10s to unmute
let enforcementEnabled = true;

// Track ongoing mute checks (avoid duplicate timers)
const activeMuteTimers = new Map();

// Log batching
let logQueue = [];
let logCooldownActive = false;
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
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ---------------- READY ----------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered successfully!");
  } catch (err) {
    console.error("❌ Error registering slash commands:", err);
  }
});

// ---------------- SLASH COMMAND HANDLER ----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "mutekick") return;

  const member = interaction.member;
  const sub = interaction.options.getSubcommand();

  const hasPermission = member.roles.cache.some((r) =>
    allowedRoles.includes(r.id)
  );

  // Only owner/editors can toggle, others only see status
  if (!hasPermission && sub !== "status") {
    return interaction.reply({
      content: "❌ **Only Editors and the Owner can use this command!**",
      ephemeral: true,
    });
  }

  if (sub === "on") enforcementEnabled = true;
  else if (sub === "off") enforcementEnabled = false;

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
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
});

// ---------------- VOICE STATE UPDATE ----------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!enforcementEnabled) return;
  const member = newState.member;
  if (!member || member.user.bot) return;

  const newChannel = newState.channel;
  const oldChannel = oldState.channel;

  // If user left VC — clear timer
  if (!newChannel) {
    activeMuteTimers.delete(member.id);
    return;
  }

  // Ignore exempt channels
  if (exemptChannels.includes(newChannel.id)) {
    activeMuteTimers.delete(member.id);
    return;
  }

  // Ignore ignored roles
  if (member.roles.cache.some((r) => ignoredRoles.includes(r.id))) return;

  // Handle muted join
  if (member.voice.selfMute || member.voice.selfDeaf) {
    if (activeMuteTimers.has(member.id)) return;

    const logChannel = newChannel.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel?.isTextBased()) {
      console.error("⚠️ Log channel missing or not text-based!");
      return;
    }

    // Batch logs
    logQueue.push(
      `⚠️ **${member.user.tag}** joined **${newChannel.name}** muted/deafened.`
    );
    if (!logCooldownActive) {
      logCooldownActive = true;
      setTimeout(() => {
        if (logQueue.length > 0) {
          logChannel.send(`🎮 **Mute Alerts:**\n${logQueue.join("\n")}`);
          logQueue = [];
        }
        logCooldownActive = false;
      }, 3000);
    }

    // DM user
    try {
      await member.send(
        `🏆 **Hey ${member.displayName}!** You're muted/deafened in **${newChannel.name}**.\n⏱️ You have **${TIMEOUT / 1000}s** to unmute or you’ll be disconnected. ⚔️`
      );
    } catch (err) {
      console.log("DM failed:", err);
    }

    // Start timer
    const timer = setTimeout(async () => {
      if (
        member.voice.channelId === newChannel.id &&
        (member.voice.selfMute || member.voice.selfDeaf)
      ) {
        try {
          await member.voice.disconnect();
          logChannel.send(
            `❌ **${member.user.tag}** was disconnected from **${newChannel.name}** for staying muted too long ⏱️💀`
          );
          try {
            await member.send("❌ You were disconnected for staying muted too long ⏱️💀");
          } catch {}
        } catch (err) {
          console.log("Error disconnecting:", err);
        }
      }
      activeMuteTimers.delete(member.id);
    }, TIMEOUT);

    activeMuteTimers.set(member.id, timer);
  }
});

// ---------------- LOGIN ----------------
client.login(TOKEN);
