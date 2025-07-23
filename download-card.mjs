#!/usr/bin/env node
/**
 * download-card.mjs
 * Fetches a Kaiten card by ID and outputs it as Markdown.
 * Usage:
 *   node download-card.mjs <cardId|url> [outputFile]
 *   Examples:
 *     node download-card.mjs 123456 [outputFile]
 *     node download-card.mjs https://company.kaiten.ru/123456 [outputFile]
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Import debug for tracing via use-m
const debugModule = await use('debug@4.3.4');
const debug = debugModule.default || debugModule;
const log = debug('kaiten:download-card');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios and turndown correctly
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;
const turndownModule = await use('turndown@7.2.0');
const TurndownService = turndownModule.default || turndownModule;

/**
 * Parse card input (ID or URL) and extract card ID and base API URL.
 * @param {string} input - Card ID or full Kaiten URL.
 * @returns {{cardId: string, apiBase: string}} - Extracted card ID and API base URL.
 */
function parseCardInput(input) {
  // If input is just a number/ID, use environment variable for base URL
  if (/^\d+$/.test(input.trim())) {
    const apiBase = process.env.KAITEN_API_BASE_URL;
    if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL for card ID input');
    return { cardId: input.trim(), apiBase };
  }
  
  // Parse URL format: https://domain.com/cardId
  try {
    const url = new URL(input);
    const cardId = url.pathname.replace('/', '').trim();
    if (!/^\d+$/.test(cardId)) {
      throw new Error(`Invalid card ID extracted from URL: ${cardId}`);
    }
    const apiBase = `${url.protocol}//${url.host}/api/v1`;
    return { cardId, apiBase };
  } catch (err) {
    throw new Error(`Invalid URL format: ${input}. Expected format: https://company.kaiten.ru/123456 or just card ID`);
  }
}

/**
 * Download Kaiten card data and convert to Markdown.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} [options.apiBase='https://developers.kaiten.ru/v1'] - Base URL.
 * @returns {Promise<string>} - Markdown representation.
 */
export async function downloadCardToMarkdown({ cardId, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  log('downloadCardToMarkdown called with cardId=%s, apiBase=%s', cardId, apiBase);
  if (!cardId) throw new Error('cardId is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const url = `${apiBase}/cards/${cardId}`;
  log('Fetching card at %s', url);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const response = await axios.get(url, { headers });
    log('Received card data: %O', response.data);
    const card = response.data;
    const turndownService = new TurndownService();

    let md = `# ${card.title}\n\n`;
    md += `- **ID**: ${card.id}\n`;
    if (card.status?.name) md += `- **Status**: ${card.status.name}\n`;
    if (card.estimate != null) md += `- **Estimate**: ${card.estimate}\n`;
    md += `\n## Description\n\n`;
    md += card.description ? turndownService.turndown(card.description) : '';
    log('Converted description to Markdown');
    md += '\n';
    return md;
  } catch (err) {
    if (typeof err.toJSON === 'function') {
      log('AxiosError toJSON:', JSON.stringify(err.toJSON(), null, 2));
      console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
    } else if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
    throw err;
  }
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const [, , cardInput, outputFile] = process.argv;
  log('CLI invoked with cardInput=%s, outputFile=%s', cardInput, outputFile);
  if (!cardInput) {
    console.error('Usage: download-card.mjs <cardId|url> [outputFile]');
    process.exit(1);
  }
  const token = process.env.KAITEN_API_TOKEN;
  try {
    const { cardId, apiBase } = parseCardInput(cardInput);
    const md = await downloadCardToMarkdown({ cardId, token, apiBase });
    if (outputFile) {
      await writeFile(outputFile, md, 'utf-8');
    } else {
      console.log(md);
    }
  } catch (err) {
    if (typeof err.toJSON === 'function') {
      console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
    } else if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}