#!/usr/bin/env node
/**
 * test-create-board.mjs
 * E2E tests for createBoard function and CLI.
 * Usage: node test-create-board.mjs
 * Environment Variables:
 *   KAITEN_API_TOKEN - API token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for API.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load local modules
const { createBoard } = await use('./create-board.mjs');
const { createSpace } = await use('./create-space.mjs');

// Load Node.js built-in modules
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Load command-stream for CLI testing
const commandStreamModule = await use('command-stream@0.3.0');
const { $ } = commandStreamModule;

// Load .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import test runner and assertions
const { test } = await use('uvu@0.5.6');
const { is } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

const currentFilePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFilePath);

const token = process.env.KAITEN_API_TOKEN;
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const apiBase = process.env.KAITEN_API_BASE_URL;
if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');

let space;
let board;
let cliBoard;
let spaceName;
let boardName;

// Setup test data before tests
test.before(() => {
  const timestamp = Date.now();
  spaceName = `test-space-${timestamp}`;
  boardName = `test-board-${timestamp}`;
});

// Test function export
test('function export: createBoard returns a board with id and correct name', async () => {
  space = await createSpace({ name: spaceName, token, apiBase });
  board = await createBoard({ spaceId: space.id, name: boardName, token, apiBase });
  is(typeof board.id, 'number');
  is(board.name, boardName);
});

// Test CLI
test('CLI: create-board CLI outputs matching JSON', async () => {
  const { stdout, stderr } = await $`node ${path.resolve(__dirname, 'create-board.mjs')} ${space.id} ${boardName}`;
  cliBoard = JSON.parse(stdout);
  is(typeof cliBoard.id, 'number');
  is(cliBoard.name, boardName);
});

// Cleanup resources after tests
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Delete boards via space-scoped endpoint with force
  if (cliBoard?.id) {
    await axios.delete(
      `${apiBase}/spaces/${space.id}/boards/${cliBoard.id}`,
      { headers, data: { force: true } }
    );
  }
  if (board?.id) {
    await axios.delete(
      `${apiBase}/spaces/${space.id}/boards/${board.id}`,
      { headers, data: { force: true } }
    );
  }
  // Finally delete the space
  if (space?.id) {
    await axios.delete(`${apiBase}/spaces/${space.id}`, { headers });
  }
});

test.run();