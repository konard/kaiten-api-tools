#!/usr/bin/env node
/**
 * create-board.mjs
 * Creates a Kaiten board under a space and outputs it as JSON.
 * Usage:
 *   node create-board.mjs <spaceId> <boardName> [outputFile]
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

// Import debug for tracing via use-m
const debugModule = await use('debug@4.3.4');
const debug = debugModule.default || debugModule;
const log = debug('kaiten:create-board');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

/**
 * Create a Kaiten board under a given space.
 * @param {object} options
 * @param {string} options.spaceId - ID of the space to attach the board to.
 * @param {string} options.name - Name of the board.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created board object.
 */
function serializeAxiosRequest(config) {
  return {
    method: config?.method,
    url: config?.url,
    headers: config?.headers && typeof config.headers === 'object' ? Object.fromEntries(Object.entries(config.headers).filter(([k]) => ['authorization', 'content-type'].includes(k.toLowerCase()))) : undefined,
    data: (() => {
      try {
        return config?.data ? JSON.parse(config.data) : undefined;
      } catch {
        return config?.data;
      }
    })()
  };
}

function serializeAxiosResponse(response) {
  return {
    status: response?.status,
    statusText: response?.statusText,
    data: response?.data
  };
}

export async function createBoard({ spaceId, name, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  log('createBoard called with spaceId=%s, name=%s, apiBase=%s', spaceId, name, apiBase);
  if (!spaceId) throw new Error('spaceId is required');
  if (!name) throw new Error('name is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const url = `${apiBase}/spaces/${spaceId}/boards`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    // Column type enum for Kaiten
    const COLUMN_TYPE = {
      QUEUE: 1, // queue
      IN_PROGRESS: 2, // in progress
      DONE: 3 // done
    };
    const payload = {
      title: name,
      columns: [{ title: 'Column 1', type: COLUMN_TYPE.QUEUE }],
      lanes: [{ title: 'Lane 1' }]
    };
    log('TRACE: About to POST board with payload:', JSON.stringify(payload, null, 2));
    log('TRACE: POST URL:', url);
    log('TRACE: Headers:', JSON.stringify(headers, null, 2));
    const response = await axios.post(url, payload, { headers });
    log('TRACE: Received response:', JSON.stringify(response.data, null, 2));
    // Only print request/response to stdout if not running as CLI
    if (process.env.KAITEN_TRACE === '1') {
      console.log('Request:', JSON.stringify(serializeAxiosRequest(response.config), null, 2));
      console.log('Response:', JSON.stringify(serializeAxiosResponse(response), null, 2));
    }
    return { ...response.data, name: response.data.title };
  } catch (err) {
    log('TRACE: Error occurred:', err.message);
    if (err.config) {
      log('TRACE: Request config:', JSON.stringify(serializeAxiosRequest(err.config), null, 2));
    }
    if (err.response) {
      log('TRACE: Error response:', JSON.stringify(serializeAxiosResponse(err.response), null, 2));
      if (typeof err.toJSON === 'function') {
        log('TRACE: AxiosError toJSON:', JSON.stringify(err.toJSON(), null, 2));
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
      console.error('Request:', JSON.stringify(serializeAxiosRequest(err.config), null, 2));
      console.error('Response:', JSON.stringify(serializeAxiosResponse(err.response), null, 2));
    } else if (err.config) {
      if (typeof err.toJSON === 'function') {
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
      console.error('Request:', JSON.stringify(serializeAxiosRequest(err.config), null, 2));
    } else {
      if (typeof err.toJSON === 'function') {
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
    }
    throw err;
  }
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const [, , spaceId, name, outputFile] = process.argv;
  log('CLI invoked with spaceId=%s, name=%s, outputFile=%s', spaceId, name, outputFile);
  if (!spaceId || !name) {
    console.error('Usage: create-board.mjs <spaceId> <boardName> [outputFile]');
    process.exit(1);
  }
  try {
    const board = await createBoard({ spaceId, name });
    const output = JSON.stringify(board, null, 2);
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