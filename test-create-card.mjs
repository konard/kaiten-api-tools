#!/usr/bin/env node
/**
 * test-create-card.mjs
 * E2E tests for createSpace, createBoard, and createCard functions and CLIs.
 * Usage: node test-create-card.mjs
 * Environment Variables:
 *   KAITEN_API_TOKEN - API token for authentication.
 *   KAITEN_API_BASE_URL - Base URL for API.
 */
import { createSpace } from './create-space.mjs';
import { createBoard } from './create-board.mjs';
import { createCard } from './create-card.mjs';
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
// Enable debug tracing from create-*.mjs modules
process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',kaiten:*' : 'kaiten:*';
console.log('Debugging enabled for tests:', process.env.DEBUG);

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

let space;
let board;
let card;
let cliCard;
let spaceName;
let boardName;
let cardName;

// Setup test data
test.before(async () => {
  const timestamp = Date.now();
  spaceName = `test-space-${timestamp}`;
  boardName = `test-board-${timestamp}`;
  cardName = `test-card-${timestamp}`;
  space = await createSpace({ name: spaceName, token, apiBase });
  board = await createBoard({ spaceId: space.id, name: boardName, token, apiBase });
  console.log('Setup complete: space.id=', space.id, 'board.id=', board.id);
});

// Note: space and board are created in before hook
// Test card creation (function)
test('function export: createCard returns a card with id and correct name', async () => {
  console.log('Function test: calling createCard with boardId=', board.id, ', name=', cardName);
  card = await createCard({ boardId: board.id, name: cardName, token, apiBase });
  console.log('Function test: createCard returned', card);
  is(typeof card.id, 'number');
  is(card.name, cardName);
});

// Test CLI for card
test('CLI: create-card CLI outputs matching JSON', async () => {
  console.log('CLI test: invoking create-card CLI with boardId=', board.id, ' name=', cardName);
  const { stdout } = await execAsync(
    `node ${path.resolve(__dirname, 'create-card.mjs')} ${board.id} ${cardName}`
  );
  console.log('CLI test: stdout from create-card CLI:', stdout);
  cliCard = JSON.parse(stdout);
  console.log('CLI test: parsed CLI output:', cliCard);
  is(typeof cliCard.id, 'number');
  is(cliCard.name, cardName);
});

// Cleanup resources after tests
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Delete card
  if (cliCard?.id) {
    await axios.delete(`${apiBase}/cards/${cliCard.id}`, { headers });
  }
  if (card?.id) {
    await axios.delete(`${apiBase}/cards/${card.id}`, { headers });
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