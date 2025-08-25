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
const log = debug('kaiten:create-space');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios
const axiosModule = await use('axios@1.9.0');
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
  let response;
  try {
    response = await axios.post(url, { title: name }, { headers });
  } catch (err) {
    log('Initial POST to %s failed: %O', url, err.response?.data || err.message);
    if (typeof err.toJSON === 'function') {
      log('AxiosError toJSON:', JSON.stringify(err.toJSON(), null, 2));
      console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
    } else if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
    // Fallback to /latest if apiBase ends with '/v1'
    if (apiBase.endsWith('/v1')) {
      const fallbackBase = apiBase.replace(/\/v1$/, '/latest');
      const fallbackUrl = `${fallbackBase}/spaces`;
      log('Retrying POST to %s', fallbackUrl);
      try {
        response = await axios.post(fallbackUrl, { title: name }, { headers });
      } catch (err2) {
        if (typeof err2.toJSON === 'function') {
          log('AxiosError toJSON:', JSON.stringify(err2.toJSON(), null, 2));
          console.error('AxiosError:', JSON.stringify(err2.toJSON(), null, 2));
        } else if (err2.response?.data) {
          console.error(JSON.stringify(err2.response.data, null, 2));
        } else {
          console.error(err2);
        }
        throw err2;
      }
    } else {
      throw err;
    }
  }
  log('Received response: %O', response.data);
  return response.data;
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