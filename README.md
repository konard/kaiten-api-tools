[![Open in Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-f29718?logo=gitpod)](https://gitpod.io/#https://github.com/konard/kaiten-api-tools)
[![Open in GitHub Codespaces](https://img.shields.io/badge/GitHub%20Codespaces-Open-181717?logo=github)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=konard/kaiten-api-tools)

# kaiten-api-tools

A collection of Node.js tools for working with the Kaiten API (https://developers.kaiten.ru). These tools help you download cards, create resources, and manage your Kaiten workspace programmatically.

## 🚀 Quick Start

```bash
# Set up environment (only token is required)
export KAITEN_API_TOKEN="your-api-token"

# Download a single card by URL (no additional setup needed)
node download-card.mjs "https://company.kaiten.ru/space/123/boards/card/12345" --stdout-only

# Download card with all children recursively
node download-card.mjs "https://company.kaiten.ru/12345" --recursive --output-dir ./cards
```

## 📥 download-card.mjs

The main tool for downloading Kaiten cards and converting them to Markdown format with comprehensive metadata, comments, files, checklists, and children cards.

### Features

- **📝 Markdown Export**: Converts cards to clean, readable Markdown
- **✅ Checklist Support**: Handles all checklist formats with completion status
- **📎 File Downloads**: Downloads attachments or keeps direct links
- **🌳 Recursive Children**: Downloads entire card hierarchies  
- **💬 Comments Export**: Includes all card comments with metadata
- **🔗 Smart URL Parsing**: Accepts card IDs, URLs, or board card URLs
- **📊 Rich Metadata**: Card status, type, assignee, dates, and more

### Usage

#### Basic Usage

```bash
# Download card by URL (recommended)
node download-card.mjs "https://company.kaiten.ru/space/123/boards/card/12345"

# Download card by ID (requires KAITEN_API_BASE_URL environment variable)
node download-card.mjs 12345

# Download with API token override
node download-card.mjs 12345 --token your-api-token

# Output to stdout instead of files
node download-card.mjs "https://company.kaiten.ru/12345" --stdout-only

# Specify output directory
node download-card.mjs 12345 --output-dir ./my-cards
```

#### URL Formats Supported

```bash
# Direct card ID
node download-card.mjs 12345

# Board card URL
node download-card.mjs "https://company.kaiten.ru/space/123/boards/card/12345"

# Simple URL format  
node download-card.mjs "https://company.kaiten.ru/12345"
```

#### Advanced Features

```bash
# Download card with all children (creates folder structure)
node download-card.mjs "https://company.kaiten.ru/12345" --recursive --max-depth 3

# Skip file downloads, keep direct Kaiten URLs
node download-card.mjs "https://company.kaiten.ru/12345" --skip-files-download

# Combine options
node download-card.mjs "https://company.kaiten.ru/12345" --recursive --skip-files-download --output-dir ./cards
```

### Output Structure

When downloading to files (without `--stdout-only`):

```
data/
└── <subdomain>/           # Kaiten instance subdomain (e.g., "company", "myorg")
    └── <card-id>/         # Card ID (e.g., "12345")
        ├── card.md        # Main card in Markdown format
        ├── card.json      # Raw JSON card data
        ├── comments/      # Individual comment files (sortable by creation date)
        │   ├── 2025-08-22-00-21-15-156.json
        │   ├── 2025-08-22-00-22-10-432.json
        │   └── ...
        ├── files/         # Downloaded attachments (if not using --skip-files-download)
        │   ├── document.pdf
        │   ├── image.png
        │   └── screenshot.png
        └── children/      # Child cards (if using --recursive)
            ├── 12346/
            │   ├── card.md
            │   ├── card.json
            │   ├── comments/
            │   └── files/
            └── 12347/
                ├── card.md
                └── ...
```

**Example output path:** `./data/company/12345/` for card 12345 from company.kaiten.ru

### Markdown Output Format

Generated Markdown includes:

- **Header**: Card title as H1
- **Metadata**: ID, status, type, assignee, dates, priority
- **Description**: HTML converted to Markdown
- **Checklists**: All checklist items with completion status
- **Children**: Links to child cards (if any)
- **Comments**: All comments with timestamps and authors
- **Files**: Attachments as links/images

### Environment Variables

```bash
# Required
KAITEN_API_TOKEN=your-api-token-here

# Optional (can be inferred from card URLs)
KAITEN_API_BASE_URL=https://your-instance.kaiten.ru/api/v1
DEBUG=kaiten:*  # Enable debug logging
```

**Note**: `KAITEN_API_BASE_URL` is only required when using card IDs directly. When providing full card URLs, the base URL is automatically extracted.

### CLI Options

| Option | Description |
|--------|-------------|
| `--stdout-only` | Output Markdown to stdout instead of files |
| `--output-dir <dir>` | Specify output directory (default: ./card-{id}) |
| `--token <token>` | API token (overrides environment variable) |
| `--recursive` | Download all children cards recursively |
| `--max-depth <n>` | Maximum recursion depth (default: 3) |
| `--skip-files-download` | Don't download files, use direct Kaiten URLs |
| `--help` | Show help message |

### Programmatic Usage

```javascript
import { downloadCard } from './download-card.mjs';

// Basic usage
const { card, markdown, comments, children } = await downloadCard({
  cardId: 12345,
  token: 'your-token',
  apiBase: 'https://yourcompany.kaiten.ru/api/v1'
});

// With options
const result = await downloadCard({
  cardId: 12345,
  token: 'your-token', 
  includeChildren: true,
  skipFiles: true,
  quiet: true  // Suppress error console output
});
```

## 🛠️ create-*.mjs Scripts

Helper scripts for creating Kaiten resources programmatically:

### create-space.mjs
```bash
# Create a new space
node create-space.mjs "My New Space"
node create-space.mjs "My New Space" space-output.json
```

### create-board.mjs  
```bash
# Create a board in a space
node create-board.mjs 123 "My Board"
node create-board.mjs 123 "My Board" board-output.json
```

### create-card.mjs
```bash
# Create a card in a board
node create-card.mjs 456 "My Card Title"  
node create-card.mjs 456 "My Card Title" card-output.json
```

### create-column.mjs
```bash
# Create a column in a board
node create-column.mjs 456 "New Column"
node create-column.mjs 456 "New Column" column-output.json
```

All create scripts support the same environment variables as download-card.mjs and will output the created resource data in JSON format.

## 🧪 Testing

```bash
# Run all tests  
node test-download-card.mjs
node test-command-stream.mjs

# Tests require environment variables to be set
# Creates temporary test resources and cleans them up
```

## 📚 API Reference

Built using the official [Kaiten API documentation](https://developers.kaiten.ru). Supports all standard Kaiten card operations including metadata, comments, files, checklists, and hierarchical relationships.
