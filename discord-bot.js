const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  InteractionType,
  ActivityType
} = require('discord.js');

const fs = require('fs');

const STATUS_FILE = path.resolve(__dirname, 'status.json');
const BOT_PREFIX = '!';
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

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

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Toon beschikbare statuscommando\'s.'),

  new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Stel de pagina-statusregel in.')
    .addStringOption((option) =>
      option.setName('tekst')
        .setDescription('Nieuwe statusregel')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('progress')
    .setDescription('Wijzig de voortgang.')
    .addIntegerOption((option) =>
      option.setName('waarde')
        .setDescription('Nieuwe voortgang van 0 tot 100')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName('show')
    .setDescription('Toon de huidige status.')
];

function loadStatus() {
  try {
    if (!fs.existsSync(STATUS_FILE)) {
      saveStatus(DEFAULT_STATUS);
      return { ...DEFAULT_STATUS };
    }

    const raw = fs.readFileSync(STATUS_FILE, 'utf8');
    return mergeStatus(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load status.json:', error);
    return mergeStatus(DEFAULT_STATUS);
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

function mergeStatus(status) {
  if (!status || typeof status !== 'object') {
    return { ...DEFAULT_STATUS };
  }

  return {
    ...DEFAULT_STATUS,
    ...status,
    steps: Array.isArray(status.steps) ? status.steps : DEFAULT_STATUS.steps
  };
}

function ensureStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    saveStatus(DEFAULT_STATUS);
  }
}

function formatProgress(progress) {
  if (progress === undefined || progress === null || progress === '') {
    return 'Niet ingesteld';
  }

  return `${progress}%`;
}

function formatStatusSummary(status) {
  if (!status || typeof status !== 'object') {
    return 'Geen statusgegevens beschikbaar.';
  }

  const progressText = formatProgress(status.progress);

  const lines = [
    `**Paginastatus:** ${status.message || 'Geen statusbericht ingesteld.'}`,
    `**${status.statusLabel || 'Status'}** — ${progressText}`,
    '**Stappen:**'
  ];

  const steps = Array.isArray(status.steps) ? status.steps : [];

  steps.forEach((step, index) => {
    lines.push(
      `${index + 1}. **${step.label}** — ${step.state} (${step.detail || 'Geen detail'})`
    );
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

function hasManageGuildPermission(member) {
  return Boolean(member?.permissions?.has(PermissionsBitField.Flags.ManageGuild));
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

    const status = loadStatus();
    await setBotStatus(client, `${status.progress}% klaar`);

    await registerSlashCommands(token);
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;

    if (!hasManageGuildPermission(interaction.member)) {
      await interaction.reply({
        content: 'Je hebt `Manage Server` rechten nodig om dit te gebruiken.',
        ephemeral: true
      });
      return;
    }

    const status = loadStatus();

    try {
      switch (interaction.commandName) {
        case 'help':
          await interaction.reply(
            'Beschikbare commando\'s:\n' +
            '/summary <tekst> — wijzig de pagina-status\n' +
            '/progress <waarde> — wijzig voortgang tussen 0 en 100\n' +
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

        case 'progress': {
          const value = interaction.options.getInteger('waarde');

          status.progress = value;
          saveStatus(status);

          await setBotStatus(client, `${value}% klaar`);
          await interaction.reply(`Voortgang bijgewerkt naar ${value}%`);
          break;
        }

        case 'show': {
          await interaction.reply(formatStatusSummary(status));
          break;
        }

        default:
          await interaction.reply({
            content: 'Onbekend commando.',
            ephemeral: true
          });
          break;
      }
    } catch (error) {
      console.error('Error handling interaction:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Er is iets misgegaan tijdens het uitvoeren van het commando.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'Er is iets misgegaan tijdens het uitvoeren van het commando.',
          ephemeral: true
        });
      }
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(BOT_PREFIX)) return;

    if (!hasManageGuildPermission(message.member)) {
      await message.reply('Je hebt `Manage Server` rechten nodig om botcommando\'s te gebruiken.');
      return;
    }

    const args = message.content.slice(BOT_PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    const status = loadStatus();

    if (!command) return;

    try {
      switch (command) {
        case 'help':
          await message.reply(
            'Beschikbare commando\'s:\n' +
            '`!summary <tekst>` — wijzig de pagina-status\n' +
            '`!progress <0-100>` — wijzig voortgang\n' +
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

        case 'progress': {
          const value = Number.parseInt(args[0], 10);

          if (Number.isNaN(value) || value < 0 || value > 100) {
            await message.reply('Gebruik: `!progress <0-100>`');
            return;
          }

          status.progress = value;
          saveStatus(status);

          await setBotStatus(client, `${value}% klaar`);
          await message.reply(`Voortgang bijgewerkt naar ${value}%`);
          break;
        }

        case 'show':
          await message.reply(formatStatusSummary(status));
          break;

        default:
          await message.reply('Onbekend commando. Gebruik `!help` voor beschikbare opties.');
          break;
      }
    } catch (error) {
      console.error('Error handling message command:', error);
      await message.reply('Er is iets misgegaan tijdens het uitvoeren van het commando.');
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