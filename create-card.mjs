#!/usr/bin/env node
/**
 * create-card.mjs
 * Creates a Kaiten card under a board and outputs it as JSON.
 * Usage:
 *   node create-card.mjs <boardId> <cardName> [outputFile]
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for the API.
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const resp = await fetch('https://unpkg.com/use-m/use.js');
const script = await resp.text();
const { makeUse } = eval(script);
const use = await makeUse({ meta: import.meta, scriptPath: import.meta.url });

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;

/**
 * Create a Kaiten card under a given board.
 * @param {object} options
 * @param {string} options.boardId - ID of the board to attach the card to.
 * @param {string} options.name - Name of the card.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created card object.
 */
export async function createCard({ boardId, name, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  if (!boardId) throw new Error('boardId is required');
  if (!name) throw new Error('name is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const url = `${apiBase}/cards`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await axios.post(url, { name, board_id: boardId }, { headers });
  return response.data;
}

// If run as CLI
const __filename = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === __filename) {
  const [, , boardId, name, outputFile] = process.argv;
  if (!boardId || !name) {
    console.error('Usage: create-card.mjs <boardId> <cardName> [outputFile]');
    process.exit(1);
  }
  try {
    const card = await createCard({ boardId, name });
    const output = JSON.stringify(card, null, 2);
    if (outputFile) {
      await writeFile(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
} 