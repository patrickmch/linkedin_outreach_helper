# How to Use the LinkedIn Outreach MCP Server with Claude Desktop

This MCP server is already configured in your Claude Desktop. Use these commands to qualify LinkedIn profiles from your CSV exports.

## Quick Start

**Important**: Claude Desktop accesses the CSV data through MCP tools, not by reading the file directly. Use these exact phrases:

### 1. Check what CSV is loaded
```
Use the get_csv_info tool
```

### 2. Get the next profile to qualify
```
Use the get_next_profile tool
```

This will return a profile with all details (name, title, company, experience, education).

### 3. Get qualification criteria
```
Use the get_qualification_criteria tool
```

This shows the ideal customer profile and criteria to evaluate against.

### 4. Qualify a profile
After analyzing a profile, save your decision:
```
Use the save_qualification tool with:
- profileName: "John Carter"
- qualified: true
- score: 85
- reasoning: "Strong fit as fractional COO consultant working with mid-market companies"
- strengths: ["Fractional executive experience", "Works with multiple clients", "Denver-based"]
- concerns: ["Financial services focus may not align with all industries"]
- recommendedApproach: "Mention expertise in operational scaling for mid-market companies"
```

### 5. See statistics
```
Use the get_stats tool
```

Shows total profiles, qualified count, and remaining to process.

### 6. Get next profile to contact
```
Use the get_next_to_contact tool
```

Returns the next qualified profile that hasn't been contacted yet.

### 7. Mark as contacted
```
Use the mark_contacted tool with:
- profileName: "John Carter"
- notes: "Connection request sent via LinkedIn"
```

## Complete Workflow Example

Here's how to qualify all 73 profiles from your CSV:

1. **Start**: "Use get_csv_info to see the current CSV"
2. **Loop**: "Use get_next_profile to get the next one"
3. **Analyze**: Review the profile against the criteria
4. **Decide**: "Use save_qualification with [details]"
5. **Repeat**: Continue until all profiles are processed

## Available MCP Tools

- `get_csv_info` - Shows which CSV file is loaded and profile count
- `get_next_profile` - Returns next unqualified profile with full details
- `get_qualification_criteria` - Shows your ideal customer profile criteria
- `save_qualification` - Saves your qualification decision (qualified/disqualified)
- `get_stats` - Shows qualification statistics
- `get_next_to_contact` - Gets next qualified profile to reach out to
- `mark_contacted` - Marks profile as contacted with notes

## How It Works

1. The MCP server automatically finds the most recent LinkedIn CSV export in your ~/Downloads folder
2. It parses all 73 profiles from the CSV (name, title, company, location, experience, education, skills)
3. Claude Desktop uses MCP tools to get profile data and save qualification decisions
4. Qualified profiles are saved to `data/qualified/`
5. Disqualified profiles are saved to `data/disqualified/`

## Troubleshooting

**"I can't access the CSV file"**
- Don't try to read the CSV file directly
- Use the `get_next_profile` tool instead
- The MCP server handles all file access

**"No profiles returned"**
- Check if all profiles are already qualified with `get_stats`
- Verify CSV exists with `get_csv_info`
- Make sure `config.json` exists in the project root

**"MCP server not working"**
- Restart Claude Desktop
- Check that `~/Library/Application Support/Claude/claude_desktop_config.json` has the linkedin-outreach server configured
- Verify the server starts: `npm run mcp` in the project directory
