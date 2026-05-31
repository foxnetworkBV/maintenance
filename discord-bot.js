const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client, GatewayIntentBits, PermissionsBitField, Partials, REST, Routes, SlashCommandBuilder, InteractionType, ActivityType } = require('discord.js');
const fs = require('fs');

const STATUS_FILE = path.resolve(__dirname, 'status.json');
const BOT_PREFIX = '!';
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const COMMANDS = [
  new SlashCommandBuilder().setName('help').setDescription('Toon beschikbare statuscommando\'s.'),
  new SlashCommandBuilder().setName('summary').setDescription('Stel de pagina-statusregel in.')
    .addStringOption((option) => option.setName('tekst').setDescription('Nieuwe statusregel').setRequired(true)),
  new SlashCommandBuilder().setName('show').setDescription('Toon de huidige status.')
];

const DEFAULT_STATUS = {
  statusLabel: 'Ontwikkelingsstatus',
  progress: 75,
  message: 'Onderhoud bezig — we zijn bijna terug met nieuwe updates.',
  steps: [
    { label: 'Planning & voorbereiding', state: 'complete', detail: 'Voltooid' },
    { label: 'Codeontwikkeling & updates', state: 'current', detail: 'Bezig' },
    { label: 'Testen & kwaliteitscontrole', state: 'pending', detail: 'Komt eraan' },
    { label: 'Live zetten', state: 'pending', detail: 'Bijna klaar' }
  ]
};

function loadStatus() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      saveStatus(DEFAULT_STATUS);
      return DEFAULT_STATUS;
    }

    const raw = fs.readFileSync(STATUS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to load status.json:', error);
    return DEFAULT_STATUS;
  }
}

function saveStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save status.json:', error);
    return false;
  }
}

function ensureStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    saveStatus(DEFAULT_STATUS);
  }
}

function formatStatusSummary(status) {
  const lines = [];

  if (status.message) {
    lines.push(`**Paginastatus:** ${status.message}`);
  }

  lines.push(`**Statuslabel:** ${status.statusLabel}`);
  lines.push(`**Voortgang:** ${status.progress}%`);
  lines.push('**Stappen:**');

  status.steps.forEach((step, index) => {
    lines.push(`
${index + 1}. **${step.label}** — ${step.state} (${step.detail || 'Geen detail'})`);
  });

  return lines.join('\n');
}

async function setBotStatus(client, statusText) {
  if (!client?.user) return;

  try {
    await client.user.setPresence({
      activities: [{ name: statusText, type: ActivityType.Playing }],
      status: 'online'
    });
  } catch (error) {
    console.error('Failed to set bot presence:', error);
  }
}

async function registerSlashCommands(token) {
  if (!APP_ID) {
    console.log('DISCORD_APP_ID is not set. Skipping slash command registration.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const body = COMMANDS.map((command) => command.toJSON());

  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body });
      console.log(`Registered ${body.length} guild slash commands for guild ${GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(APP_ID), { body });
      console.log(`Registered ${body.length} global slash commands.`);
    }
  } catch (error) {
    console.error('Failed to register slash commands:', error);
  }
}

async function startBot() {
  console.log('Discord bot startup invoked.');
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log('DISCORD_BOT_TOKEN is not configured. Discord bot will not start.');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once('ready', async () => {
    ensureStatusFile();
    console.log(`Discord bot ready as ${client.user.tag}`);

    await registerSlashCommands(token);
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    const member = interaction.member;
    if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'Je hebt `Manage Server` rechten nodig om dit te gebruiken.', ephemeral: true });
      return;
    }

    const status = loadStatus();
    const commandName = interaction.commandName;

    try {
      switch (commandName) {
        case 'help':
          await interaction.reply(
            'Beschikbare commando\'s:\n' +
            '/summary <tekst> — wijzig de pagina-status\n' +
            '/show — toon huidige status'
          );
          break;

        case 'summary': {
          const statusText = interaction.options.getString('tekst');
          status.message = statusText;
          saveStatus(status);
          await interaction.reply(`Paginastatus bijgewerkt naar: ${statusText}`);
          break;
        }

        case 'show': {
          const reply = formatStatusSummary(status);
          await interaction.reply(reply);
          break;
        }

        default:
          await interaction.reply({ content: 'Onbekend commando.', ephemeral: true });
          break;
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      await interaction.reply({ content: 'Er is iets misgegaan tijdens het uitvoeren van het commando.', ephemeral: true });
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(BOT_PREFIX)) return;

    const member = message.member;
    if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      await message.reply('Je hebt `Manage Server` rechten nodig om botcommando\'s te gebruiken.');
      return;
    }

    const args = message.content.slice(BOT_PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    const status = loadStatus();

    if (!command) return;

    switch (command) {
      case 'help':
        await message.reply(
          'Beschikbare commando\'s:\n' +
          '`!summary <tekst>` — wijzig de pagina-status\n' +
          '`!show` — toon huidige status'
        );
        break;

      case 'summary': {
        const statusText = args.join(' ').trim();
        if (!statusText) {
          await message.reply('Gebruik: `!summary <tekst>` om de pagina-status bij te werken.');
          return;
        }

        status.message = statusText;
        saveStatus(status);
        await message.reply(`Paginastatus bijgewerkt naar: ${statusText}`);
        break;
      }

      case 'show': {
        const reply = formatStatusSummary(status);
        await message.reply(reply);
        break;
      }

      default:
        await message.reply('Onbekend commando. Gebruik `!help` voor beschikbare opties.');
        break;
    }
  });

  try {
    await client.login(token);
  } catch (error) {
    console.error('Login failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startBot();
}

module.exports = { startBot };
