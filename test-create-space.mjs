#!/usr/bin/env node
/**
 * test-create-space.mjs
 * E2E tests for createSpace function and CLI.
 * Usage: node test-create-space.mjs
 * Environment Variables:
 *   KAITEN_API_TOKEN - API token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for API (optional).
 */
import { createSpace } from './create-space.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import test runner and assertions
const { test } = await use('uvu@0.5.6');
const { is } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.KAITEN_API_TOKEN;
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const apiBase = process.env.KAITEN_API_BASE_URL;
if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');

let space;
let cliSpace;
let spaceName;

// Setup test data before tests
test.before(() => {
  spaceName = `test-space-${Date.now()}`;
});

// Test function export
test('function export: createSpace returns a space with id and correct title', async () => {
  space = await createSpace({ name: spaceName, token, apiBase });
  is(typeof space.id, 'number');
  is(space.title, spaceName);
});

// Test CLI
test('CLI: create-space CLI outputs matching JSON with debug tracing', async () => {
  const { stdout, stderr } = await execAsync(`DEBUG=kaiten:create-space node ${path.resolve(__dirname, 'create-space.mjs')} ${spaceName}`);
  // Optionally inspect stderr for debug logs
  cliSpace = JSON.parse(stdout);
  is(typeof cliSpace.id, 'number');
  is(cliSpace.title, spaceName);
});

// Cleanup resources after tests
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (cliSpace?.id) {
    await axios.delete(`${apiBase}/spaces/${cliSpace.id}`, { headers });
  }
  if (space?.id) {
    await axios.delete(`${apiBase}/spaces/${space.id}`, { headers });
  }
});

test.run(); 