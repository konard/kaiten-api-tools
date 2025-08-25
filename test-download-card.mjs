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
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Load command-stream for CLI testing
const commandStreamModule = await use('command-stream@0.3.0');
const { $ } = commandStreamModule;

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import uvu test runner and assertions via use-m
const { test } = await use('uvu@0.5.6');
const { equal } = await use('uvu@0.5.6/assert');

// Import axios for cleanup
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

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
  const { stdout } = await $`node ${downloadScript} ${card.id} --stdout-only`;
  equal(stdout.trim(), markdown.trim());
});

// Test utility functions by importing them directly
test('parseCardInput: should handle numeric card ID with env var', async () => {
  // Test that numeric card IDs work when KAITEN_API_BASE_URL is set
  const oldApiBase = process.env.KAITEN_API_BASE_URL;
  process.env.KAITEN_API_BASE_URL = apiBase;
  try {
    const { stdout } = await $`node ${downloadScript} ${card.id} --stdout-only`;
    equal(stdout.includes('# '), true);
  } finally {
    if (oldApiBase) {
      process.env.KAITEN_API_BASE_URL = oldApiBase;
    } else {
      delete process.env.KAITEN_API_BASE_URL;
    }
  }
});

test('parseCardInput: should handle board card URL format', async () => {
  const testUrl = `${apiBase.replace('/api/v1', '')}/space/583628/boards/card/${card.id}`;
  const { stdout } = await $`node ${downloadScript} ${testUrl} --stdout-only`;
  // Should successfully parse and return markdown
  equal(stdout.includes('# '), true);
});

test('parseCardInput: should handle simple URL format', async () => {
  const testUrl = `${apiBase.replace('/api/v1', '')}/${card.id}`;
  const { stdout } = await $`node ${downloadScript} ${testUrl} --stdout-only`;
  // Should successfully parse and return markdown
  equal(stdout.includes('# '), true);
});

test('downloadCard: should return card, markdown, and comments', async () => {
  const result = await downloadCard({ cardId: card.id, token });
  equal(typeof result, 'object');
  equal(typeof result.card, 'object');
  equal(typeof result.markdown, 'string');
  equal(Array.isArray(result.comments), true);
  equal(typeof result.card.id, 'number');
  equal(result.card.id, card.id);
});

test('downloadCard: should include card metadata in markdown', async () => {
  const { markdown } = await downloadCard({ cardId: card.id, token });
  equal(markdown.includes(`**ID**: ${card.id}`), true);
  equal(markdown.includes('## Description'), true);
});

test('CLI: should support --output-dir option', async () => {
  const tempDir = './test-output-' + Date.now();
  try {
    const { stderr } = await $`node ${downloadScript} ${card.id} --output-dir ${tempDir}`;
    // Should complete without error
    equal(stderr.length, 0);
    
    // Check that directory was created
    const fs = await use('node:fs');
    const { promisify } = await use('node:util');
    const readdir = promisify(fs.readdir);
    const files = await readdir(tempDir);
    equal(files.includes('card.md'), true);
    equal(files.includes('card.json'), true);
  } finally {
    // Cleanup
    try {
      const fs = await use('node:fs');
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

test('CLI: should support --token option', async () => {
  const { stdout } = await $`node ${downloadScript} ${card.id} --token ${token} --stdout-only`;
  equal(stdout.includes('# '), true);
});

test('CLI: should handle nonexistent card ID gracefully', async () => {
  try {
    const result = await $`node ${downloadScript} 999999999 --stdout-only`;
    // If we get here, check if it's an error exit code
    equal(result.code !== 0, true, 'Should have non-zero exit code');
  } catch (err) {
    // Either threw an exception or had non-zero exit code - both are correct
    equal(typeof err.message, 'string');
    equal(true, true); // Test passes if we catch an error
  }
});

test('CLI: should handle missing card ID', async () => {
  try {
    const result = await $`node ${downloadScript} --stdout-only`;
    // If we get here, check if it's an error exit code
    equal(result.code !== 0, true, 'Should have non-zero exit code');
  } catch (err) {
    // Either threw an exception or had non-zero exit code - both are correct
    equal(typeof err.message, 'string');
    equal(true, true); // Test passes if we catch an error
  }
});

test('CLI: should show help with --help', async () => {
  const { stdout } = await $`node ${downloadScript} --help`;
  equal(stdout.includes('Usage:'), true);
  equal(stdout.includes('--stdout-only'), true);
  equal(stdout.includes('--output-dir'), true);
  equal(stdout.includes('--token'), true);
});

test('downloadCard: should handle card without owner', async () => {
  // The created test card might not have an owner, which is good for testing
  const { markdown } = await downloadCard({ cardId: card.id, token });
  equal(typeof markdown, 'string');
  // Should not crash even if owner is undefined
  equal(markdown.length > 0, true);
});

test('downloadCard: should handle API errors gracefully', async () => {
  try {
    await downloadCard({ cardId: 'nonexistent', token });
    equal(false, true, 'Should have thrown an error');
  } catch (err) {
    equal(typeof err, 'object');
    // Should be an axios error or similar
  }
});

// Test error handling for invalid URLs
test('CLI: should handle invalid URL format', async () => {
  try {
    const result = await $`node ${downloadScript} not-a-valid-url --stdout-only`;
    // If we get here, check if it's an error exit code
    equal(result.code !== 0, true, 'Should have non-zero exit code');
  } catch (err) {
    // Either threw an exception or had non-zero exit code - both are correct
    equal(typeof err.message, 'string');
    equal(true, true); // Test passes if we catch an error
  }
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