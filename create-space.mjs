#!/usr/bin/env node
/**
 * create-space.mjs
 * Creates a Kaiten space by name and outputs it as JSON.
 * Usage:
 *   node create-space.mjs <spaceName> [outputFile]
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
const log = debug('kaiten:create-space');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;

/**
 * Create a Kaiten space with given name.
 * @param {object} options
 * @param {string} options.name - Name of the space.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created space object.
 */
export async function createSpace({ name, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL }) {
  log('createSpace called with name=%s, apiBase=%s', name, apiBase);
  if (!name) {
    log('Error: name is required');
    throw new Error('name is required');
  }
  if (!apiBase) {
    log('Error: KAITEN_API_BASE_URL is required');
    throw new Error('Set environment variable KAITEN_API_BASE_URL');
  }
  const url = `${apiBase}/spaces`;
  log('Sending POST request to %s with payload %O', url, { title: name });
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const response = await axios.post(url, { title: name }, { headers });
    log('Received response: %O', response.data);
    return response.data;
  } catch (err) {
    log('API error response: %O', err.response?.data || err.message);
    throw err;
  }
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const [, , name, outputFile] = process.argv;
  if (!name) {
    console.error('Usage: create-space.mjs <spaceName> [outputFile]');
    process.exit(1);
  }
  try {
    log('CLI invoked with name=%s, outputFile=%s', name, outputFile);
    const space = await createSpace({ name });
    const output = JSON.stringify(space, null, 2);
    if (outputFile) {
      await writeFile(outputFile, output, 'utf-8');
    } else {
      console.log(output);
    }
  } catch (err) {
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
    console.error(err);
    process.exit(1);
  }
} 