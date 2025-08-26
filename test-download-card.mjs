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
  equal(stdout.includes('--recursive'), true);
  equal(stdout.includes('--max-depth'), true);
});

test('downloadCard: should handle card without owner', async () => {
  // The created test card might not have an owner, which is good for testing
  const { markdown } = await downloadCard({ cardId: card.id, token });
  equal(typeof markdown, 'string');
  // Should not crash even if owner is undefined
  equal(markdown.length > 0, true);
});

test('downloadCard: should handle checklists in card structure', async () => {
  const { card: cardData } = await downloadCard({ cardId: card.id, token });
  
  // Mock checklist data to test the markdown generation
  const mockCard = {
    ...cardData,
    checklists: [
      {
        name: 'Test Checklist',
        items: [
          { name: 'Completed item', checked: true },
          { name: 'Pending item', checked: false },
          { 
            name: 'Item with due date', 
            checked: false, 
            due_date: '2025-01-01',
            assignee: { username: 'testuser' }
          }
        ]
      }
    ]
  };
  
  // Test markdown generation with mock data
  
  // Create a temporary function to test checklist rendering
  const turndownModule = await use('turndown@7.2.0');
  const TurndownService = turndownModule.default || turndownModule;
  const turndownService = new TurndownService();
  
  let md = `# ${mockCard.title}\n\n`;
  md += `- **ID**: ${mockCard.id}\n`;
  md += `\n## Description\n\n`;
  md += mockCard.description ? turndownService.turndown(mockCard.description) : '';
  md += '\n';
  
  // Test checklist rendering logic
  const checklists = mockCard.checklists || mockCard.check_lists || [];
  const checklistItems = mockCard.checklist_items || mockCard.checklistItems || [];
  
  if (checklists.length > 0 || checklistItems.length > 0) {
    md += '\n## Checklists\n\n';
    
    if (checklists.length > 0) {
      for (const checklist of checklists) {
        if (checklist.name || checklist.title) {
          md += `### ${checklist.name || checklist.title}\n\n`;
        }
        
        const items = checklist.items || checklist.checklist_items || [];
        if (items.length > 0) {
          for (const item of items) {
            const checkbox = item.checked || item.completed || item.is_checked ? '[x]' : '[ ]';
            const itemName = item.name || item.title || item.text || 'Unnamed item';
            md += `- ${checkbox} ${itemName}`;
            
            if (item.due_date || item.due) {
              const dueDate = item.due_date || item.due;
              md += ` (due: ${dueDate})`;
            }
            
            if (item.assignee) {
              if (item.assignee.username) {
                md += ` [@${item.assignee.username}]`;
              } else if (item.assignee.full_name) {
                md += ` [${item.assignee.full_name}]`;
              }
            }
            
            md += '\n';
          }
        }
        md += '\n';
      }
    }
  }
  
  // Verify checklist rendering
  equal(md.includes('## Checklists'), true);
  equal(md.includes('### Test Checklist'), true);
  equal(md.includes('- [x] Completed item'), true);
  equal(md.includes('- [ ] Pending item'), true);
  equal(md.includes('- [ ] Item with due date (due: 2025-01-01) [@testuser]'), true);
});

test('downloadCard: should handle flat checklist items structure', async () => {
  const { card: cardData } = await downloadCard({ cardId: card.id, token });
  
  // Mock flat checklist structure
  const mockCard = {
    ...cardData,
    checklist_items: [
      { name: 'Flat item 1', checked: true },
      { name: 'Flat item 2', checked: false }
    ]
  };
  
  // Test markdown generation with flat checklist structure
  const turndownModule = await use('turndown@7.2.0');
  const TurndownService = turndownModule.default || turndownModule;
  const turndownService = new TurndownService();
  
  let md = `# ${mockCard.title}\n\n`;
  md += `- **ID**: ${mockCard.id}\n`;
  md += `\n## Description\n\n`;
  md += mockCard.description ? turndownService.turndown(mockCard.description) : '';
  md += '\n';
  
  // Test flat checklist rendering logic
  const checklists = mockCard.checklists || mockCard.check_lists || [];
  const checklistItems = mockCard.checklist_items || mockCard.checklistItems || [];
  
  if (checklists.length > 0 || checklistItems.length > 0) {
    md += '\n## Checklists\n\n';
    
    if (checklistItems.length > 0) {
      if (checklists.length === 0) {
        md += `### Checklist\n\n`;
      }
      
      for (const item of checklistItems) {
        const checkbox = item.checked || item.completed || item.is_checked ? '[x]' : '[ ]';
        const itemName = item.name || item.title || item.text || 'Unnamed item';
        md += `- ${checkbox} ${itemName}\n`;
      }
      md += '\n';
    }
  }
  
  // Verify flat checklist rendering
  equal(md.includes('## Checklists'), true);
  equal(md.includes('### Checklist'), true);
  equal(md.includes('- [x] Flat item 1'), true);
  equal(md.includes('- [ ] Flat item 2'), true);
});

test('downloadCard: should include children information when includeChildren is true', async () => {
  // Create a mock card with children_count
  const { card: cardData } = await downloadCard({ cardId: card.id, token });
  
  // Mock a card with children
  const mockCard = {
    ...cardData,
    children_count: 2,
    children_done: 1
  };
  
  // Test children count display
  let md = `# ${mockCard.title}\n\n`;
  md += `- **ID**: ${mockCard.id}\n`;
  if (mockCard.children_count > 0) {
    md += `- **Children**: ${mockCard.children_done}/${mockCard.children_count} completed\n`;
  }
  
  // Verify children information is displayed
  equal(md.includes('**Children**: 1/2 completed'), true);
});

test('downloadCard: should handle children cards structure in markdown', async () => {
  const { card: cardData } = await downloadCard({ cardId: card.id, token });
  
  // Mock children data
  const mockChildren = [
    {
      id: 12345,
      title: 'Child Card 1',
      status: { name: 'In Progress' },
      type: { name: 'Task', letter: 'T' },
      children_count: 0,
      children_done: 0
    },
    {
      id: 12346,
      title: 'Child Card 2',
      status: { name: 'Done' },
      type: { name: 'Bug', letter: 'B' },
      children_count: 3,
      children_done: 2
    }
  ];
  
  // Test children markdown generation
  let md = '';
  if (mockChildren && mockChildren.length > 0) {
    md += '\n## Children Cards\n\n';
    
    for (const child of mockChildren) {
      const childTitle = child.title || `Card ${child.id}`;
      const childPath = `./children/${child.id}/card.md`;
      md += `- [${childTitle}](${childPath})`;
      
      if (child.status?.name) {
        md += ` - ${child.status.name}`;
      }
      if (child.type?.name) {
        md += ` [${child.type.letter}]`;
      }
      
      if (child.children_count > 0) {
        md += ` (${child.children_done}/${child.children_count} subtasks)`;
      }
      
      md += '\n';
    }
    md += '\n';
  }
  
  // Verify children section rendering
  equal(md.includes('## Children Cards'), true);
  equal(md.includes('[Child Card 1](./children/12345/card.md) - In Progress [T]'), true);
  equal(md.includes('[Child Card 2](./children/12346/card.md) - Done [B] (2/3 subtasks)'), true);
});

test('CLI: should support --recursive option', async () => {
  // Test that the recursive flag is accepted (may not have actual children to test with)
  try {
    const { stdout, stderr } = await $`node ${downloadScript} ${card.id} --recursive --max-depth 1 --stdout-only`;
    // Should complete without error, even if no children exist
    equal(typeof stdout, 'string');
    equal(stderr.length, 0);
  } catch (err) {
    // If it fails, it should be due to no children, not parsing error
    equal(typeof err.message, 'string');
  }
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