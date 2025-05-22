#!/usr/bin/env node
/**
 * testDownloadCard.mjs
 * E2E tests for downloadCard.mjs using both function export and CLI.
 * Usage: node testDownloadCard.mjs
 * Environment Variables:
 *   DEFAULT_CARD_ID - Kaiten card ID to test.
 *   KAITEN_API_TOKEN - API token for Kaiten.
 */
import { downloadCardToMarkdown } from './downloadCard.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import path from 'path';

// Dynamically load use-m
const resp = await fetch('https://unpkg.com/use-m/use.js');
const script = await resp.text();
const { use } = eval(script);

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import Jest globals for assertions
const { expect, describe, it } = await use('@jest/globals@29.6.0');

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment
const cardId = process.env.DEFAULT_CARD_ID;
const token = process.env.KAITEN_API_TOKEN;
if (!cardId) throw new Error('Set environment variable DEFAULT_CARD_ID');
if (!token) throw new Error('Set environment variable KAITEN_API_TOKEN');
const downloadScript = path.join(__dirname, 'downloadCard.mjs');

describe('downloadCardToMarkdown function', () => {
  it('should fetch and convert a card to markdown with a heading', async () => {
    const md = await downloadCardToMarkdown({ cardId, token });
    expect(md.startsWith('# ')).toBe(true);
  });
});

describe('downloadCard CLI', () => {
  it('should match the function export output', async () => {
    const mdFunc = await downloadCardToMarkdown({ cardId, token });
    const { stdout } = await execAsync(`node ${downloadScript} ${cardId}`);
    expect(stdout.trim()).toBe(mdFunc.trim());
  });
}); 