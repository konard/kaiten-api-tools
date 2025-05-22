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
 * Create a Kaiten space with given name.
 * @param {object} options
 * @param {string} options.name - Name of the space.
 * @param {string} [options.token] - API token.
 * @param {string} [options.apiBase] - Base URL.
 * @returns {Promise<object>} - Created space object.
 */
export async function createSpace({ name, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL || 'https://developers.kaiten.ru/v1' }) {
  if (!name) throw new Error('name is required');
  const url = `${apiBase}/spaces`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await axios.post(url, { name }, { headers });
  return response.data;
}

// If run as CLI
const __filename = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === __filename) {
  const [, , name, outputFile] = process.argv;
  if (!name) {
    console.error('Usage: create-space.mjs <spaceName> [outputFile]');
    process.exit(1);
  }
  try {
    const space = await createSpace({ name });
    const output = JSON.stringify(space, null, 2);
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