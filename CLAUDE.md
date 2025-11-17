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

**Outreach Review Tools:**
- `get_next_outreach_for_review` - Gets next message to review with profile context
- `approve_outreach` - Marks message as approved and ready
- `revise_outreach` - Updates message, clears approval

**Post-Connection Outreach Tools:**
- `get_next_connected_profile` - Gets next accepted connection needing post-connection message
- `save_post_connection_message` - Saves post-connection message and marks as sent (manual send required)

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
5. Connection Acceptance Tracking (check-acceptances.js)
   - Polls Heyreach API via acceptance-tracker.js
   - Updates profiles with connectionAccepted status and outreachSent: false
   - Run manually as needed
   ↓
6. Post-Connection Message Generation (Claude Desktop MCP Tools)
   - get_next_connected_profile - Gets next accepted connection
   - Generate personalized post-connection message
   - save_post_connection_message - Saves message and marks outreachSent: true
   ↓
7. Send Post-Connection Messages (Manual)
   - Copy saved postConnectionMessage from profile JSON
   - Send manually via LinkedIn or Heyreach UI
   - API limitation: Cannot automate first message to new connections
```

### Module Structure

**src/mcp-server.js** - MCP server with all qualification, outreach, and review tools
**src/csv-loader.js** - Auto-finds and parses LinkedIn CSV exports from ~/Downloads
**src/config.js** - Configuration loader (loads from config.json)
**src/heyreach-client.js** - Heyreach API integration for automatic sending
**src/acceptance-tracker.js** - Polls Heyreach API for connection acceptances
**src/message-sender.js** - Message sending (not functional - API limitation)
**batch-qualify.js** - Reusable batch qualification module and statistics utility
**check-acceptances.js** - Standalone script to check for accepted connections
**batch-send.js** - Standalone script to retry failed Heyreach sends

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

### Phase 2: Connection Request Sending (Automated)

- Heyreach campaign automatically sends connection requests

### Phase 3: Connection Acceptance Tracking (Manual)

Run `node check-acceptances.js` to:
- Poll Heyreach API for accepted connections
- Update profile JSONs with `connectionAccepted: true` and `outreachSent: false`
- Track `connectionAcceptedAt` timestamp

### Phase 4: Post-Connection Message Generation (Claude Desktop)

1. User: "Get the next connected profile"
2. MCP returns profile with qualification context
3. Claude generates personalized post-connection message
4. User: "Save post connection message for [name] with: [message]"
5. MCP saves message to profile JSON and marks `outreachSent: true`
6. Repeat until all connected profiles have post-connection messages

### Phase 5: Send Post-Connection Messages (Manual)

**Manual Process Required**:
- Review profile JSONs in `data/qualified/` for profiles with `connectionAccepted: true`
- Copy the `postConnectionMessage` text from each profile
- Send messages manually via LinkedIn or Heyreach UI
- API limitation: Heyreach API cannot send first message to new connections

## Directory Structure

```
linkedin-outreach-helper/
├── src/
│   ├── mcp-server.js         # MCP server with all tools (main)
│   ├── csv-loader.js         # Auto-finds CSV in ~/Downloads
│   ├── config.js             # Configuration loader
│   ├── heyreach-client.js    # Heyreach API integration
│   ├── acceptance-tracker.js # Connection acceptance polling
│   └── message-sender.js     # Message sending (not functional)
├── batch-qualify.js          # Batch qualification module and stats utility
├── check-acceptances.js      # Script to check accepted connections
├── batch-send.js             # Script to retry failed sends
├── data/
│   ├── qualified/            # Qualified prospects (JSON)
│   └── disqualified/         # Disqualified prospects (JSON)
├── config.json               # User configuration (gitignored)
└── MCP_USAGE.md              # Detailed MCP usage guide
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

### Connection Acceptance Tracking

Connection acceptance is tracked via polling (not webhooks):
- Run `node check-acceptances.js` manually to check for accepted connections
- Calls `checkAcceptedConnections()` from acceptance-tracker.js
- Fetches campaign leads from Heyreach API with pagination
- Filters for `leadConnectionStatus === "ConnectionAccepted"`
- Matches accepted leads to qualified profiles by LinkedIn URL
- Updates profile JSONs with `connectionAccepted: true`, `connectionAcceptedAt`, and `heyreachLeadId`

### Message Sending Limitation

The message-sender.js module exists but is not functional:
- Heyreach's SendMessage API endpoint requires a `conversationId` parameter
- New connections don't have a `conversationId` until a manual message is sent first
- This makes automated message sending impossible for new connections
- Workaround: Send follow-up messages manually via LinkedIn or Heyreach UI
- The approved outreach messages in profile JSONs can be copied for manual use

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
  "outreachApprovedAt": "2025-11-05T...",
  "connectionAccepted": true,
  "connectionAcceptedAt": "2025-11-05T...",
  "heyreachLeadId": 122319124,
  "outreachSent": false,
  "postConnectionMessage": "Hi John, thanks for connecting! I wanted to...",
  "postConnectionMessageSentAt": "2025-11-10T..."
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

Test connection acceptance tracking:

```bash
# Check for accepted connections
node check-acceptances.js

# Verify profiles were updated
ls data/qualified/
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

Check connection acceptances periodically:
```bash
# Poll for accepted connections
node check-acceptances.js

# Check if profiles were updated
cat data/qualified/qualified_*.json | grep connectionAccepted
```

## Future Enhancements

Potential additions:
- Automated polling for connection acceptances (scheduled task)
- Bulk outreach generation (batch mode for generating multiple messages at once)
- A/B testing for outreach messages
- Response rate tracking and analysis
- Integration with additional outreach platforms that support message automation
- Alternative message sending solution (Chrome extension, LinkedIn API, etc.)
- Notification system for accepted connections

## License

MIT
