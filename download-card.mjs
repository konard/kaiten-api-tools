#!/usr/bin/env node
/**
 * download-card.mjs
 * Fetches a Kaiten card by ID and outputs it as Markdown.
 * Usage:
 *   node download-card.mjs <cardId> [outputFile]
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m via fetch
const resp = await fetch('https://unpkg.com/use-m/use.js');
const script = await resp.text();
const { makeUse } = eval(script);
// Create a use() bound to this module's context
const use = await makeUse({ meta: import.meta, scriptPath: import.meta.url });

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios and turndown correctly
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;
const TurndownService = await use('turndown@7.1.1');

/**
 * Download Kaiten card data and convert to Markdown.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} [options.apiBase='https://developers.kaiten.ru/v1'] - Base URL.
 * @returns {Promise<string>} - Markdown representation.
 */
export async function downloadCardToMarkdown({ cardId, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL || 'https://developers.kaiten.ru/v1' }) {
  if (!cardId) throw new Error('cardId is required');
  const url = `${apiBase}/cards/${cardId}`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await axios.get(url, { headers });
  const card = response.data;
  const turndownService = new TurndownService();

  let md = `# ${card.name}\n\n`;
  md += `- **ID**: ${card.id}\n`;
  if (card.status?.name) md += `- **Status**: ${card.status.name}\n`;
  if (card.estimate != null) md += `- **Estimate**: ${card.estimate}\n`;
  md += `\n## Description\n\n`;
  md += card.description ? turndownService.turndown(card.description) : '';
  md += '\n';
  return md;
}

// If run as CLI
const __filename = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === __filename) {
  const [, , cardId, outputFile] = process.argv;
  if (!cardId) {
    console.error('Usage: download-card.mjs <cardId> [outputFile]');
    process.exit(1);
  }
  const token = process.env.KAITEN_API_TOKEN;
  const apiBase = process.env.KAITEN_API_BASE_URL;
  try {
    const md = await downloadCardToMarkdown({ cardId, token, apiBase });
    if (outputFile) {
      await writeFile(outputFile, md, 'utf-8');
    } else {
      console.log(md);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
} 