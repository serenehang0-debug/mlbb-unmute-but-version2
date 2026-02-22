import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from "discord.js";

// --------------------- CONFIG ---------------------
const TOKEN = const TOKEN = process.env.TOKEN;
const GUILD_ID = "1437111707997831220"; // Your server ID
const APP_ID = "1437828014917419120"; // Your Application ID
const LOG_CHANNEL_ID = "1437859790213742752"; // Channel for warnings/logs

// Role IDs to ignore for kicking
const ignoredRoles = [
  "1437118510877900810", // Owner
  "1437117538336112831", // Leaders
  "1437222279745372252"  // Editors
];

// Role IDs allowed to toggle /mutekick
const allowedRoles = [
  "1437117538336112831", // Leaders
  "1437222279745372252"  // Editors
];

const TIMEOUT = 10000; // 10 seconds to unmute
let enforcementEnabled = true;
// ---------------------------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// ---------------- REGISTER SLASH COMMAND ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("mutekick")
    .setDescription("Toggle mute kick enforcement")
    .addStringOption(option =>
      option.setName("option")
        .setDescription("on or off")
        .setRequired(true)
        .addChoices(
          { name: "on", value: "on" },
          { name: "off", value: "off" }
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ---------------- BOT READY ----------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationGuildCommands(APP_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash command /mutekick registered successfully!");
  } catch (err) {
    console.error("Error registering slash commands:", err);
  }
});

// ---------------- SLASH COMMAND HANDLER ----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "mutekick") {
    // Only Leaders or Editors can toggle
    if (!interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))) {
      return interaction.reply({ content: "❌ **You don’t have permission to use this command!**", ephemeral: true });
    }

    const option = interaction.options.getString("option");
    enforcementEnabled = option === "on";

    const statusEmoji = enforcementEnabled ? "🟢" : "🔴";
    await interaction.reply(`${statusEmoji} **Mute kick enforcement is now ${option.toUpperCase()}!** 🛡️⚔️`);
  }
});

// ---------------- VOICE STATE UPDATE ----------------
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!enforcementEnabled) return; // enforcement paused
  if (!oldState.channel && newState.channel) { // member joined VC
    const member = newState.member;

    // Ignore members with ignored roles
    if (member.roles.cache.some(role => ignoredRoles.includes(role.id))) return;

    if (member.voice.selfMute || member.voice.selfDeaf) {
      const logChannel = newState.guild.channels.cache.get(LOG_CHANNEL_ID);

      // Public warning in text channel with emojis and style
      logChannel.send(`🎮 **Tournament Alert!** 🎮\n⚠️ **${member}**, you are currently **muted/deafened** in the voice channel!\n⏳ You have **${TIMEOUT / 1000} seconds** to unmute or face **disconnection!** 🔇🚫`);

      // DM warning with fun style
      try {
        await member.send(`🏆 **Hello ${member.displayName}!** 🏆\nYou are **muted/deafened** in the tournament voice channel.\n⏱️ You have **${TIMEOUT / 1000} seconds** to unmute or you will be **kicked** from the game! ⚔️`);
      } catch (err) {
        console.log("DM failed:", err);
      }

      // Kick after timeout with log
      setTimeout(() => {
        if (member.voice.selfMute || member.voice.selfDeaf) {
          member.voice.disconnect();
          logChannel.send(`❌ **${member.user.tag} was disconnected** for staying muted too long ⏱️💀`);
          try { member.send("❌ You were disconnected for staying muted too long ⏱️💀"); } catch {}
        }
      }, TIMEOUT);
    }
  }
});

// ---------------- LOGIN ----------------
client.login(TOKEN);
