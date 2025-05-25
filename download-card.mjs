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
const TurndownService = await use('turndown@7.1.1');

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

    let md = `# ${card.name}\n\n`;
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
  const [, , cardId, outputFile] = process.argv;
  log('CLI invoked with cardId=%s, outputFile=%s', cardId, outputFile);
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