require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
  Events,
} = require('discord.js');
const { Player, useQueue, QueueRepeatMode } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { YoutubeExtractor } = require('discord-player-youtubei');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Defina DISCORD_TOKEN e CLIENT_ID no arquivo .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Cliente e player
// ---------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client);

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Toca uma música (nome ou link do YouTube/Spotify/SoundCloud)')
    .addStringOption((o) =>
      o.setName('busca').setDescription('Nome da música ou link').setRequired(true)
    ),
  new SlashCommandBuilder().setName('skip').setDescription('Pula a música atual'),
  new SlashCommandBuilder().setName('pause').setDescription('Pausa a música'),
  new SlashCommandBuilder().setName('resume').setDescription('Continua a música pausada'),
  new SlashCommandBuilder().setName('stop').setDescription('Para tudo e sai do canal de voz'),
  new SlashCommandBuilder().setName('fila').setDescription('Mostra a fila de músicas'),
  new SlashCommandBuilder().setName('tocando').setDescription('Mostra a música que está tocando'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajusta o volume (0 a 100)')
    .addIntegerOption((o) =>
      o.setName('valor').setDescription('Volume de 0 a 100').setMinValue(0).setMaxValue(100).setRequired(true)
    ),
  new SlashCommandBuilder().setName('shuffle').setDescription('Embaralha a fila'),
  new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Define o modo de repetição')
    .addStringOption((o) =>
      o
        .setName('modo')
        .setDescription('Modo de repetição')
        .setRequired(true)
        .addChoices(
          { name: 'Desligado', value: 'off' },
          { name: 'Música atual', value: 'track' },
          { name: 'Fila inteira', value: 'queue' }
        )
    ),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Comandos registrados (${GUILD_ID ? 'servidor' : 'globais'}).`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const cor = 0x5865f2;

function embed(descricao) {
  return new EmbedBuilder().setColor(cor).setDescription(descricao);
}

function precisaEstarEmVoz(interaction) {
  const canal = interaction.member?.voice?.channel;
  if (!canal) {
    interaction.reply({ embeds: [embed('Entre em um canal de voz primeiro.')], flags: MessageFlags.Ephemeral });
    return null;
  }
  const meuCanal = interaction.guild.members.me?.voice?.channel;
  if (meuCanal && meuCanal.id !== canal.id) {
    interaction.reply({
      embeds: [embed(`Estou tocando em **${meuCanal.name}**. Entre lá para controlar o bot.`)],
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return canal;
}

function filaAtiva(interaction) {
  const queue = useQueue(interaction.guild.id);
  if (!queue || !queue.isPlaying()) {
    interaction.reply({ embeds: [embed('Não há nada tocando agora.')], flags: MessageFlags.Ephemeral });
    return null;
  }
  return queue;
}

// ---------------------------------------------------------------------------
// Eventos do player
// ---------------------------------------------------------------------------
player.events.on('playerStart', (queue, track) => {
  const e = new EmbedBuilder()
    .setColor(cor)
    .setTitle('Tocando agora')
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Artista', value: track.author || 'Desconhecido', inline: true },
      { name: 'Duração', value: track.duration || '—', inline: true }
    );
  if (track.thumbnail) e.setThumbnail(track.thumbnail);
  queue.metadata?.send({ embeds: [e] }).catch(() => {});
});

player.events.on('audioTrackAdd', (queue, track) => {
  // Só avisa quando já existe algo tocando (a primeira faixa já dispara "playerStart")
  if (queue.isPlaying() && queue.tracks.size > 0) {
    queue.metadata
      ?.send({ embeds: [embed(`Adicionada à fila: **${track.title}**`)] })
      .catch(() => {});
  }
});

player.events.on('emptyQueue', (queue) => {
  queue.metadata?.send({ embeds: [embed('A fila acabou. Saindo do canal em instantes.')] }).catch(() => {});
});

player.events.on('playerError', (queue, error) => {
  console.error('Erro no player:', error);
  queue.metadata?.send({ embeds: [embed('Deu erro ao tocar essa faixa. Pulando...')] }).catch(() => {});
});

player.events.on('error', (queue, error) => {
  console.error('Erro na fila:', error);
});

// ---------------------------------------------------------------------------
// Execução dos comandos
// ---------------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  try {
    switch (interaction.commandName) {
      case 'play': {
        const canal = precisaEstarEmVoz(interaction);
        if (!canal) return;

        await interaction.deferReply();
        const busca = interaction.options.getString('busca', true);

        const { track } = await player.play(canal, busca, {
          nodeOptions: {
            metadata: interaction.channel,
            selfDeaf: true,
            volume: 50,
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: 30_000,
            leaveOnEnd: true,
            leaveOnEndCooldown: 30_000,
            leaveOnStop: true,
          },
        });

        await interaction.editReply({ embeds: [embed(`Procurando: **${track.title}**`)] });
        break;
      }

      case 'skip': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = filaAtiva(interaction);
        if (!queue) return;
        const atual = queue.currentTrack;
        queue.node.skip();
        await interaction.reply({ embeds: [embed(`Pulada: **${atual?.title ?? 'faixa atual'}**`)] });
        break;
      }

      case 'pause': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = filaAtiva(interaction);
        if (!queue) return;
        queue.node.setPaused(true);
        await interaction.reply({ embeds: [embed('Pausado.')] });
        break;
      }

      case 'resume': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = useQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({ embeds: [embed('Não há nada na fila.')], flags: MessageFlags.Ephemeral });
        }
        queue.node.setPaused(false);
        await interaction.reply({ embeds: [embed('Continuando.')] });
        break;
      }

      case 'stop': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = useQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({ embeds: [embed('Não há nada tocando.')], flags: MessageFlags.Ephemeral });
        }
        queue.delete();
        await interaction.reply({ embeds: [embed('Parei a música e saí do canal.')] });
        break;
      }

      case 'fila': {
        const queue = useQueue(interaction.guild.id);
        if (!queue || !queue.currentTrack) {
          return interaction.reply({ embeds: [embed('A fila está vazia.')], flags: MessageFlags.Ephemeral });
        }
        const proximas = queue.tracks.toArray().slice(0, 10);
        const linhas = proximas.map((t, i) => `**${i + 1}.** ${t.title} — ${t.duration}`);
        const restante = queue.tracks.size - proximas.length;
        const e = new EmbedBuilder()
          .setColor(cor)
          .setTitle('Fila de músicas')
          .setDescription(
            `**Tocando:** ${queue.currentTrack.title}\n\n` +
              (linhas.length ? linhas.join('\n') : 'Nenhuma música a seguir.') +
              (restante > 0 ? `\n\n…e mais ${restante}` : '')
          );
        await interaction.reply({ embeds: [e] });
        break;
      }

      case 'tocando': {
        const queue = filaAtiva(interaction);
        if (!queue) return;
        const t = queue.currentTrack;
        const barra = queue.node.createProgressBar();
        const e = new EmbedBuilder()
          .setColor(cor)
          .setTitle('Tocando agora')
          .setDescription(`[${t.title}](${t.url})\n\n${barra}`)
          .addFields({ name: 'Artista', value: t.author || 'Desconhecido', inline: true });
        if (t.thumbnail) e.setThumbnail(t.thumbnail);
        await interaction.reply({ embeds: [e] });
        break;
      }

      case 'volume': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = filaAtiva(interaction);
        if (!queue) return;
        const valor = interaction.options.getInteger('valor', true);
        queue.node.setVolume(valor);
        await interaction.reply({ embeds: [embed(`Volume em **${valor}%**.`)] });
        break;
      }

      case 'shuffle': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = useQueue(interaction.guild.id);
        if (!queue || queue.tracks.size < 2) {
          return interaction.reply({ embeds: [embed('Preciso de pelo menos 2 músicas na fila.')], flags: MessageFlags.Ephemeral });
        }
        queue.tracks.shuffle();
        await interaction.reply({ embeds: [embed('Fila embaralhada.')] });
        break;
      }

      case 'loop': {
        if (!precisaEstarEmVoz(interaction)) return;
        const queue = filaAtiva(interaction);
        if (!queue) return;
        const modo = interaction.options.getString('modo', true);
        const mapa = {
          off: [QueueRepeatMode.OFF, 'Repetição desligada.'],
          track: [QueueRepeatMode.TRACK, 'Repetindo a música atual.'],
          queue: [QueueRepeatMode.QUEUE, 'Repetindo a fila inteira.'],
        };
        queue.setRepeatMode(mapa[modo][0]);
        await interaction.reply({ embeds: [embed(mapa[modo][1])] });
        break;
      }
    }
  } catch (err) {
    console.error(`Erro em /${interaction.commandName}:`, err);
    const msg = { embeds: [embed('Não consegui fazer isso. Tente outra busca ou link.')], flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      interaction.editReply(msg).catch(() => {});
    } else {
      interaction.reply(msg).catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
client.once(Events.ClientReady, async () => {
  console.log(`Logado como ${client.user.tag}`);

  await player.extractors.loadMulti(DefaultExtractors);
  await player.extractors.register(YoutubeExtractor, {});

  try {
    await registerCommands();
  } catch (err) {
    console.error('Falha ao registrar comandos:', err);
  }
});

client.login(DISCORD_TOKEN);