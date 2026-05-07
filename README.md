# Mermaid Discord Bot

A Discord bot that **automatically** detects and renders [Mermaid](https://mermaid.js.org/) diagram code blocks in chat messages, replying with a rendered PNG image — no commands required.

---

## How It Works

Post any message that contains a fenced ` ```mermaid ``` ` block:

````
```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[🎉 Great!]
    B -->|No|  D[Debug]
    D --> B
```
````

The bot detects the block, renders the diagram locally using
[`@mermaid-js/mermaid-cli`](https://github.com/mermaid-js/mermaid-cli), and
replies with the image — all within a few seconds.

---

## Features

| Feature | Details |
|---|---|
| **Automatic detection** | No command needed — just post a ` ```mermaid ``` ` block |
| **Multiple diagrams** | All blocks in one message are rendered (up to `MAX_DIAGRAMS_PER_MESSAGE`) |
| **Local rendering** | Chromium + mmdc run inside the container — no external API calls |
| **Rate limiting** | Per-user cooldown prevents abuse |
| **Configurable theme** | Set via `MERMAID_THEME` env var |
| **Docker-native** | One `docker compose up` and it's running |
| **Graceful shutdown** | Handles `SIGTERM`/`SIGINT` cleanly for zero-downtime restarts |
| **Health check** | Docker marks the container healthy only after the bot connects |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) (v2)
- A Discord bot token (instructions below)

---

## Setup

### 1 — Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → give it a name → **Create**
3. Left sidebar → **Bot** → **Add Bot**
4. Under **Token** → **Reset Token** → copy the token — this is your `DISCORD_TOKEN`
5. Under **Privileged Gateway Intents** → enable **Message Content Intent**
   *(required for the bot to read message text)*
6. Left sidebar → **OAuth2 → URL Generator**
   - **Scopes:** `bot`
   - **Bot Permissions:** `View Channels`, `Send Messages`, `Attach Files`, `Read Message History`
7. Open the generated URL to invite the bot to your server

### 2 — Configure the Environment

```bash
cp env.example .env
```

Edit `.env` and fill in your token:

```env
DISCORD_TOKEN=your_bot_token_here
```

### 3 — Run

```bash
docker compose up -d
```

Check live logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

---

## Configuration

All options are set via environment variables in `.env` (or directly in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | **required** | Discord bot token |
| `MERMAID_THEME` | `default` | Diagram theme: `default` \| `dark` \| `forest` \| `neutral` \| `base` |
| `MERMAID_BACKGROUND` | `white` | Background colour — any CSS colour or `transparent` |
| `RENDER_COOLDOWN_MS` | `10000` | Milliseconds a user must wait between renders (rate limit) |
| `MAX_DIAGRAMS_PER_MESSAGE` | `3` | Maximum diagrams rendered from a single message |
| `RENDER_TIMEOUT_MS` | `60000` | Milliseconds before a render is aborted |

---

## Supported Diagram Types

All Mermaid diagram types work out of the box:

- Flowchart / graph
- Sequence diagram
- Class diagram
- State diagram
- Entity-relationship diagram
- Gantt chart
- Pie chart
- Git graph
- Mindmap
- Timeline
- And more…

---

## Local Development (without Docker)

Requirements: **Node.js ≥ 20** and **Chromium** installed locally.

```bash
npm install
export DISCORD_TOKEN=your_token_here
npm start
```

> `mmdc` (the Mermaid CLI) will use the `PUPPETEER_EXECUTABLE_PATH` env var or
> its own bundled Chromium. Set `puppeteer-config.json` args as needed for your OS.

---

## Troubleshooting

**Bot doesn't respond to mermaid blocks**
- Confirm **Message Content Intent** is enabled in the Developer Portal
- Confirm the bot has `Send Messages` and `Attach Files` permissions in the channel
- Check logs: `docker compose logs -f`

**Rendering fails / timeouts**
- The very first render after startup is slower (Chromium cold start)
- Increase `RENDER_TIMEOUT_MS` if timeouts occur on large diagrams
- Ensure `shm_size: 256m` is set in `docker-compose.yml` — Chromium needs shared memory

**"Cannot find module" errors**
- Run `npm install` (or rebuild the Docker image with `docker compose build --no-cache`)

---

## Architecture

```
Discord message with ```mermaid block
         │
         ▼
   src/index.js          — discord.js event listener
         │  rate limit check (rateLimiter.js)
         │  extract code from code fence
         ▼
   src/renderer.js        — writes .mmd file to /tmp,
         │                  spawns mmdc (mermaid-cli)
         │                  via child_process.execFile
         ▼
   @mermaid-js/mermaid-cli
         │  launches headless Chromium (puppeteer)
         │  renders diagram → PNG buffer
         ▼
   discord.js reply with AttachmentBuilder(buffer)
```

---

## License

MIT
