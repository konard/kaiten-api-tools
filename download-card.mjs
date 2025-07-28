#!/usr/bin/env node
/**
 * download-card.mjs
 * Fetches a Kaiten card by ID and outputs it as Markdown and JSON.
 * Usage:
 *   node download-card.mjs <cardId|url> [options]
 *   Examples:
 *     node download-card.mjs 123456
 *     node download-card.mjs https://company.kaiten.ru/123456
 *     node download-card.mjs 123456 --output-dir ./custom/path
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 */
import { writeFile, mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
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

// Import yargs for CLI argument parsing
const yargsModule = await use('yargs@17.7.2');
const yargs = yargsModule.default || yargsModule;

/**
 * Download a file from URL to a local path.
 * @param {string} url - The file URL.
 * @param {string} filePath - The local file path.
 * @param {object} headers - Request headers.
 */
async function downloadFile(url, filePath, headers = {}) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: headers
  });
  
  const writer = createWriteStream(filePath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

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
 * @returns {Promise<{card: object, markdown: string}>} - Card data and markdown representation.
 */
export async function downloadCard({ cardId, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
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
    
    // Add files section if any files exist
    if (card.files && card.files.length > 0) {
      md += '## Files\n\n';
      for (const file of card.files) {
        const fileName = file.name || `file_${file.id}`;
        const isImage = /\.(png|jpg|jpeg|gif|bmp|svg)$/i.test(fileName);
        
        md += `### ${fileName}\n\n`;
        md += `- **URL**: ${file.url}\n`;
        md += `- **Size**: ${file.size} bytes\n`;
        if (file.created) md += `- **Created**: ${file.created}\n`;
        
        if (isImage) {
          md += `\n![${fileName}](files/${fileName})\n`;
        } else {
          md += `\n[Download ${fileName}](files/${fileName})\n`;
        }
        md += '\n';
      }
    }
    
    return { card, markdown: md };
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

/**
 * Extract subdomain from API base URL.
 * @param {string} apiBase - The API base URL.
 * @returns {string} - Subdomain name.
 */
function extractSubdomain(apiBase) {
  try {
    const url = new URL(apiBase);
    // Extract subdomain from hostname like 'company.kaiten.ru'
    const parts = url.hostname.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'kaiten') {
      return parts[0];
    }
    return url.hostname;
  } catch (err) {
    return 'unknown';
  }
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const argv = yargs(process.argv.slice(2))
    .usage('Usage: $0 <cardId|url> [options]')
    .positional('card', {
      describe: 'Card ID or full Kaiten URL',
      type: 'string',
      demandOption: true
    })
    .option('output-dir', {
      alias: 'o',
      describe: 'Output directory (default: ./data/<subdomain>/<card-id>/)',
      type: 'string'
    })
    .option('token', {
      alias: 't',
      describe: 'API token (defaults to KAITEN_API_TOKEN env var)',
      type: 'string',
      default: process.env.KAITEN_API_TOKEN
    })
    .help()
    .alias('help', 'h')
    .argv;

  const cardInput = argv._[0];
  log('CLI invoked with cardInput=%s, outputDir=%s', cardInput, argv.outputDir);
  
  if (!cardInput) {
    console.error('Error: Card ID or URL is required');
    process.exit(1);
  }
  
  try {
    const { cardId, apiBase } = parseCardInput(cardInput);
    const { card, markdown } = await downloadCard({ cardId, token: argv.token, apiBase });
    
    // Determine output directory
    const subdomain = extractSubdomain(apiBase);
    const outputDir = argv.outputDir || path.join('./data', subdomain, cardId);
    
    // Create directory structure
    await mkdir(outputDir, { recursive: true });
    const filesDir = path.join(outputDir, 'files');
    if (card.files && card.files.length > 0) {
      await mkdir(filesDir, { recursive: true });
    }
    log('Created directory: %s', outputDir);
    
    // Save both files
    const mdPath = path.join(outputDir, 'card.md');
    const jsonPath = path.join(outputDir, 'card.json');
    
    await writeFile(mdPath, markdown, 'utf-8');
    await writeFile(jsonPath, JSON.stringify(card, null, 2), 'utf-8');
    
    console.log(`✓ Card downloaded successfully:`);
    console.log(`  - Markdown: ${mdPath}`);
    console.log(`  - JSON: ${jsonPath}`);
    
    // Download all files
    if (card.files && card.files.length > 0) {
      console.log(`\n✓ Downloading ${card.files.length} file(s):`);
      const headers = argv.token ? { Authorization: `Bearer ${argv.token}` } : {};
      
      for (const file of card.files) {
        const fileName = file.name || `file_${file.id}`;
        const filePath = path.join(filesDir, fileName);
        
        try {
          await downloadFile(file.url, filePath, headers);
          console.log(`  - Downloaded: "./data/${subdomain}/${cardId}/files/${fileName}"`);
        } catch (err) {
          console.error(`  - Failed to download ${fileName}: ${err.message}`);
        }
      }
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