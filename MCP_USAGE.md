# How to Use the LinkedIn Outreach MCP Server with Claude Desktop

This MCP server is already configured in your Claude Desktop. Use these commands to qualify LinkedIn profiles from your CSV exports.

## Quick Start (Batch Processing - RECOMMENDED)

**Faster workflow**: Process 5 profiles at once instead of one-by-one.

### 1. Load your qualification criteria from Google Drive
**CRITICAL**: Open your qualification criteria document in Google Drive BEFORE starting!

### 2. Get a batch of 5 profiles
```
Use the get_next_batch tool
```

This returns 5 profiles with summary info (name, title, company, current role).

### 3. Quick screen for obvious disqualifiers
Look for immediate red flags:
- Incomplete profiles (no photo, minimal experience)
- Pure sales/marketing roles without ops
- Government/public sector
- Enterprise (1000+ employees)
- Solopreneurs (1-2 employees)

### 4. Deep analysis ONLY on promising ones
For profiles that pass the quick screen, analyze against your full criteria.

### 5. Save all 5 qualifications
Use `save_qualification` for each profile (whether qualified or disqualified).

### 6. Repeat with next batch
```
Use the get_next_batch tool
```

---

## Alternative: Single Profile Mode

If you prefer one-at-a-time:

### 1. Check what CSV is loaded
```
Use the get_csv_info tool
```

### 2. Get the next profile to qualify
```
Use the get_next_profile tool
```

This will return a profile with all details (name, title, company, experience, education).

### 3. Qualify a profile
After analyzing a profile against your qualification criteria (in Google Drive), save your decision:

**⚠️ IMPORTANT: Keep responses BRIEF to avoid errors**

```
Use the save_qualification tool with:
- profileName: "John Carter"
- qualified: true
- score: 85
- reasoning: "COO at 50-person consulting firm, posts about scaling ops" (MAX 500 chars)
- strengths: ["Fractional COO", "Mid-market focus", "Active on LinkedIn"] (2-5 items, MAX 100 chars each)
- concerns: ["Financial services niche", "May be too busy"] (2-5 items, MAX 100 chars each)
- recommendedApproach: "Connect on ops scaling challenges, reference recent post" (MAX 500 chars)
```

## Character Limits (CRITICAL)

To prevent tool failures, **always keep text concise**:

- **reasoning**: Max 500 characters (~2-3 sentences)
- **recommendedApproach**: Max 500 characters (~2-3 sentences)
- **strengths**: 2-5 items, each max 100 characters (~1 sentence)
- **concerns**: 2-5 items, each max 100 characters (~1 sentence)

### ✅ Good Example (Concise)
```
reasoning: "Founder of 30-person B2B SaaS, posts weekly about ops scaling"
strengths: ["Founder/CEO role", "Active LinkedIn poster", "Mid-market SaaS"]
concerns: ["May be too busy", "Remote vs Colorado"]
recommendedApproach: "Reference recent post on scaling challenges"
```

### ❌ Bad Example (Too Verbose - Will Fail)
```
reasoning: "This profile represents an excellent opportunity because they are the founder and CEO of a rapidly growing B2B SaaS company with approximately 30 employees, which falls squarely within our sweet spot of 10-100 employees. Their LinkedIn activity demonstrates consistent engagement with content related to operational scaling challenges, which aligns perfectly with our value proposition around AI automation for growing businesses..."
strengths: ["They have significant experience as a founder and CEO with demonstrated track record of scaling multiple companies from early stage through growth phases", "Very active on LinkedIn with weekly posts about operational challenges and business scaling", ...]
```

If you see validation errors, **make your text shorter** and try again.

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

## Outreach Message Generation

After qualifying profiles, generate personalized outreach messages:

### 1. Load outreach guidelines from Google Doc
**CRITICAL**: Open this document BEFORE starting: https://docs.google.com/document/d/1YbudVmUqeV5bIs6PFXk8aOCMWgEXJ_vOWqawuqtau94/edit?tab=t.0

### 2. Get next profile for outreach
```
Use the get_profile_for_outreach tool
```

This returns a qualified profile with:
- Profile details (name, title, company)
- Qualification score and reasoning
- Strengths and concerns
- Recommended approach

### 3. Generate personalized message
Using the profile info and outreach guidelines, write a personalized connection request or message.

### 4. Save the outreach message
```
Use the save_outreach tool with:
- profileName: "John Carter"
- outreachMessage: "Hi John, I noticed your work in..."
```

### 5. Repeat for next profile
```
Use the get_profile_for_outreach tool
```

---

## Outreach Message Review

After generating messages, review them before sending:

### 1. Get next message to review
```
Use the get_next_outreach_for_review tool
```

This displays:
- Profile summary (name, title, company, score)
- Qualification analysis (reasoning, strengths, recommended approach)
- The generated outreach message
- Count of messages remaining to review

### 2. Review the message and choose action:

**Option A: Approve the message**
```
Use the approve_outreach tool with:
- profileName: "John Carter"
```
Marks message as approved and ready to send.

**Option B: Revise the message**
If you want to change the tone, fix wording, or adjust content:
```
Use the revise_outreach tool with:
- profileName: "John Carter"
- newMessage: "Hey John, saw you're building..."
```
Updates the message and clears any previous approval.

**Option C: Disqualify the prospect**
If you decide they're not a good fit after all, move them to disqualified manually or use the existing qualification tools.

### 3. Repeat until all reviewed
```
Use the get_next_outreach_for_review tool
```
Continue until all messages are approved!

---

## Available MCP Tools

### Qualification Tools
- `get_csv_info` - Shows which CSV file is loaded and profile count
- `get_next_batch` - **[RECOMMENDED]** Returns 5 profiles for batch processing
- `get_next_profile` - Returns next unqualified profile with full details
- `save_qualification` - Saves your qualification decision (qualified/disqualified)
- `get_stats` - Shows qualification statistics

### Outreach Generation Tools
- `get_profile_for_outreach` - Gets next qualified profile that needs outreach message
- `save_outreach` - Saves personalized outreach message for a profile

### Outreach Review Tools
- `get_next_outreach_for_review` - Gets next outreach message to review (shows profile + message)
- `approve_outreach` - Approves an outreach message as ready to send
- `revise_outreach` - Revises an outreach message with new text

### Contact Tracking Tools
- `get_next_to_contact` - Gets next qualified profile to reach out to
- `mark_contacted` - Marks profile as contacted with notes

## Batch Processing Example

**Step 1: Get batch**
```
Use get_next_batch
```

**Response:**
```
🚨 CRITICAL REMINDER: Load your qualification criteria from Google Drive RIGHT NOW!

Batch of 5 profiles (73 remaining):

PROCESS:
1. Quick screen for obvious disqualifiers
2. Deep analysis ONLY on promising ones
3. Save all 5 using save_qualification

---

[1] John Carter
Title: Director, Risk Management Association
Company: Denver Banker
Location: Denver Metropolitan Area
...

[2] Tom Q.
Title: Settlement Specialist
Company: Arcadia Settlements Group
...
```

**Step 2: Quick screen**
- [1] John Carter - Promising (banking ops, Denver)
- [2] Tom Q. - Disqualify (niche settlement industry)
- [3] Mary Smith - Promising (COO, 50 employees)
- [4] Bob Jones - Disqualify (pure sales role)
- [5] Alice Lee - Promising (Founder, B2B SaaS)

**Step 3: Deep analysis on #1, #3, #5 only**

**Step 4: Save all 5**
```
Use save_qualification for John Carter...
Use save_qualification for Tom Q. (qualified: false, score: 25, ...)
Use save_qualification for Mary Smith...
Use save_qualification for Bob Jones (qualified: false, score: 15, ...)
Use save_qualification for Alice Lee...
```

**Result**: 5 profiles qualified in one batch! Much faster than 1-by-1.

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
