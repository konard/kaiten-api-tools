#!/usr/bin/env node
/**
 * test-download-card.mjs
 * E2E tests for downloadCard.mjs using both function export and CLI.
 * Usage: node test-download-card.mjs
 * Environment Variables:
 *   DEFAULT_CARD_ID - Kaiten card ID to test.
 *   KAITEN_API_TOKEN - API token for Kaiten.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load local modules
const { downloadCard } = await use('./download-card.mjs');
const { createSpace } = await use('./create-space.mjs');
const { createBoard } = await use('./create-board.mjs');
const { createCard } = await use('./create-card.mjs');

// Load Node.js built-in modules
const { exec } = await use('node:child_process');
const { promisify } = await use('node:util');
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import uvu test runner and assertions via use-m
const { test } = await use('uvu@0.5.6');
const { equal } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

const execAsync = promisify(exec);
const currentFilePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFilePath);

// Validate environment variables
const token = process.env.KAITEN_API_TOKEN;
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const apiBase = process.env.KAITEN_API_BASE_URL;
if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');

// Variables to hold test resources
let space, board, card, downloadScript;

// Setup resources before tests
let spaceName, boardName, cardName;
test.before(async () => {
  // Use timestamp for reproducibility
  const timestamp = Date.now();
  spaceName = `test-space-${timestamp}`;
  boardName = `test-board-${timestamp}`;
  cardName = `test-card-${timestamp}`;
  space = await createSpace({ name: spaceName, token, apiBase });
  board = await createBoard({ spaceId: space.id, name: boardName, token, apiBase });
  card = await createCard({ boardId: board.id, name: cardName, token, apiBase });
  downloadScript = path.join(__dirname, 'download-card.mjs');
  console.log('Setup complete: space.id=', space.id, 'board.id=', board.id, 'card.id=', card.id);
});

test('function export: should fetch and convert a card to markdown with a heading', async () => {
  const { markdown } = await downloadCard({ cardId: card.id, token });
  equal(markdown.startsWith('# '), true);
});

test('CLI: should match the function export output', async () => {
  const { markdown } = await downloadCard({ cardId: card.id, token });
  const { stdout } = await execAsync(`node ${downloadScript} ${card.id} --stdout-only`);
  equal(stdout.trim(), markdown.trim());
});

// Cleanup created Kaiten resources after all tests
test.after(async () => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  // Delete card, board, and space in reverse creation order if they exist
  if (card && card.id) {
    try {
      await axios.delete(`${apiBase}/cards/${card.id}`, { headers });
    } catch (err) {
      if (typeof err.toJSON === 'function') {
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
    }
  }
  if (board && board.id) {
    try {
      await axios.delete(
        `${apiBase}/spaces/${space.id}/boards/${board.id}`,
        { headers, data: { force: true } }
      );
    } catch (err) {
      if (typeof err.toJSON === 'function') {
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
    }
  }
  if (space && space.id) {
    try {
      await axios.delete(`${apiBase}/spaces/${space.id}`, { headers });
    } catch (err) {
      if (typeof err.toJSON === 'function') {
        console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
      } else {
        console.error('Error:', err.message);
      }
    }
  }
});

test.run();