# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn Outreach Automation is an end-to-end prospecting system that combines AI-powered lead qualification (via MCP) with automated connection request sending (via Heyreach). The system qualifies LinkedIn prospects in Claude Desktop, generates personalized outreach messages, and automatically sends connection requests through Heyreach.

## Core Architecture

### MCP Server (Primary Component)

**File:** `src/mcp-server.js`

The MCP server integrates with Claude Desktop to provide tools for the complete prospecting workflow:

**Qualification Tools:**
- `get_csv_info` - Shows current CSV file and profile count
- `get_next_batch` - Returns 5 profiles for batch processing (RECOMMENDED)
- `get_next_profile` - Returns single profile with full details
- `save_qualification` - Saves qualification + auto-sends to Heyreach
- `get_stats` - Shows qualification statistics

**Outreach Generation Tools:**
- `get_profile_for_outreach` - Gets next qualified profile needing outreach message
- `save_outreach` - Saves personalized outreach message

**Outreach Review Tools:**
- `get_next_outreach_for_review` - Gets next message to review with profile context
- `approve_outreach` - Marks message as approved and ready
- `revise_outreach` - Updates message, clears approval

**Contact Tracking Tools:**
- `get_next_to_contact` - Gets next qualified profile to contact
- `mark_contacted` - Marks profile as contacted with notes

### Data Flow

```
1. LinkedIn Sales Navigator CSV Export → ~/Downloads
   ↓
2. Claude Desktop (MCP Tools)
   - Load CSV via csv-loader.js
   - Get batch of 5 profiles
   - AI qualification (score 0-100)
   - Save to data/qualified/ or data/disqualified/
   ↓
3. Automatic Heyreach Integration (heyreach-client.js)
   - POST /list/AddLeadsToListV2
   - Add qualified prospect to list 406467
   - Track send status in profile JSON
   ↓
4. Heyreach Campaign
   - Campaign triggered by list update
   - Sends LinkedIn connection request
   ↓
5. Webhook Server (webhook-server.js)
   - Receives connection acceptance webhooks
   - Tracks engagement
```

### Module Structure

**src/mcp-server.js** - MCP server with all qualification, outreach, and review tools
**src/csv-loader.js** - Auto-finds and parses LinkedIn CSV exports from ~/Downloads
**src/config.js** - Configuration loader (loads from config.json)
**src/qualifier.js** - Prompt building utilities for lead scoring
**src/heyreach-client.js** - Heyreach API integration for automatic sending
**src/webhook-server.js** - Receives webhooks for connection acceptances

### Automatic Heyreach Integration

When a prospect is qualified (score ≥ minScore), `save_qualification` automatically:

1. Saves profile to `data/qualified/`
2. Calls `addProspectToCampaign(profile)` from heyreach-client.js
3. Sends POST request to Heyreach API
4. Updates profile JSON with send status

**API Endpoint:** `POST https://api.heyreach.io/api/public/list/AddLeadsToListV2`

**Request Format:**
```javascript
{
  leads: [{
    firstName: "John",
    lastName: "Doe",
    location: "Denver, CO",
    summary: "CEO",
    companyName: "Acme Corp",
    position: "CEO",
    about: "...",
    emailAddress: "",
    profileUrl: "https://linkedin.com/in/johndoe"
  }],
  listId: 406467
}
```

**Profile JSON with Heyreach Tracking:**
```json
{
  "heyreach": {
    "sent": true,
    "sentAt": "2025-11-05T...",
    "heyreachId": "https://linkedin.com/in/johndoe",
    "listId": "406467"
  }
}
```

**If send fails:**
```json
{
  "heyreach": {
    "sent": false,
    "error": "Heyreach API error (500): ...",
    "attemptedAt": "2025-11-05T..."
  }
}
```

### Configuration System

Configuration is loaded from `config.json` (gitignored):

```json
{
  "minScore": 60,
  "heyreach": {
    "apiKey": "2yBW9A9qRDMI092vmlNiMSZOzg/sJOletD3n+oHPWPk=",
    "listId": "406467",
    "baseUrl": "https://api.heyreach.io/api/public"
  }
}
```

**Qualification criteria** and **outreach guidelines** are stored in Google Drive for easy editing:
- Qualification Criteria: User's Google Drive document
- Outreach Guidelines: https://docs.google.com/document/d/1YbudVmUqeV5bIs6PFXk8aOCMWgEXJ_vOWqawuqtau94/edit?tab=t.0

## CSV Export Format

The MCP server automatically finds the most recent LinkedIn Sales Navigator CSV export in ~/Downloads. The CSV contains:

- **Identity**: full_name, headline, location_name, profile_url
- **Experience**: Up to 10 positions with titles, dates, descriptions
- **Education**: Up to 3 schools with degrees and fields of study
- **Skills**: Comma-separated list with endorsement counts
- **Connections**: connections_count, mutual connections

The csv-loader.js module parses this data and normalizes it for qualification.

## Complete Workflow

### Phase 1: Batch Qualification

1. User exports LinkedIn Sales Navigator search to CSV
2. CSV saved to ~/Downloads
3. User opens Claude Desktop
4. User loads qualification criteria from Google Drive
5. User: "Get the next batch of 5 profiles"
6. MCP returns 5 profiles with summary info
7. User does quick screen for obvious disqualifiers
8. User analyzes promising profiles against full criteria
9. User: "Save qualification for [name] with score X, reasoning..."
10. MCP server saves to data/qualified/ or data/disqualified/
11. **Automatic**: If qualified, sends to Heyreach API
12. User sees: "✓ Sent to Heyreach campaign"
13. Repeat steps 5-12 until all profiles processed

### Phase 2: Outreach Generation

1. User: "Get the next profile for outreach"
2. MCP returns qualified profile without outreach message
3. Claude Desktop generates personalized message using:
   - Profile details
   - Qualification analysis
   - Outreach guidelines from Google Drive
4. User: "Save outreach for [name] with message: [text]"
5. MCP saves message to profile JSON
6. Repeat until all qualified profiles have messages

### Phase 3: Message Review & Approval

1. User: "Get the next outreach message to review"
2. MCP shows formatted display with:
   - Profile summary
   - Qualification analysis
   - Generated outreach message
3. User reviews and decides:
   - "Approve outreach for [name]" → marks as approved
   - "Revise outreach for [name] with: [new text]" → updates and clears approval
4. Repeat until all messages approved

### Phase 4: Automated Sending (Heyreach)

- Heyreach campaign automatically sends connection requests
- Connection requests include approved outreach messages (if configured in Heyreach)
- Webhook server tracks acceptances

## Directory Structure

```
linkedin-outreach-helper/
├── src/
│   ├── mcp-server.js       # MCP server with all tools (main)
│   ├── csv-loader.js       # Auto-finds CSV in ~/Downloads
│   ├── config.js           # Configuration loader
│   ├── qualifier.js        # Prompt building utilities
│   ├── heyreach-client.js  # Heyreach API integration
│   └── webhook-server.js   # Connection acceptance tracking
├── data/
│   ├── qualified/          # Qualified prospects (JSON)
│   └── disqualified/       # Disqualified prospects (JSON)
├── config.json             # User configuration (gitignored)
└── MCP_USAGE.md            # Detailed MCP usage guide
```

## Key Implementation Details

### Batch Processing Logic

`get_next_batch` tool (mcp-server.js:717-780):
- Returns up to 5 profiles (default) or 10 (max)
- Shows summary info for quick screening (name, title, company, location, about snippet)
- Includes process instructions (quick screen → deep analysis → save all)
- Forceful reminder to load Google Drive criteria on first batch
- Checks for failed Heyreach sends and alerts user

### Failed Send Detection

On first batch, `get_next_batch` checks all qualified profiles:
- Calls `getFailedHeyreachSends(qualifiedProfiles)` from heyreach-client.js
- Filters profiles where `heyreach.sent === false && heyreach.error` exists
- Shows warning with error details
- Asks if user wants to retry

### Profile JSON Structure

Qualified profiles include complete tracking:

```json
{
  "name": "John Doe",
  "title": "CEO",
  "company": "Acme Corp",
  "url": "https://linkedin.com/in/johndoe",
  "location": "Denver, CO",
  "about": "...",
  "experience": [...],
  "education": [...],
  "qualification": {
    "isQualified": true,
    "analysis": {
      "qualified": true,
      "score": 85,
      "reasoning": "Strong connector profile...",
      "strengths": ["CEO/Partner", "Mid-market focus"],
      "concerns": ["Location unknown"],
      "recommendedApproach": "Position as technical partner..."
    },
    "qualifiedAt": "2025-11-05T..."
  },
  "heyreach": {
    "sent": true,
    "sentAt": "2025-11-05T...",
    "heyreachId": "https://linkedin.com/in/johndoe",
    "listId": "406467"
  },
  "outreachMessage": "Hey John, saw you're leading...",
  "outreachGeneratedAt": "2025-11-05T...",
  "outreachApproved": true,
  "outreachApprovedAt": "2025-11-05T..."
}
```

### File Naming Convention

Output files use format: `qualified_TIMESTAMP_NAME.json`

Example: `qualified_1730824800000_John_Doe.json`

Disqualified: `disqualified_TIMESTAMP_NAME.json`

### Character Limits for Qualification

To prevent MCP tool failures, character limits are enforced:
- `reasoning`: Max 500 characters
- `recommendedApproach`: Max 500 characters
- `strengths`: Max 5 items, each max 100 characters
- `concerns`: Max 5 items, each max 100 characters

Validation happens in `save_qualification` handler before saving.

## Development Notes

### MCP Server Architecture

The MCP server uses @modelcontextprotocol/sdk:
- Server setup with ListToolsRequestSchema and CallToolRequestSchema handlers
- Each tool defined with name, description, inputSchema
- Handlers are async functions that return `{ content: [{type: 'text', text: '...'}] }`
- Errors returned with `isError: true` flag

### Async Qualification with Heyreach

`saveQualification` function (mcp-server.js:368-434):
- Made async to support Heyreach API calls
- After saving qualified profile, calls `await addProspectToCampaign(profile)`
- Wraps Heyreach call in try/catch to handle failures gracefully
- Updates prospect JSON with `heyreach` object before final write
- Returns `{ saved, filepath, qualified, heyreachSent }` to handler

Handler must await the result: `const result = await saveQualification(...)`

### Error Handling

The system includes comprehensive error handling:
- **Missing profiles**: Returns friendly "No more profiles" message
- **Invalid JSON**: Skips corrupt files with try/catch
- **Missing configuration**: Shows error with instructions
- **Heyreach API failures**: Logs error, marks profile, continues workflow
- **MCP tool parameter validation**: Validates lengths before processing

Errors are always returned to Claude Desktop with clear messages.

### Testing

Test the MCP server:

```bash
# Start server locally
npm run mcp

# In Claude Desktop, try:
# "Get CSV info"
# "Get the next batch"
# "Get qualification stats"
# "Get next profile for outreach"
# "Get next outreach message to review"
```

## Common Issues

### No Profiles Found

**Problem:** "No more profiles to qualify"

**Solutions:**
1. Check CSV exists in ~/Downloads
2. Verify CSV is from LinkedIn Sales Navigator (not regular LinkedIn)
3. Use `get_csv_info` to see what's loaded
4. Ensure CSV has standard Sales Navigator format

### Heyreach Integration Failures

**Problem:** "Failed to send to Heyreach"

**Solutions:**
1. Verify `config.json` has correct API key
2. Check listId (406467) exists in Heyreach account
3. Ensure profile has valid LinkedIn URL
4. Check MCP server logs for detailed error (console.error output)
5. Test Heyreach API key: `curl --location 'https://api.heyreach.io/api/public/auth/CheckApiKey' --header 'X-API-KEY: your-key'`

### MCP Server Not Connecting

**Problem:** Claude Desktop shows "Server not available"

**Solutions:**
1. Check path in `claude_desktop_config.json` is absolute
2. Verify `node` command works: `which node`
3. Restart Claude Desktop completely
4. Test server manually: `npm run mcp`
5. Check for port conflicts or crashes

### Character Limit Errors

**Problem:** "Validation failed - text too long"

**Solutions:**
1. Keep reasoning under 500 characters (~2-3 sentences)
2. Keep strengths/concerns under 100 characters each (~1 sentence)
3. Maximum 5 items per array
4. Claude Desktop should automatically keep responses concise

## Testing & Debugging

Start with a small batch:
```bash
# Test with 5 profiles first
# In Claude Desktop: "Get the next batch"
# Qualify the 5 profiles
# Check data/qualified/ for results
# Verify Heyreach dashboard shows new leads in list 406467
```

Monitor logs:
- MCP server outputs to stderr (visible in Claude Desktop console)
- Heyreach send attempts logged: "Sending [name] to Heyreach..."
- Success: "✓ Successfully sent [name] to Heyreach (ID: ...)"
- Failure: "✗ Failed to send [name] to Heyreach: [error]"

## Future Enhancements

Potential additions:
- Retry failed Heyreach sends with dedicated MCP tool
- Bulk outreach generation (batch mode)
- A/B testing for outreach messages
- Response rate tracking and analysis
- Integration with additional outreach platforms
- LinkedIn scraping (currently manual CSV export)

## License

MIT
