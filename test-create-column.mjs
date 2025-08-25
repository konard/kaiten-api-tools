#!/usr/bin/env node
/**
 * test-create-column.mjs
 * E2E tests for createColumn function and CLI.
 * Usage: node test-create-column.mjs
 * Environment Variables:
 *   KAITEN_API_TOKEN - API token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for API.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load local modules
const { createSpace } = await use('./create-space.mjs');
const { createBoard } = await use('./create-board.mjs');
const { createColumn } = await use('./create-column.mjs');

// Load Node.js built-in modules
const { exec } = await use('node:child_process');
const { promisify } = await use('node:util');
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Enable debug tracing
process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',kaiten:*' : 'kaiten:*';

// Import test runner and assertions
const { test } = await use('uvu@0.5.6');
const { is } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

const execAsync = promisify(exec);
const currentFilePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFilePath);

const token = process.env.KAITEN_API_TOKEN;
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const apiBase = process.env.KAITEN_API_BASE_URL;
if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');

let space, board, column, cliColumn;
let spaceName, boardName, columnTitle;

// Setup: create space and board
test.before(async () => {
  const ts = Date.now();
  spaceName = `test-space-${ts}`;
  boardName = `test-board-${ts}`;
  columnTitle = `test-column-${ts}`;
  space = await createSpace({ name: spaceName, token, apiBase });
  board = await createBoard({ spaceId: space.id, name: boardName, token, apiBase });
  console.log('Setup complete: space.id=', space.id, 'board.id=', board.id);
});

// Test function export
test('function export: createColumn returns a column with id and correct title', async () => {
  console.log('Function test: calling createColumn with boardId=', board.id, 'title=', columnTitle);
  column = await createColumn({ boardId: board.id, title: columnTitle, token, apiBase });
  console.log('Function test: createColumn returned', column);
  is(typeof column.id, 'number');
  is(column.title, columnTitle);
});

// Test CLI
test('CLI: create-column CLI outputs matching JSON', async () => {
  console.log('CLI test: invoking create-column CLI with boardId=', board.id, 'title=', columnTitle);
  const { stdout } = await execAsync(
    `node ${path.resolve(__dirname, 'create-column.mjs')} ${board.id} ${columnTitle}`
  );
  console.log('CLI test: stdout =', stdout);
  cliColumn = JSON.parse(stdout);
  console.log('CLI test: parsed =', cliColumn);
  is(typeof cliColumn.id, 'number');
  is(cliColumn.title, columnTitle);
});

// Cleanup
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const base = apiBase.replace(/\/v1$/, '/latest');
  // Delete created column
  if (cliColumn?.id) {
    try {
      await axios.delete(`${base}/boards/${board.id}/columns/${cliColumn.id}`, { headers });
    } catch (e) {
      // ignore errors deleting last column
    }
  }
  if (column?.id) {
    try {
      await axios.delete(`${base}/boards/${board.id}/columns/${column.id}`, { headers });
    } catch (e) {
      // ignore errors deleting last column
    }
  }
  // Delete board and space
  if (board?.id) {
    await axios.delete(
      `${apiBase}/spaces/${space.id}/boards/${board.id}`,
      { headers, data: { force: true } }
    );
  }
  if (space?.id) {
    await axios.delete(`${apiBase}/spaces/${space.id}`, { headers });
  }
});

test.run();