# Bot de Música para Discord

Bot em Node.js com slash commands, usando `discord.js` v14 e `discord-player` v7.

## Comandos

| Comando | O que faz |
|---|---|
| `/play busca` | Toca por nome ou link (YouTube, Spotify, SoundCloud) e adiciona à fila |
| `/skip` | Pula a música atual |
| `/pause` / `/resume` | Pausa e continua |
| `/stop` | Para tudo e sai do canal |
| `/fila` | Mostra as próximas músicas |
| `/tocando` | Música atual com barra de progresso |
| `/volume valor` | Volume de 0 a 100 |
| `/shuffle` | Embaralha a fila |
| `/loop modo` | Desligado, música atual ou fila inteira |

## Requisitos

- Node.js 18.17 ou superior
- Uma conta no Discord com acesso ao Developer Portal

## Passo a passo

### 1. Criar o bot

1. Acesse https://discord.com/developers/applications e clique em **New Application**.
2. Em **Bot**, clique em **Reset Token** e copie o token.
3. Em **General Information**, copie o **Application ID**.
4. Não é preciso ativar nenhum Privileged Intent.

### 2. Convidar o bot para o servidor

Em **OAuth2 > URL Generator**, marque:

- Scopes: `bot` e `applications.commands`
- Bot Permissions: `View Channels`, `Send Messages`, `Embed Links`, `Connect`, `Speak`

Abra a URL gerada e escolha o servidor.

### 3. Configurar e rodar

```bash
npm install
cp .env.example .env     # no Windows: copy .env.example .env
# edite o .env com DISCORD_TOKEN, CLIENT_ID e (opcional) GUILD_ID
npm start
```

Ao iniciar, o bot registra os slash commands sozinho. Com `GUILD_ID` preenchido eles aparecem na hora; sem ele, podem levar até 1 hora.

## Observações importantes

- **Nunca compartilhe o token** nem suba o `.env` para o GitHub. Se vazar, gere outro no Developer Portal.
- O YouTube muda com frequência e pode quebrar a extração de áudio (erros como `Failed to extract signature decipher algorithm` e `No results found`). Quando isso acontecer, atualize as bibliotecas de YouTube e reinicie o bot:
  ```bash
  npm install youtubei.js@latest discord-player-youtubei@latest simple-ytdl-core@latest bgutils-js@latest googlevideo@latest
  ```
- O `discord-player-youtubei` v3 precisa dos pacotes `simple-ytdl-core`, `bgutils-js` e `googlevideo` instalados junto (já estão no `package.json`).
- Para rodar 24h, hospede em uma VPS ou serviço de hospedagem de bots, com `pm2` ou Docker.
- O bot usa o `ffmpeg-static`, então não precisa instalar o FFmpeg manualmente.

## Ideias para evoluir

- Botões de controle (pausar/pular) na mensagem de "Tocando agora"
- Comando `/remove` e `/skipto`
- Salvar playlists por servidor
- Filtros de áudio (bass boost, nightcore)