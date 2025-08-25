#!/usr/bin/env node
/**
 * create-column.mjs
 * Creates a Kaiten column under a board and outputs it as JSON.
 * Usage:
 *   node create-column.mjs <boardId> <columnTitle> [outputFile]
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for the API.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load Node.js built-in modules
const { writeFile } = await use('node:fs/promises');
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Import debug for tracing via use-m
const debugModule = await use('debug@4.3.4');
const debug = debugModule.default || debugModule;
const log = debug('kaiten:create-column');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

/**
 * Create a Kaiten column under a given board.
 * @param {object} options
 * @param {string} options.boardId - ID of the board.
 * @param {string} options.title - Title of the column.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created column object.
 */
export async function createColumn({ boardId, title, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  log('createColumn called with boardId=%s, title=%s, apiBase=%s', boardId, title, apiBase);
  if (!boardId) throw new Error('boardId is required');
  if (!title) throw new Error('title is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const url = `${apiBase.replace(/\/v1$/, '/latest')}/boards/${boardId}/columns`;
  log('Sending POST request to %s with payload %O', url, { title });
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const response = await axios.post(url, { title }, { headers });
    log('Received response: %O', response.data);
    return response.data;
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
  const [, , boardId, title, outputFile] = process.argv;
  log('CLI invoked with boardId=%s, title=%s, outputFile=%s', boardId, title, outputFile);
  if (!boardId || !title) {
    console.error('Usage: create-column.mjs <boardId> <columnTitle> [outputFile]');
    process.exit(1);
  }
  try {
    const column = await createColumn({ boardId, title });
    const output = JSON.stringify(column, null, 2);
    if (outputFile) {
      await writeFile(outputFile, output, 'utf-8');
    } else {
      console.log(output);
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