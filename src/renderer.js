'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const crypto = require('crypto');

// Path to the locally installed mmdc binary (installed via npm ci)
const MMDC = path.join(__dirname, '..', 'node_modules', '.bin', 'mmdc');

// Puppeteer launch config — enables headless Chromium in Docker without a sandbox
const PUPPETEER_CONFIG = path.join(__dirname, '..', 'puppeteer-config.json');

const RENDER_TIMEOUT_MS = parseInt(process.env.RENDER_TIMEOUT_MS || '60000', 10);
const MERMAID_THEME = process.env.MERMAID_THEME || 'default';
const MERMAID_BACKGROUND = process.env.MERMAID_BACKGROUND || 'white';

// Strip ANSI escape codes from mmdc stderr for cleaner error messages
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Renders a Mermaid diagram source string to a PNG Buffer.
 * Uses @mermaid-js/mermaid-cli (mmdc) with the system Chromium in Docker.
 *
 * @param {string} code — Raw Mermaid diagram source (without the code-fence markers)
 * @returns {Promise<Buffer>} PNG image data
 * @throws {Error} If rendering fails or times out
 */
async function renderMermaid(code) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mermaid-'));
  const id = crypto.randomUUID();
  const inputFile = path.join(tmpDir, `${id}.mmd`);
  const outputFile = path.join(tmpDir, `${id}.png`);

  try {
    await fs.writeFile(inputFile, code, 'utf-8');

    await execFileAsync(
      MMDC,
      [
        '-i', inputFile,
        '-o', outputFile,
        '-t', MERMAID_THEME,
        '-b', MERMAID_BACKGROUND,
        '--puppeteerConfigFile', PUPPETEER_CONFIG,
      ],
      {
        timeout: RENDER_TIMEOUT_MS,
        encoding: 'utf-8',
      },
    );

    return await fs.readFile(outputFile);
  } catch (err) {
    // Surface a clean error message from mmdc's stderr output
    const raw = err.stderr?.trim() || err.stdout?.trim() || err.message || 'Rendering failed';
    const cleaned = raw.replace(ANSI_RE, '');
    throw new Error(cleaned);
  } finally {
    // Always clean up temp files, even on error
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { renderMermaid };
