# LinkedIn Outreach Automation

AI-powered LinkedIn prospecting system with automated lead qualification, personalized outreach generation, and automated connection request sending via Heyreach.

## What It Does

Complete end-to-end LinkedIn prospecting automation:

1. **Export** profiles from LinkedIn Sales Navigator to CSV
2. **Qualify** leads with AI (Claude Desktop + MCP)
3. **Generate** personalized outreach messages
4. **Send** connection requests automatically via Heyreach
5. **Track** connection acceptances via polling
6. **Follow up** with manual messaging (API limitation)

## Features

- 🤖 **AI-Powered Qualification**: Uses Claude Desktop via MCP for intelligent lead scoring
- ⚡ **Batch Processing**: Qualify 5 profiles at once for efficiency
- ✍️ **Outreach Generation**: AI generates personalized connection request messages
- 📝 **Message Review & Approval**: Review and refine messages before sending
- 🚀 **Automatic Sending**: Qualified prospects automatically added to Heyreach campaign
- 📊 **Progress Tracking**: Never process the same profile twice
- 🔔 **Connection Tracking**: Poll Heyreach API to track accepted connections
- 💰 **Zero API Costs**: Uses Claude Desktop subscription (no additional Claude API fees)

## Architecture

```
LinkedIn Sales Navigator CSV Export
  ↓
Claude Desktop (MCP Tools)
  ├─ Batch qualification (5 at a time)
  ├─ AI scoring (0-100)
  ├─ Save to qualified/disqualified
  └─ **Auto-send to Heyreach** ✨
  ↓
Heyreach API
  └─ Add to List 406467
  ↓
Heyreach Campaign
  └─ Send connection requests via LinkedIn
  ↓
Connection Acceptance Tracking (Manual)
  └─ Run check-acceptances.js to poll Heyreach API
  ↓
Follow-up Messages (Manual)
  └─ Send messages via LinkedIn or Heyreach UI
```

## Quick Start

### 1. Installation

```bash
cd linkedin-outreach-helper
npm install
```

### 2. Configuration

Create `config.json`:

```json
{
  "minScore": 60,
  "heyreach": {
    "apiKey": "your-heyreach-api-key",
    "listId": "your-list-id",
    "baseUrl": "https://api.heyreach.io/api/public"
  }
}
```

### 3. Setup MCP in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linkedin-outreach": {
      "command": "node",
      "args": ["/absolute/path/to/linkedin-outreach-helper/src/mcp-server.js"]
    }
  }
}
```

Restart Claude Desktop.

### 4. Prepare Qualification Criteria

Create a Google Doc with your lead qualification criteria. You'll load this in Claude Desktop before qualifying.

### 5. Export Profiles from LinkedIn

1. Go to LinkedIn Sales Navigator
2. Run your search with filters
3. Export results to CSV
4. Save to `~/Downloads` (MCP automatically finds most recent CSV)

### 6. Qualify Leads in Claude Desktop

Open Claude Desktop and say:

```
Load my qualification criteria from Google Drive, then get the next batch of 5 profiles to qualify
```

Claude will:
- Get 5 profiles from your CSV
- Show summary for quick screening
- You identify obvious disqualifiers
- Deep analysis on promising ones
- Save all 5 (qualified or disqualified)
- **Automatically send qualified prospects to Heyreach** ✨

### 7. Generate Outreach Messages

In Claude Desktop:

```
Load my outreach guidelines from Google Drive, then get the next profile for outreach
```

Claude will:
- Get next qualified prospect without a message
- Generate personalized outreach based on qualification analysis
- Save message to prospect's JSON file

### 8. Review & Approve Messages

In Claude Desktop:

```
Get the next outreach message to review
```

Claude shows:
- Profile summary
- Qualification analysis
- Generated outreach message

You can:
- Approve it: `approve_outreach for [name]`
- Revise it: `revise_outreach for [name] with: [new message]`

### 9. Track Connection Acceptances

Heyreach automatically sends connection requests. Check for acceptances:

```bash
node check-acceptances.js
```

This polls the Heyreach API and updates profiles with `connectionAccepted: true` and `outreachSent: false`.

### 10. Generate Follow-up Messages

In Claude Desktop:

```
Get the next connected profile
```

Claude will:
- Get next accepted connection needing post-connection message
- Generate personalized post-connection message based on qualification
- You approve the message
- Save with: `save_post_connection_message for [name] with: [message]`
- Profile marked as `outreachSent: true`

### 11. Send Post-Connection Messages (Manual)

**Manual Process**:
- Review profile JSONs in `data/qualified/`
- Copy `postConnectionMessage` text from profiles with `connectionAccepted: true`
- Send messages manually via LinkedIn or Heyreach UI
- API limitation: Cannot automate first message to new connections

## Complete Workflow

### Phase 1: Qualification (Claude Desktop)

**Step 1:** Load qualification criteria from Google Drive

**Step 2:** Get batch of 5 profiles
```
Use get_next_batch tool
```

**Step 3:** Quick screen for obvious disqualifiers
- Incomplete profiles
- Pure sales/marketing roles
- Government/public sector
- Enterprise (1000+ employees)
- Solopreneurs

**Step 4:** Deep analysis on promising ones
- Analyze against full criteria
- Score 0-100
- Document reasoning, strengths, concerns

**Step 5:** Save all 5
```
Use save_qualification tool for each profile
```

**Result:** Qualified prospects automatically sent to Heyreach! ✨

**Step 6:** Repeat
```
Use get_next_batch tool
```

### Phase 2: Connection Requests (Automatic)

- ✅ Heyreach sends connection requests via LinkedIn

### Phase 3: Track Acceptances (Manual)

Run periodically to check for accepted connections:
```bash
node check-acceptances.js
```

This updates profile JSONs with `connectionAccepted: true` and `outreachSent: false`.

### Phase 4: Post-Connection Message Generation (Claude Desktop)

**Step 1:** Get next connected profile
```
Use get_next_connected_profile tool
```

**Step 2:** Generate personalized post-connection message
Claude generates message based on:
- Profile details
- Qualification analysis
- Connection context

**Step 3:** Save post-connection message
```
Use save_post_connection_message tool
```
Profile marked as `outreachSent: true`

**Step 4:** Repeat until all connected profiles have post-connection messages

### Phase 5: Send Post-Connection Messages (Manual)

**Manual Process Required**:
1. Check profile JSONs in `data/qualified/` for `connectionAccepted: true`
2. Copy `postConnectionMessage` text from each profile
3. Send messages manually via LinkedIn or Heyreach UI
4. API limitation: Heyreach cannot automate first message to new connections

## Available MCP Tools

### Qualification Tools
- `get_csv_info` - Shows which CSV is loaded
- `get_next_batch` - **[RECOMMENDED]** Get 5 profiles for batch processing
- `get_next_profile` - Get single profile (slower)
- `save_qualification` - Save qualification + auto-send to Heyreach
- `get_stats` - Show qualification statistics

### Outreach Review Tools
- `get_next_outreach_for_review` - Get next message to review
- `approve_outreach` - Approve message as ready to send
- `revise_outreach` - Revise message with new text

### Post-Connection Outreach Tools
- `get_next_connected_profile` - Get next accepted connection needing post-connection message
- `save_post_connection_message` - Save post-connection message and mark as sent

## Configuration

### config.json

```json
{
  "minScore": 60,
  "heyreach": {
    "apiKey": "your-api-key-here",
    "listId": "your-list-id",
    "baseUrl": "https://api.heyreach.io/api/public"
  }
}
```

**minScore**: Minimum qualification score (0-100) to be considered qualified

**heyreach.apiKey**: Your Heyreach API key (get from Heyreach dashboard)

**heyreach.listId**: The list ID that triggers your campaign

**heyreach.baseUrl**: Heyreach API base URL (should not change)

### External Documents

**Qualification Criteria**: Store in Google Drive for easy editing

**Outreach Guidelines**: Store in Google Drive
- Template: https://docs.google.com/document/d/1YbudVmUqeV5bIs6PFXk8aOCMWgEXJ_vOWqawuqtau94/edit?tab=t.0

## Directory Structure

```
linkedin-outreach-helper/
├── src/
│   ├── mcp-server.js         # MCP server with all tools
│   ├── csv-loader.js         # Auto-finds CSV in ~/Downloads
│   ├── config.js             # Configuration loader
│   ├── heyreach-client.js    # Heyreach API integration
│   ├── acceptance-tracker.js # Connection acceptance polling
│   └── message-sender.js     # Message sending (not functional)
├── check-acceptances.js      # Script to check accepted connections
├── batch-send.js             # Script to retry failed sends
├── data/
│   ├── qualified/            # Qualified prospects (JSON)
│   └── disqualified/         # Disqualified prospects (JSON)
├── config.json               # Your configuration
└── MCP_USAGE.md              # Detailed MCP usage guide
```

## Profile JSON Structure

Qualified profiles include complete tracking:

```json
{
  "name": "John Doe",
  "title": "CEO",
  "company": "Acme Corp",
  "url": "https://linkedin.com/in/johndoe",
  "qualification": {
    "isQualified": true,
    "analysis": {
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

## Heyreach Integration

When you qualify a prospect (score ≥ minScore), the system **automatically**:

1. Saves to `data/qualified/`
2. Calls Heyreach API: `POST /list/AddLeadsToListV2`
3. Adds prospect to list 406467
4. List update triggers campaign
5. Heyreach sends connection request via LinkedIn

**If send succeeds:**
```
✓ Profile "John Doe" saved as QUALIFIED (score: 85/100)
  ✓ Sent to Heyreach campaign
```

**If send fails:**
```
✓ Profile "John Doe" saved as QUALIFIED (score: 85/100)
  ✗ Failed to send to Heyreach (will retry later)
```

**Failed sends are detected:**

When you start a batch, Claude Desktop alerts you:
```
⚠️ WARNING: 2 qualified profile(s) failed to send to Heyreach:
  • Jane Smith - Heyreach API error (500): ...
  • Bob Jones - LinkedIn profile URL is required

Would you like me to retry sending these to Heyreach?
```

## Troubleshooting

### No profiles returned
- Check CSV exists in `~/Downloads`
- Verify CSV is from LinkedIn Sales Navigator export
- Use `get_csv_info` tool to see what's loaded

### Heyreach send failures
- Verify API key is correct in config.json
- Check listId exists in your Heyreach account
- Ensure profile has valid LinkedIn URL
- Check MCP server logs for detailed error

### MCP server not connecting
- Verify path in `claude_desktop_config.json` is absolute
- Restart Claude Desktop after config changes
- Check `node` command works in terminal
- Test server: `npm run mcp`

### Qualification criteria not loading
- Make sure Google Drive document is open
- Tell Claude Desktop to load the document first
- Verify you have access to the document

## API Costs

**Zero Claude API costs!** This system uses:
- Claude Desktop subscription (included with Claude Pro)
- MCP tools (no API calls)
- Heyreach API (part of Heyreach subscription)

No additional API fees for qualification, outreach generation, or review!

## Best Practices

1. **Batch Qualification**: Use `get_next_batch` for 5 at a time (much faster)
2. **Quick Screening**: Identify obvious disqualifiers upfront
3. **Deep Analysis**: Only analyze promising profiles in detail
4. **External Criteria**: Keep qualification criteria in Google Drive for easy updates
5. **Review Messages**: Always review and approve outreach before Heyreach sends
6. **Monitor Results**: Check Heyreach dashboard and webhook logs regularly
7. **Iterate**: Refine criteria and outreach based on acceptance rates

## Safety & Ethics

This tool is for legitimate B2B lead generation:

- ✅ Use for qualified B2B outreach
- ✅ Personalize every message
- ✅ Respect LinkedIn's terms of service
- ✅ Monitor response rates and adjust
- ❌ Don't spam or send generic messages
- ❌ Don't scrape for unauthorized purposes
- ❌ Don't exceed reasonable outreach limits

**Remember**: Quality over quantity. Target the right prospects with personalized, relevant outreach.

## Documentation

- **MCP_USAGE.md** - Complete MCP tools usage guide
- **CLAUDE.md** - Technical documentation for Claude Code

## License

MIT

## Disclaimer

This tool is provided for legitimate lead generation purposes. Users are responsible for complying with LinkedIn's and Heyreach's terms of service and all applicable laws.
