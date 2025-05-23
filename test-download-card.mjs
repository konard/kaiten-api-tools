#!/usr/bin/env node
/**
 * test-download-card.mjs
 * E2E tests for downloadCard.mjs using both function export and CLI.
 * Usage: node test-download-card.mjs
 * Environment Variables:
 *   DEFAULT_CARD_ID - Kaiten card ID to test.
 *   KAITEN_API_TOKEN - API token for Kaiten.
 */
import { downloadCardToMarkdown } from './download-card.mjs';
import { createSpace } from './create-space.mjs';
import { createBoard } from './create-board.mjs';
import { createCard } from './create-card.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const resp = await fetch('https://unpkg.com/use-m/use.js');
const script = await resp.text();
const { makeUse } = eval(script);
// Create use() bound to this module's context
const use = await makeUse({ meta: import.meta, scriptPath: import.meta.url });

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import uvu test runner and assertions via use-m
const { test } = await use('uvu@0.5.6');
const { equal } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.5.0');
const axios = axiosModule.default || axiosModule;

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment variables
const token = process.env.KAITEN_API_TOKEN;
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const apiBase = process.env.KAITEN_API_BASE_URL;
if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');

// Variables to hold test resources
let space, board, card, downloadScript;

// Setup resources before tests
test.before(async () => {
  // Create Kaiten space, board, and card for testing
  space = await createSpace({ name: `test-space-${Date.now()}`, token, apiBase });
  board = await createBoard({ spaceId: space.id, name: `test-board-${Date.now()}`, token, apiBase });
  card = await createCard({ boardId: board.id, name: `test-card-${Date.now()}`, token, apiBase });
  downloadScript = path.join(__dirname, 'download-card.mjs');
});

test('function export: should fetch and convert a card to markdown with a heading', async () => {
  const md = await downloadCardToMarkdown({ cardId: card.id, token });
  equal(md.startsWith('# '), true);
});

test('CLI: should match the function export output', async () => {
  const mdFunc = await downloadCardToMarkdown({ cardId: card.id, token });
  const { stdout } = await execAsync(`node ${downloadScript} ${card.id}`);
  equal(stdout.trim(), mdFunc.trim());
});

// Cleanup created Kaiten resources after all tests
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Delete card, board, and space in reverse creation order if they exist
  if (card && card.id) {
    await axios.delete(`${apiBase}/cards/${card.id}`, { headers });
  }
  if (board && board.id) {
    await axios.delete(`${apiBase}/boards/${board.id}`, { headers });
  }
  if (space && space.id) {
    await axios.delete(`${apiBase}/spaces/${space.id}`, { headers });
  }
});

test.run(); 