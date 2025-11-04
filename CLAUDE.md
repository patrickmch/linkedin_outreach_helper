# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn Outreach Helper is an MCP (Model Context Protocol) server for AI-powered lead qualification. It integrates with Claude Desktop to help evaluate LinkedIn prospects based on configurable criteria.

## Core Architecture

### MCP Server

The system uses a Model Context Protocol (MCP) server that integrates with Claude Desktop for lead qualification.

**File:** `src/mcp-server.js`

**Available Tools:**
1. `get_csv_info` - Shows which CSV file is loaded and profile count
2. `get_next_profile` - Returns the next unqualified profile from the CSV
3. `save_qualification` - Saves qualification results (score, reasoning, qualified status)
4. `get_qualification_criteria` - Returns the qualification criteria from config.json
5. `get_stats` - Shows qualification statistics
6. `get_next_to_contact` - Gets next qualified profile to reach out to
7. `mark_contacted` - Marks profile as contacted with notes

**Data Flow:**
1. User exports profiles from LinkedIn Sales Navigator to CSV
2. CSV is automatically detected in ~/Downloads (most recent "Profiles downloaded from..." file)
3. User opens Claude Desktop and says "Use the get_next_profile tool"
4. MCP server loads profile from CSV
5. Claude evaluates profile against criteria
6. User confirms, Claude uses save_qualification tool
7. MCP server saves to `data/qualified/` or `data/disqualified/`
8. Repeat for all 73 profiles

### Module Structure

The codebase follows a functional module pattern with ES modules:

- **src/mcp-server.js** - MCP server with profile qualification tools
- **src/csv-loader.js** - Automatically finds and parses LinkedIn CSV exports from ~/Downloads
- **src/config.js** - Configuration loader (loads from config.json)
- **src/qualifier.js** - Prompt building utilities for lead scoring

### Configuration System

Configuration is loaded from `config.json` (created from `config.template.json`):

```json
{
  "qualification": {
    "criteria": [
      "Connectors: Fractional executives...",
      "Mid-market decision makers...",
      ...
    ],
    "idealProfile": "Description of ideal prospect...",
    "disqualifiers": [
      "Works at enterprise companies...",
      ...
    ],
    "minScore": 70
  }
}
```

## CSV Export Format

The MCP server automatically finds the most recent LinkedIn Sales Navigator CSV export in ~/Downloads. The CSV contains comprehensive profile data:

- **Identity**: full_name, headline, location_name, profile_url
- **Experience**: Up to 10 positions (organization_1 through organization_10) with titles, dates, descriptions
- **Education**: Up to 3 schools with degrees and fields of study
- **Skills**: Comma-separated list with endorsement counts
- **Connections**: connections_count, mutual connections

The csv-loader.js module parses this data and converts it to a normalized profile format for qualification.

## Usage Instructions

See `MCP_USAGE.md` for detailed instructions on using the MCP server with Claude Desktop.

**Quick Start in Claude Desktop:**
```
Use the get_csv_info tool
Use the get_next_profile tool
Use the save_qualification tool with [profile details]
```

## Setup

### Installation

```bash
# Install dependencies
npm install

# Copy config template
cp config.template.json config.json

# Edit config with your qualification criteria
nano config.json
```

### Claude Desktop Configuration

Add to your Claude Desktop MCP settings:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linkedin-qualifier": {
      "command": "node",
      "args": ["/absolute/path/to/linkedin-outreach-helper/src/mcp-server.js"]
    }
  }
}
```

### Start MCP Server

```bash
npm run mcp
```

Or configure Claude Desktop to auto-start it.

## Usage Workflow

### 1. Add Profiles

Place profile JSON files in the `profiles/` directory with this format:

```json
{
  "url": "https://www.linkedin.com/in/username",
  "scrapedAt": "2025-01-15T10:30:00.000Z",
  "name": "John Doe",
  "title": "VP of Operations",
  "company": "Acme Corp",
  "location": "Denver, CO",
  "about": "Experienced operations leader...",
  "experience": [],
  "education": []
}
```

### 2. Qualify in Claude Desktop

Open Claude Desktop and say:

```
Get the next LinkedIn profile to qualify
```

Claude will:
1. Read the profile
2. Evaluate against your criteria
3. Provide a score (0-100) and reasoning
4. Ask for confirmation to save

### 3. Review Results

Qualified profiles are saved to:
- `data/qualified/` - Prospects that meet your criteria (score >= minScore)
- `data/disqualified/` - Prospects that don't meet criteria

Each saved file includes:
- Original profile data
- Qualification score
- Detailed reasoning
- Evaluation timestamp

## Directory Structure

```
profiles/              # Input: Profile JSON files to evaluate
data/
  qualified/          # Output: Qualified prospects with scores
  disqualified/       # Output: Disqualified prospects with reasons
config.json           # User configuration (gitignored)
src/
  mcp-server.js       # Model Context Protocol server
  config.js           # Configuration loader
  qualifier.js        # Prompt building utilities
```

## Key Implementation Details

### Profile File Format

Profiles should be JSON files with at minimum:
- `name` - Person's name
- `title` - Current job title
- `company` - Company name
- `location` - Geographic location

Optional but recommended:
- `about` - Profile summary/bio
- `experience` - Work history array
- `education` - Education history array
- `url` - LinkedIn profile URL

### Qualification Logic

The MCP server uses the following logic:

1. **Load Profile**: Reads next JSON file from `profiles/` directory
2. **Build Prompt**: Constructs evaluation prompt with criteria from config
3. **Evaluate**: Claude analyzes profile and returns score + reasoning
4. **Save Results**:
   - Score >= minScore → `data/qualified/`
   - Score < minScore → `data/disqualified/`
5. **Update File**: Adds qualification metadata to profile JSON

### File Naming

Output files use format: `qualified_TIMESTAMP_NAME.json`

Example: `qualified_1705329000000_John_Doe.json`

## Development Notes

### MCP Server Tools

Each tool in the MCP server follows this pattern:

```javascript
server.tool(
  'tool_name',
  { description: '...', parameters: {...} },
  async (params) => {
    // Tool implementation
    return {
      content: [{ type: 'text', text: 'Result' }]
    };
  }
);
```

### Error Handling

The MCP server includes error handling for:
- Missing profile files
- Invalid JSON format
- Missing configuration
- File system errors

Errors are returned to Claude Desktop for display to the user.

### Testing

Test the MCP server:

```bash
# Start server
npm run mcp

# In Claude Desktop, try:
# "Get qualification criteria"
# "Get the next profile to qualify"
# "Show qualification stats"
```

## Common Issues

### No Profiles Found

**Problem:** "No unqualified profiles found"

**Solution:** Add profile JSON files to the `profiles/` directory

### Invalid Configuration

**Problem:** "Failed to load config"

**Solution:** Ensure `config.json` exists and has valid JSON format

### MCP Server Not Connecting

**Problem:** Claude Desktop shows "Server not available"

**Solution:**
1. Check path in `claude_desktop_config.json` is absolute
2. Verify `node` command is in PATH
3. Restart Claude Desktop

## Future Enhancements

Potential additions:
- CSV import/export for bulk processing
- Custom scoring algorithms
- Integration with LinkedIn API (if available)
- Batch processing CLI tool
- Web interface for qualification review

## License

MIT
