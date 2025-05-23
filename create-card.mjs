#!/usr/bin/env node
/**
 * create-card.mjs
 * Creates a Kaiten card under a board and outputs it as JSON.
 * Usage:
 *   node create-card.mjs <spaceId> <boardId> <cardName> [outputFile]
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for the API.
 */
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;

/**
 * Create a Kaiten card under a given board.
 * @param {object} options
 * @param {string} options.spaceId - ID of the space to attach the card to.
 * @param {string} options.boardId - ID of the board to attach the card to.
 * @param {string} options.name - Name of the card.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created card object.
 */
export async function createCard({ spaceId, boardId, name, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  if (!spaceId) throw new Error('spaceId is required');
  if (!boardId) throw new Error('boardId is required');
  if (!name) throw new Error('name is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Retrieve board metadata (columns, lanes)
  const boardsResp = await axios.get(
    `${apiBase}/spaces/${spaceId}/boards`,
    { headers }
  );
  const boardObj = boardsResp.data.find(b => String(b.id) === String(boardId));
  if (!boardObj) throw new Error('Board not found in space');
  const columnId = boardObj.columns?.[0]?.id;
  const laneId = boardObj.lanes?.[0]?.id;
  if (!columnId || !laneId) {
    throw new Error('Board metadata missing columns or lanes');
  }
  // Create the card under the specified space and board
  const url = `${apiBase}/spaces/${spaceId}/boards/${boardId}/cards`;
  const response = await axios.post(
    url,
    { title: name, column_id: columnId, lane_id: laneId },
    { headers }
  );
  // Map the API's title field to name for test consistency
  return { ...response.data, name: response.data.title };
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const [, , spaceId, boardId, name, outputFile] = process.argv;
  if (!spaceId || !boardId || !name) {
    console.error('Usage: create-card.mjs <spaceId> <boardId> <cardName> [outputFile]');
    process.exit(1);
  }
  try {
    const card = await createCard({ spaceId, boardId, name });
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