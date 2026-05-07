'use strict';

const { Client, GatewayIntentBits, Events, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { renderMermaid } = require('./renderer');
const { checkRateLimit } = require('./rateLimiter');

// Matches ```mermaid ... ``` blocks (case-insensitive tag)
const MERMAID_BLOCK_RE = /```mermaid\s*([\s\S]+?)\s*```/gi;

const MAX_DIAGRAMS_PER_MESSAGE = parseInt(process.env.MAX_DIAGRAMS_PER_MESSAGE || '3', 10);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] Ready! Logged in as ${c.user.tag}`);
  // Signal file used by Docker HEALTHCHECK
  try {
    fs.writeFileSync('/tmp/bot-ready', 'ready');
  } catch {
    // /tmp may not exist in all environments; ignore
  }
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots (including ourselves) to prevent loops
  if (message.author.bot) return;

  // Extract all mermaid code blocks from the message
  const rawMatches = [...message.content.matchAll(MERMAID_BLOCK_RE)];
  if (rawMatches.length === 0) return;

  // Respect per-user rate limit
  const rateCheck = checkRateLimit(message.author.id);
  if (!rateCheck.allowed) {
    const seconds = Math.ceil(rateCheck.remainingMs / 1000);
    await message.react('⏳').catch(() => {});
    await message
      .reply({ content: `⏳ Please wait ${seconds}s before rendering another diagram.` })
      .catch(() => {});
    return;
  }

  // Limit how many diagrams we render from a single message
  const diagrams = rawMatches
    .slice(0, MAX_DIAGRAMS_PER_MESSAGE)
    .map((m) => m[1].trim())
    .filter(Boolean);

  if (diagrams.length === 0) return;

  // Show typing indicator while rendering
  await message.channel.sendTyping().catch(() => {});

  for (const [index, code] of diagrams.entries()) {
    try {
      const imageBuffer = await renderMermaid(code);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'diagram.png' });

      const replyOptions = { files: [attachment] };
      if (diagrams.length > 1) {
        replyOptions.content = `Diagram ${index + 1} of ${diagrams.length}`;
      }

      await message.reply(replyOptions);
    } catch (err) {
      console.error(`[bot] Render error (message=${message.id}, diagram=${index + 1}):`, err.message);

      const label = diagrams.length > 1 ? ` #${index + 1}` : '';
      // Truncate error text so we don't exceed Discord's 2000-char message limit
      const errText = (err.message || 'Unknown error').slice(0, 800);

      await message
        .reply({
          content: `❌ Failed to render diagram${label}. Please check your Mermaid syntax.\n\`\`\`\n${errText}\n\`\`\``,
        })
        .catch(() => {});
    }
  }
});

// Graceful shutdown on container stop signals
function shutdown(signal) {
  console.log(`[bot] Received ${signal}, shutting down gracefully…`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Validate token before attempting login
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[bot] FATAL: DISCORD_TOKEN environment variable is not set.');
  process.exit(1);
}

client.login(token).catch((err) => {
  console.error('[bot] FATAL: Failed to log in to Discord:', err.message);
  process.exit(1);
});
