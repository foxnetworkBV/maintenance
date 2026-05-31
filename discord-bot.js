const { Client, GatewayIntentBits, PermissionsBitField, Partials, REST, Routes, SlashCommandBuilder, InteractionType, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.resolve(__dirname, 'status.json');
const BOT_PREFIX = '!';
const APP_ID = process.env.DISCORD_APP_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const COMMANDS = [
  new SlashCommandBuilder().setName('help').setDescription('Toon beschikbare statuscommando\'s.'),
  new SlashCommandBuilder().setName('status').setDescription('Update voortgangpercentage.')
    .addIntegerOption((option) => option.setName('percentage').setDescription('Voortgang 0-100').setRequired(true)),
  new SlashCommandBuilder().setName('step').setDescription('Update een statusstap.')
    .addIntegerOption((option) => option.setName('nummer').setDescription('Stapnummer').setRequired(true))
    .addStringOption((option) => option.setName('state').setDescription('complete, current of pending').setRequired(true)
      .addChoices(
        { name: 'complete', value: 'complete' },
        { name: 'current', value: 'current' },
        { name: 'pending', value: 'pending' }
      ))
    .addStringOption((option) => option.setName('detail').setDescription('Extra statusdetail').setRequired(false)),
  new SlashCommandBuilder().setName('label').setDescription('Wijzig het statuslabel.')
    .addStringOption((option) => option.setName('tekst').setDescription('Nieuwe labeltekst').setRequired(true)),
  new SlashCommandBuilder().setName('botstatus').setDescription('Stel de Discord botstatus in.')
    .addStringOption((option) => option.setName('tekst').setDescription('Nieuwe botstatus').setRequired(true)),
  new SlashCommandBuilder().setName('show').setDescription('Toon de huidige status.'),
  new SlashCommandBuilder().setName('reset').setDescription('Herstel de standaardstatus.')
];

const DEFAULT_STATUS = {
  statusLabel: 'Ontwikkelingsstatus',
  progress: 75,
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
  const lines = [
    `**Statuslabel:** ${status.statusLabel}`,
    `**Voortgang:** ${status.progress}%`,
    '**Stappen:**'
  ];

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
            '/status <percentage> — update voortgang\n' +
            '/step <nummer> <complete|current|pending> [detail] — update een stap\n' +
            '/label <tekst> — wijzig het statuslabel\n' +
            '/botstatus <tekst> — wijzig de botstatus\n' +
            '/show — toon huidige status\n' +
            '/reset — herstel standaardstatus'
          );
          break;

        case 'status': {
          const percentage = interaction.options.getInteger('percentage');
          status.progress = Math.round(percentage);
          saveStatus(status);
          await interaction.reply(`Voortgang bijgewerkt naar ${status.progress}%`);
          break;
        }

        case 'step': {
          const stepIndex = interaction.options.getInteger('nummer') - 1;
          const state = interaction.options.getString('state');
          const detail = interaction.options.getString('detail') || '';

          status.steps[stepIndex].state = state;
          if (detail) {
            status.steps[stepIndex].detail = detail;
          }

          saveStatus(status);
          await interaction.reply('Stap ' + (stepIndex + 1) + ' bijgewerkt naar `' + state + '`' + (detail ? ` met detail: ${detail}` : ''));
          break;
        }

        case 'label': {
          const label = interaction.options.getString('tekst');
          status.statusLabel = label;
          saveStatus(status);
          await interaction.reply(`Statuslabel bijgewerkt naar: ${label}`);
          break;
        }

        case 'botstatus': {
          const statusText = interaction.options.getString('tekst');
          await setBotStatus(interaction.client, statusText);
          await interaction.reply(`Botstatus bijgewerkt naar: ${statusText}`);
          break;
        }

        case 'show': {
          const reply = formatStatusSummary(status);
          await interaction.reply(reply);
          break;
        }

        case 'reset': {
          saveStatus(DEFAULT_STATUS);
          await interaction.reply('Status teruggezet naar het standaardgegevens.');
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
          '`!status <percentage>` — update voortgang\n' +
          '`!step <nummer> <complete|current|pending> [detail]` — update een stap\n' +
          '`!label <tekst>` — wijzig de statuslabel\n' +
          '`!botstatus <tekst>` — wijzig de botstatus\n' +
          '`!show` — toon huidige status\n' +
          '`!reset` — herstel standaardstatus'
        );
        break;

      case 'status': {
        const percentage = Number(args[0]);
        if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
          await message.reply('Gebruik: `!status <percentage>` met een waarde tussen 0 en 100.');
          return;
        }

        status.progress = Math.round(percentage);
        saveStatus(status);
        await message.reply(`Voortgang bijgewerkt naar ${status.progress}%`);
        break;
      }

      case 'step': {
        const stepIndex = Number(args[0]) - 1;
        const state = args[1]?.toLowerCase();
        const detail = args.slice(2).join(' ');

        if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= status.steps.length) {
          await message.reply('Gebruik: `!step <nummer> <complete|current|pending> [detail]` en kies een geldig stapnummer.');
          return;
        }

        if (!['complete', 'current', 'pending'].includes(state)) {
          await message.reply('Stapstatus moet `complete`, `current` of `pending` zijn.');
          return;
        }

        status.steps[stepIndex].state = state;
        if (detail) {
          status.steps[stepIndex].detail = detail;
        }

        saveStatus(status);
        await message.reply(
          'Stap ' + (stepIndex + 1) + ' bijgewerkt naar `' + state + '`' +
          (detail ? ` met detail: ${detail}` : '')
        );
        break;
      }

      case 'label': {
        const label = args.join(' ').trim();
        if (!label) {
          await message.reply('Gebruik: `!label <tekst>` om het statuslabel bij te werken.');
          return;
        }

        status.statusLabel = label;
        saveStatus(status);
        await message.reply(`Statuslabel bijgewerkt naar: ${label}`);
        break;
      }

      case 'botstatus': {
        const statusText = args.join(' ').trim();
        if (!statusText) {
          await message.reply('Gebruik: `!botstatus <tekst>` om de botstatus bij te werken.');
          return;
        }

        await setBotStatus(message.client, statusText);
        await message.reply(`Botstatus bijgewerkt naar: ${statusText}`);
        break;
      }

      case 'show': {
        const reply = formatStatusSummary(status);
        await message.reply(reply);
        break;
      }

      case 'reset': {
        saveStatus(DEFAULT_STATUS);
        await message.reply('Status teruggezet naar het standaardgegevens.');
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
