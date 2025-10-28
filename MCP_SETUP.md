# MCP Setup - Automated Qualification with Claude Code

Use Claude Code to automatically qualify all your LinkedIn profiles without API costs and without manual copy/paste!

## How It Works

The MCP (Model Context Protocol) server exposes your LinkedIn profiles as tools that Claude Code can use directly:

1. You start the MCP server
2. Claude Code connects and can call tools to get profiles and save qualifications
3. You tell Claude Code: "Qualify all my LinkedIn profiles"
4. Claude Code automatically loops through all profiles, analyzes them, and saves qualified ones
5. **Fully automated, zero API costs, zero manual intervention!**

## Setup Instructions

### Step 1: Configure Claude Desktop for MCP

Add this MCP server to your Claude Desktop configuration file:

**Location of config file:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Add this to your config:**

```json
{
  "mcpServers": {
    "linkedin-outreach": {
      "command": "node",
      "args": [
        "/FULL/PATH/TO/linkedin-outreach-helper/src/mcp-server.js"
      ],
      "cwd": "/FULL/PATH/TO/linkedin-outreach-helper"
    }
  }
}
```

**Replace `/FULL/PATH/TO/linkedin-outreach-helper` with the actual path!**

For example:
- macOS: `/Users/yourname/code/linkedin-outreach-helper`
- Windows: `C:\\Users\\yourname\\code\\linkedin-outreach-helper`

### Step 2: Restart Claude Desktop

Close and reopen Claude Desktop to load the MCP server.

### Step 3: Verify Connection

In Claude Desktop, start a new conversation and ask:

```
Can you see the linkedin-outreach MCP tools?
```

You should see 4 tools available:
- `get_next_profile` - Get next unqualified profile
- `save_qualification` - Save qualification decision
- `get_qualification_criteria` - Get your criteria from config
- `get_stats` - Get qualification statistics

### Step 4: Run Automated Qualification

In Claude Desktop, simply say:

```
Please qualify all my LinkedIn profiles using the MCP tools.
For each profile:
1. Get the next profile
2. Analyze it against the qualification criteria
3. Score it 0-100
4. Save the qualification if score >= 70

Keep going until all profiles are done.
```

Claude will automatically:
- Loop through all unqualified profiles
- Analyze each one against your criteria
- Save qualified profiles to `data/qualified/`
- Update your stats
- Continue until all profiles are processed

## Qualification Threshold

Profiles are only saved to `data/qualified/` if:
1. `qualified: true` in Claude's analysis
2. `score >= 70` (configurable in `config.json` via `qualification.minScore`)

Disqualified profiles are tracked in stats but not saved as files.

## Available MCP Tools

### `get_next_profile`
Returns the next profile that hasn't been qualified yet.

**Returns:**
- Profile data (name, title, company, experience, education, etc.)
- Number of profiles remaining

### `save_qualification`
Saves Claude's qualification decision.

**Parameters:**
- `profileName` - Exact name from the profile
- `qualified` - true/false
- `score` - 0-100
- `reasoning` - Why qualified/disqualified
- `strengths` - Array of positive points
- `concerns` - Array of concerns
- `recommendedApproach` - How to approach this lead

**Behavior:**
- If qualified AND score >= threshold: Saves to `data/qualified/`
- Otherwise: Just increments disqualified counter

### `get_qualification_criteria`
Returns your criteria from config.json to guide analysis.

### `get_stats`
Shows total profiles, qualified count, and remaining to qualify.

## Example Workflow

```bash
# 1. Scrape some profiles
npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 20

# 2. Configure MCP in Claude Desktop (one-time setup)
# Edit ~/Library/Application Support/Claude/claude_desktop_config.json

# 3. Restart Claude Desktop

# 4. In Claude Desktop, run automated qualification
"Qualify all my LinkedIn profiles using MCP tools"

# 5. Check results
npm run stats
ls data/qualified/
```

## Troubleshooting

### "No MCP tools available"
- Check that Claude Desktop config file has the correct path
- Restart Claude Desktop after editing config
- Verify the path exists: `ls /path/to/linkedin-outreach-helper/src/mcp-server.js`

### "Profile not found"
- Make sure to use the exact profile name from `get_next_profile`
- Names are case-sensitive

### "No more profiles to qualify"
- Great! All profiles have been processed
- Run `npm run stats` to see results

### Qualification not saving
- Check that score >= minScore (default 70)
- Check that qualified = true
- Look for error messages in Claude Desktop

## Cost Comparison

### Option 1: Anthropic API (`npm run qualify`)
- Cost: ~$0.003 per profile
- 100 profiles = $0.30
- Fully automated

### Option 2: MCP with Claude Code (this method)
- Cost: $0 (included in Claude Pro subscription)
- Fully automated
- No API key needed

### Option 3: Manual Review (`npm run review`)
- Cost: $0
- Manual copy/paste for each profile
- Good for testing criteria

## Tips

- Start with a small batch (5-10 profiles) to test your criteria
- Adjust `minScore` in config.json if too many/few are qualifying
- Use `npm run stats` to monitor progress
- Check `data/qualified/` to review Claude's decisions
- Refine your qualification criteria based on results

## Need Help?

See the main README.md for general usage, or check the qualification criteria in your config.json file.
