#!/usr/bin/env node
/**
 * download-card.mjs
 * Fetches a Kaiten card by ID and outputs it as Markdown and JSON.
 * Usage:
 *   node download-card.mjs <cardId|url> [options]
 *   Examples:
 *     node download-card.mjs 123456
 *     node download-card.mjs https://company.kaiten.ru/123456
 *     node download-card.mjs 123456 --output-dir ./custom/path
 * Environment Variables:
 *   KAITEN_API_TOKEN - Bearer token for authentication.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Load Node.js built-in modules
const { writeFile, mkdir } = await import('node:fs/promises');
const { createWriteStream } = await use('node:fs');
const { fileURLToPath } = await use('node:url');
const pathModule = await use('node:path');
const path = pathModule.default || pathModule;

// Import debug for tracing via use-m
const debugModule = await use('debug@4.3.4');
const debug = debugModule.default || debugModule;
const log = debug('kaiten:download-card');

// Load environment variables from .env
const { config } = await use('dotenv@16.1.4');
config({ path: path.resolve(process.cwd(), '.env') });

// Import axios and turndown correctly
const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;
const turndownModule = await use('turndown@7.2.0');
const TurndownService = turndownModule.default || turndownModule;

// Import yargs for CLI argument parsing
const yargsModule = await use('yargs@17.7.2');
const yargs = yargsModule.default || yargsModule;

/**
 * Download a file from URL to a local path.
 * @param {string} url - The file URL.
 * @param {string} filePath - The local file path.
 * @param {object} headers - Request headers.
 */
async function downloadFile(url, filePath, headers = {}) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    headers: headers
  });
  
  const writer = createWriteStream(filePath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Parse card input (ID or URL) and extract card ID and base API URL.
 * @param {string} input - Card ID or full Kaiten URL.
 * @returns {{cardId: string, apiBase: string}} - Extracted card ID and API base URL.
 */
function parseCardInput(input) {
  // If input is just a number/ID, use environment variable for base URL
  if (/^\d+$/.test(input.trim())) {
    const apiBase = process.env.KAITEN_API_BASE_URL;
    if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL for card ID input');
    return { cardId: input.trim(), apiBase };
  }
  
  // Parse URL format
  try {
    const url = new URL(input);
    let cardId;
    
    // Handle board card URL format: https://hq.kaiten.ru/space/583628/boards/card/54133274
    if (url.pathname.includes('/boards/card/')) {
      const pathParts = url.pathname.split('/');
      const cardIndex = pathParts.findIndex(part => part === 'card');
      if (cardIndex !== -1 && cardIndex + 1 < pathParts.length) {
        cardId = pathParts[cardIndex + 1];
      }
    } else {
      // Handle simple URL format: https://domain.com/cardId
      cardId = url.pathname.replace('/', '').trim();
    }
    
    if (!cardId || !/^\d+$/.test(cardId)) {
      throw new Error(`Invalid card ID extracted from URL: ${cardId}`);
    }
    
    const apiBase = `${url.protocol}//${url.host}/api/v1`;
    return { cardId, apiBase };
  } catch (err) {
    throw new Error(`Invalid URL format: ${input}. Expected format: https://company.kaiten.ru/123456, https://company.kaiten.ru/space/xxx/boards/card/123456, or just card ID`);
  }
}

/**
 * Fetch comments for a Kaiten card.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} options.apiBase - Base URL.
 * @returns {Promise<Array>} - Array of comments.
 */
async function fetchCardComments({ cardId, token, apiBase }) {
  log('fetchCardComments called with cardId=%s, apiBase=%s', cardId, apiBase);
  const url = `${apiBase}/cards/${cardId}/comments`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  try {
    const response = await axios.get(url, { headers });
    log('Received %d comments', response.data.length);
    return response.data;
  } catch (err) {
    log('Failed to fetch comments: %O', err);
    return [];
  }
}

/**
 * Fetch children cards for a Kaiten card.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} options.apiBase - Base URL.
 * @returns {Promise<Array>} - Array of children cards.
 */
async function fetchCardChildren({ cardId, token, apiBase }) {
  log('fetchCardChildren called with cardId=%s, apiBase=%s', cardId, apiBase);
  const url = `${apiBase}/cards/${cardId}/children`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  try {
    const response = await axios.get(url, { headers });
    log('Received %d children cards', response.data.length);
    return response.data;
  } catch (err) {
    log('Failed to fetch children cards: %O', err);
    return [];
  }
}

/**
 * Download Kaiten card data and convert to Markdown.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} [options.apiBase='https://developers.kaiten.ru/v1'] - Base URL.
 * @param {boolean} [options.includeChildren=false] - Whether to include children cards.
 * @returns {Promise<{card: object, markdown: string, comments: Array, children: Array}>} - Card data, markdown representation, comments, and children data.
 */
export async function downloadCard({ cardId, token = process.env.KAITEN_API_TOKEN, apiBase = process.env.KAITEN_API_BASE_URL, includeChildren = false }) {
  log('downloadCardToMarkdown called with cardId=%s, apiBase=%s', cardId, apiBase);
  if (!cardId) throw new Error('cardId is required');
  if (!apiBase) throw new Error('Set environment variable KAITEN_API_BASE_URL');
  const url = `${apiBase}/cards/${cardId}`;
  log('Fetching card at %s', url);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const response = await axios.get(url, { headers });
    log('Received card data: %O', response.data);
    const card = response.data;
    
    // Fetch comments
    const comments = await fetchCardComments({ cardId, token, apiBase });
    
    // Fetch children cards if requested
    let childrenData = [];
    if (includeChildren && (card.children_count > 0)) {
      const children = await fetchCardChildren({ cardId, token, apiBase });
      childrenData = children;
      log('Found %d children for card %s', children.length, cardId);
    }
    
    const turndownService = new TurndownService();

    let md = `# ${card.title}\n\n`;
    md += `- **ID**: ${card.id}\n`;
    if (card.owner) {
      let ownerInfo = '';
      if (card.owner.username) ownerInfo += `@${card.owner.username}`;
      if (card.owner.full_name) {
        if (ownerInfo) ownerInfo += ' ';
        ownerInfo += `(${card.owner.full_name})`;
      }
      if (card.owner.email) {
        if (ownerInfo) ownerInfo += ' ';
        ownerInfo += `<${card.owner.email}>`;
      }
      md += `- **Owner**: ${ownerInfo}\n`;
    }
    
    // Build location string
    if (card.board && card.board.spaces && card.column && card.lane) {
      const spaces = card.board.spaces.filter(s => s.primary_path).map(s => s.title);
      const boardTitle = card.board.title;
      const columnTitle = card.column.title;
      const laneTitle = card.lane.title;
      
      let location = spaces.join(' / ');
      if (location) location += ' / ';
      location += `${boardTitle} / ${columnTitle} (${laneTitle})`;
      
      md += `- **Location**: ${location}\n`;
    }
    
    if (card.type) {
      md += `- **Type**: [${card.type.letter}] ${card.type.name}\n`;
    }
    
    if (card.status?.name) md += `- **Status**: ${card.status.name}\n`;
    if (card.estimate != null) md += `- **Estimate**: ${card.estimate}\n`;
    
    // Add children count information
    if (card.children_count > 0) {
      md += `- **Children**: ${card.children_done}/${card.children_count} completed\n`;
    }
    
    // Add members
    if (card.members && card.members.length > 0) {
      md += `- **Members**: `;
      const membersList = [];
      
      // Sort members: responsible (type 2) first, then others
      const sortedMembers = [...card.members].sort((a, b) => {
        if (a.type === 2 && b.type !== 2) return -1;
        if (a.type !== 2 && b.type === 2) return 1;
        return 0;
      });
      
      for (const member of sortedMembers) {
        let memberInfo = '';
        if (member.username) memberInfo += `@${member.username}`;
        if (member.full_name) {
          if (memberInfo) memberInfo += ' ';
          memberInfo += `(${member.full_name})`;
        }
        if (member.email) {
          if (memberInfo) memberInfo += ' ';
          memberInfo += `<${member.email}>`;
        }
        
        // Mark responsible members
        if (member.type === 2) {
          memberInfo += ' (responsible)';
        }
        
        membersList.push(memberInfo);
      }
      
      md += membersList.join(', ') + '\n';
    }
    
    md += `\n## Description\n\n`;
    md += card.description ? turndownService.turndown(card.description) : '';
    log('Converted description to Markdown');
    md += '\n';
    
    // Add checklists section if any checklists exist
    // Support multiple possible structures: card.checklists, card.checklist_items, or card.check_lists
    const checklists = card.checklists || card.check_lists || [];
    const checklistItems = card.checklist_items || card.checklistItems || [];
    
    if (checklists.length > 0 || checklistItems.length > 0) {
      md += '\n## Checklists\n\n';
      
      // Handle structured checklists (with names and items)
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
              
              // Add due date if present
              if (item.due_date || item.due) {
                const dueDate = item.due_date || item.due;
                md += ` (due: ${dueDate})`;
              }
              
              // Add assignee if present
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
      
      // Handle flat checklist items (direct array of items without grouping)
      if (checklistItems.length > 0) {
        if (checklists.length === 0) {
          md += `### Checklist\n\n`;
        }
        
        for (const item of checklistItems) {
          const checkbox = item.checked || item.completed || item.is_checked ? '[x]' : '[ ]';
          const itemName = item.name || item.title || item.text || 'Unnamed item';
          md += `- ${checkbox} ${itemName}`;
          
          // Add due date if present
          if (item.due_date || item.due) {
            const dueDate = item.due_date || item.due;
            md += ` (due: ${dueDate})`;
          }
          
          // Add assignee if present
          if (item.assignee) {
            if (item.assignee.username) {
              md += ` [@${item.assignee.username}]`;
            } else if (item.assignee.full_name) {
              md += ` [${item.assignee.full_name}]`;
            }
          }
          
          md += '\n';
        }
        md += '\n';
      }
    }
    
    // Add comments section if any comments exist
    if (comments && comments.length > 0) {
      md += '\n## Comments\n\n';
      
      // Sort comments by created date (newest first)
      const sortedComments = [...comments].sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );
      
      for (const comment of sortedComments) {
        const author = comment.author?.full_name || comment.author?.username || 'Unknown';
        const date = new Date(comment.created).toLocaleString();
        md += `### By ${author} at ${date}\n\n`;
        md += comment.text ? turndownService.turndown(comment.text) : '';
        md += '\n\n';
      }
    }
    
    // Add files section if any files exist
    if (card.files && card.files.length > 0) {
      md += '## Files\n\n';
      for (const file of card.files) {
        const fileName = file.name || `file_${file.id}`;
        const isImage = /\.(png|jpg|jpeg|gif|bmp|svg)$/i.test(fileName);
        
        md += `### ${fileName}\n\n`;
        md += `- **Source URL**: ${file.url}\n`;
        md += `- **Size**: ${file.size} bytes\n`;
        if (file.created) md += `- **Created**: ${file.created}\n`;
        
        if (isImage) {
          md += `\n<img src="./files/${fileName}" alt="${fileName}" />\n`;
        } else {
          md += `\n[${fileName}](./files/${fileName})\n`;
        }
        md += '\n';
      }
    }
    
    // Add children section if any children exist
    if (childrenData && childrenData.length > 0) {
      md += '\n## Children Cards\n\n';
      
      for (const child of childrenData) {
        const childTitle = child.title || `Card ${child.id}`;
        const childPath = `./children/${child.id}/card.md`;
        md += `- [${childTitle}](${childPath})`;
        
        // Add status and type if available
        if (child.status?.name) {
          md += ` - ${child.status.name}`;
        }
        if (child.type?.name) {
          md += ` [${child.type.letter}]`;
        }
        
        // Add completion indicator
        if (child.children_count > 0) {
          md += ` (${child.children_done}/${child.children_count} subtasks)`;
        }
        
        md += '\n';
      }
      md += '\n';
    }
    
    return { card, markdown: md, comments, children: childrenData };
  } catch (err) {
    if (typeof err.toJSON === 'function') {
      log('AxiosError toJSON:', JSON.stringify(err.toJSON(), null, 2));
      console.error('AxiosError:', JSON.stringify(err.toJSON(), null, 2));
    } else if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
    throw err;
  }
}

/**
 * Recursively download a card and all its children.
 * @param {object} options
 * @param {string} options.cardId - The Kaiten card ID.
 * @param {string} options.token - API token.
 * @param {string} options.apiBase - Base URL.
 * @param {string} options.outputDir - Base output directory.
 * @param {number} [options.maxDepth=3] - Maximum recursion depth.
 * @param {number} [options.currentDepth=0] - Current recursion depth.
 * @returns {Promise<{card: object, children: Array}>} - Card data and all children data.
 */
async function downloadCardRecursive({ cardId, token, apiBase, outputDir, maxDepth = 3, currentDepth = 0 }) {
  log('downloadCardRecursive called with cardId=%s, depth=%d/%d', cardId, currentDepth, maxDepth);
  
  // Download the current card
  const { card, markdown, comments, children } = await downloadCard({ 
    cardId, 
    token, 
    apiBase, 
    includeChildren: true 
  });
  
  // Create directory structure for this card
  const cardDir = path.join(outputDir, cardId.toString());
  await mkdir(cardDir, { recursive: true });
  
  // Save card files
  const mdPath = path.join(cardDir, 'card.md');
  const jsonPath = path.join(cardDir, 'card.json');
  
  await writeFile(mdPath, markdown, 'utf-8');
  await writeFile(jsonPath, JSON.stringify(card, null, 2), 'utf-8');
  
  console.log(`  ✓ Card ${cardId}: ${card.title}`);
  
  // Save comments if they exist
  if (comments && comments.length > 0) {
    const commentsDir = path.join(cardDir, 'comments');
    await mkdir(commentsDir, { recursive: true });
    
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      const commentFileName = `comment_${i + 1}_${comment.id || 'unknown'}.json`;
      const commentPath = path.join(commentsDir, commentFileName);
      await writeFile(commentPath, JSON.stringify(comment, null, 2), 'utf-8');
    }
  }
  
  // Download all files
  if (card.files && card.files.length > 0) {
    const filesDir = path.join(cardDir, 'files');
    await mkdir(filesDir, { recursive: true });
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    for (const file of card.files) {
      const fileName = file.name || `file_${file.id}`;
      const filePath = path.join(filesDir, fileName);
      
      try {
        await downloadFile(file.url, filePath, headers);
        console.log(`    - Downloaded: ${fileName}`);
      } catch (err) {
        console.error(`    - Failed to download ${fileName}: ${err.message}`);
      }
    }
  }
  
  // Recursively download children if within depth limit
  const downloadedChildren = [];
  if (children && children.length > 0 && currentDepth < maxDepth) {
    const childrenDir = path.join(cardDir, 'children');
    await mkdir(childrenDir, { recursive: true });
    
    console.log(`    Downloading ${children.length} children...`);
    
    for (const child of children) {
      try {
        const childData = await downloadCardRecursive({
          cardId: child.id,
          token,
          apiBase,
          outputDir: childrenDir,
          maxDepth,
          currentDepth: currentDepth + 1
        });
        downloadedChildren.push(childData);
      } catch (err) {
        console.error(`    - Failed to download child card ${child.id}: ${err.message}`);
      }
    }
  } else if (children && children.length > 0) {
    console.log(`    Skipping ${children.length} children (max depth ${maxDepth} reached)`);
  }
  
  return { card, children: downloadedChildren };
}

/**
 * Extract subdomain from API base URL.
 * @param {string} apiBase - The API base URL.
 * @returns {string} - Subdomain name.
 */
function extractSubdomain(apiBase) {
  try {
    const url = new URL(apiBase);
    // Extract subdomain from hostname like 'company.kaiten.ru'
    const parts = url.hostname.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'kaiten') {
      return parts[0];
    }
    return url.hostname;
  } catch (err) {
    return 'unknown';
  }
}

// If run as CLI
const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = path.resolve(process.cwd(), process.argv[1] || '');
if (invokedPath === currentFilePath) {
  const argv = yargs(process.argv.slice(2))
    .usage('Usage: $0 <cardId|url> [options]')
    .positional('card', {
      describe: 'Card ID or full Kaiten URL',
      type: 'string',
      demandOption: true
    })
    .option('output-dir', {
      alias: 'o',
      describe: 'Output directory (default: ./data/<subdomain>/<card-id>/)',
      type: 'string'
    })
    .option('token', {
      alias: 't',
      describe: 'API token (defaults to KAITEN_API_TOKEN env var)',
      type: 'string',
      default: process.env.KAITEN_API_TOKEN
    })
    .option('stdout-only', {
      alias: 's',
      describe: 'Output only markdown to stdout (no files created)',
      type: 'boolean',
      default: false
    })
    .option('recursive', {
      alias: 'r',
      describe: 'Recursively download all children cards',
      type: 'boolean',
      default: false
    })
    .option('max-depth', {
      alias: 'd',
      describe: 'Maximum recursion depth for children cards (default: 3)',
      type: 'number',
      default: 3
    })
    .help()
    .alias('help', 'h')
    .argv;

  const cardInput = argv._[0];
  log('CLI invoked with cardInput=%s, outputDir=%s', cardInput, argv.outputDir);
  
  if (!cardInput) {
    console.error('Error: Card ID or URL is required');
    process.exit(1);
  }
  
  try {
    const { cardId, apiBase } = parseCardInput(String(cardInput));
    
    // If stdout-only mode, just output the markdown and exit
    if (argv.stdoutOnly) {
      const { card, markdown, comments } = await downloadCard({ 
        cardId, 
        token: argv.token, 
        apiBase, 
        includeChildren: argv.recursive 
      });
      console.log(markdown);
      process.exit(0);
    }
    
    // Determine output directory
    const subdomain = extractSubdomain(apiBase);
    const outputDir = argv.outputDir || path.join('./data', subdomain);
    
    // Use recursive download if requested
    if (argv.recursive) {
      console.log(`✓ Starting recursive download (max depth: ${argv.maxDepth})...`);
      await downloadCardRecursive({
        cardId,
        token: argv.token,
        apiBase,
        outputDir,
        maxDepth: argv.maxDepth
      });
      console.log(`✓ Recursive download completed!`);
      process.exit(0);
    }
    
    // Regular single card download
    const { card, markdown, comments } = await downloadCard({ cardId, token: argv.token, apiBase });
    
    // Use the single card output directory structure
    const cardOutputDir = argv.outputDir || path.join('./data', subdomain, cardId);
    
    // Create directory structure
    await mkdir(cardOutputDir, { recursive: true });
    const filesDir = path.join(cardOutputDir, 'files');
    if (card.files && card.files.length > 0) {
      await mkdir(filesDir, { recursive: true });
    }
    const commentsDir = path.join(cardOutputDir, 'comments');
    if (comments && comments.length > 0) {
      await mkdir(commentsDir, { recursive: true });
    }
    log('Created directory: %s', cardOutputDir);
    
    // Save both files
    const mdPath = path.join(cardOutputDir, 'card.md');
    const jsonPath = path.join(cardOutputDir, 'card.json');
    
    await writeFile(mdPath, markdown, 'utf-8');
    await writeFile(jsonPath, JSON.stringify(card, null, 2), 'utf-8');
    
    console.log(`✓ Card downloaded successfully:`);
    console.log(`  - Markdown: ./${mdPath}`);
    console.log(`  - JSON: ./${jsonPath}`);
    
    // Save comments as individual JSON files
    if (comments && comments.length > 0) {
      console.log(`\n✓ Saving ${comments.length} comment(s):`);
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const commentFileName = `comment_${i + 1}_${comment.id || 'unknown'}.json`;
        const commentPath = path.join(commentsDir, commentFileName);
        await writeFile(commentPath, JSON.stringify(comment, null, 2), 'utf-8');
        console.log(`  - Saved: ./${commentPath}`);
      }
    }
    
    // Download all files
    if (card.files && card.files.length > 0) {
      console.log(`\n✓ Downloading ${card.files.length} file(s):`);
      const headers = argv.token ? { Authorization: `Bearer ${argv.token}` } : {};
      
      for (const file of card.files) {
        const fileName = file.name || `file_${file.id}`;
        const filePath = path.join(filesDir, fileName);
        
        try {
          await downloadFile(file.url, filePath, headers);
          console.log(`  - Downloaded: ./data/${subdomain}/${cardId}/files/"${fileName}"`);
        } catch (err) {
          console.error(`  - Failed to download ${fileName}: ${err.message}`);
        }
      }
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