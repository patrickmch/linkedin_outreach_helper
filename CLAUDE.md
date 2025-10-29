# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn Outreach Helper is a stealth web scraper for LinkedIn Sales Navigator that combines Puppeteer-based automation with Claude AI-powered lead qualification. The tool extracts profile data while mimicking human behavior to avoid detection, then uses AI to qualify leads based on configurable criteria.

## Core Architecture

### Module Structure

The codebase follows a functional module pattern with ES modules:

- **src/index.js** - CLI entry point using Commander.js for command routing
- **src/browser.js** - Puppeteer automation with stealth plugin, session management via cookies and userDataDir
- **src/scraper.js** - LinkedIn DOM extraction logic and Sales Navigator navigation
- **src/qualifier.js** - Claude API integration for lead scoring and manual review prompt generation
- **src/stats.js** - Daily quota tracking persisted to `data/stats.json`
- **src/utils.js** - Normal distribution delay generator (Box-Muller transform), human-like random actions
- **src/config.js** - Configuration loader (not included in analysis but loads from config.json)

### Data Flow

1. **Scraping**: Browser → Sales Navigator search → Click profile links (human-like) → Extract profiles → Use back button to return → Save to `profiles/*.json` → Update stats
2. **Qualification (MCP)**: Claude Desktop → MCP Server → Load unqualified profile → Return to Claude Desktop → Save qualification decision to `data/qualified/*.json` or `data/disqualified/*.json`
3. **Outreach**: Load qualified profiles → Navigate to profile → Send connection request → Track status in profile JSON

### Anti-Detection Strategy

The scraper implements several techniques to avoid LinkedIn detection:

- **Stealth Plugin**: Uses puppeteer-extra-plugin-stealth to mask automation signatures
- **Persistent Profile**: Maintains chrome-profile directory with userDataDir to preserve cookies and browser fingerprint
- **Human-like Navigation**: Clicks profile links in search results instead of direct URL navigation (page.goto), uses browser back button (page.goBack) to return to search
- **Variable Delays**: Random delays (1.5-3 seconds) after navigation using randomDelay() helper function
- **Normal Distribution Delays**: Generates human-like delays using Box-Muller transform (3-8 seconds configurable)
- **Random Actions**: 20% chance of random scrolling, mouse movements, or UI interactions between profiles
- **Daily Limits**: Hard-coded quota system (default 80 profiles/day) tracked in stats.json
- **Session Persistence**: Saves cookies to `data/cookies.json` to avoid repeated logins

**Navigation Pattern** (scraper.js:474-512):
1. Find profile links on search results page
2. Click link element (not direct URL navigation) → wait for navigation
3. Add random delay (1.5-3s)
4. Scrape profile data
5. Use browser back button to return to search → wait with random delay
6. Repeat for next profile

This mimics human browsing behavior and avoids LinkedIn's bot detection patterns.

### DOM Selectors

The scraper targets LinkedIn's specific class names (as of implementation):

- Profile name: `.text-heading-xlarge`
- Title: `.text-body-medium.break-words`
- Location: `.text-body-small.inline.t-black--light.break-words`
- Experience section: `#experience` anchor → `.pvs-list__paged-list-item` items
- Education section: `#education` anchor → `.pvs-list__paged-list-item` items

**Note**: These selectors may break if LinkedIn updates their UI. Check scraper.js:59-151 for current implementation.

### Configuration System

Configuration is loaded from `config.json` (created from `config.template.json`):

- **linkedin**: Email/password credentials
- **limits**: Daily quota, delay ranges, standard deviation for normal distribution
- **qualification**: Criteria array, ideal profile description, disqualifiers, minimum score threshold
- **browser**: userDataDir path, headless mode, viewport dimensions

## Common Development Commands

### Running Commands

```bash
# Test login and save session
npm run login

# Scrape profiles from Sales Navigator
npm run scrape -- --url "SALES_NAV_URL" --number 20

# Export profiles to markdown for manual review (optional)
npm run export

# Check if a profile URL has already been scraped
npm run check -- check "PROFILE_URL"

# List all scraped profiles with qualification status
npm run check list

# Send connection request to a qualified lead
npm run outreach -- "PROFILE_URL"

# View statistics
npm run stats

# Show current config (sanitized)
npm run start config

# Start MCP server for Claude Desktop qualification
npm run mcp
```

### Directory Structure

```
profiles/              # Scraped profiles as JSON (profile_<timestamp>_<name>.json)
data/
  stats.json          # Daily quota tracking and qualification counts
  cookies.json        # LinkedIn session cookies
  qualified/          # Qualified prospects with AI analysis and outreach tracking
  disqualified/       # Disqualified prospects for record keeping
  profiles_for_review.md  # Exported markdown for manual review (optional)
chrome-profile/       # Persistent browser profile (gitignored)
config.json           # User configuration (gitignored)
src/
  mcp-server.js       # Model Context Protocol server for Claude Desktop
  outreach.js         # Connection request automation
  check-profile.js    # Duplicate detection utility
```

## Key Implementation Details

### Rate Limiting Logic

- Stats are keyed by date string (YYYY-MM-DD) in stats.json
- Before each profile view, `canViewMoreProfiles()` checks daily quota
- `incrementProfileViews()` updates both daily and total counters
- The system stops scraping when limit is reached (stats.js:73-76)

### Session Management

Login flow (browser.js:152-174):
1. Try loading cookies from `data/cookies.json`
2. Navigate to /feed to test if session is valid
3. If invalid, perform full login with credentials
4. Handle verification challenges with 2-minute timeout for manual completion
5. Save cookies on successful login

### Lead Qualification Workflow (MCP Server)

The system uses a Model Context Protocol (MCP) server that integrates with Claude Desktop for lead qualification:

**Setup** (src/mcp-server.js):
1. Start MCP server: `npm run mcp`
2. Configure Claude Desktop to connect to the MCP server
3. MCP server exposes tools: `get_next_profile`, `save_qualification`, `get_qualification_criteria`, `get_stats`

**Qualification Flow**:
1. Open Claude Desktop and say: "Get the next LinkedIn profile to qualify"
2. Claude Desktop calls `get_next_profile` via MCP → returns unqualified profile with full data
3. Claude Desktop calls `get_qualification_criteria` → returns criteria from config.json
4. Claude Desktop analyzes profile against criteria and generates structured analysis
5. Claude Desktop calls `save_qualification` with results → saves to `data/qualified/` or `data/disqualified/`
6. Profile includes: qualified (bool), score (0-100), reasoning, strengths, concerns, recommendedApproach
7. Repeat for next profile

**Benefits**:
- Zero API costs (uses your existing Claude Desktop subscription)
- Interactive qualification with ability to ask follow-up questions
- Automatic tracking of qualified vs disqualified profiles
- Stats updated in real-time

### Connection Request Tracking

Qualified profiles track outreach status (src/outreach.js:36-55):
- **connection_request.status**: "not_sent", "pending", "accepted", "already_connected"
- **connection_request.sentAt**: ISO timestamp
- **connection_request.connection_message**: Custom message sent (if any)
- **connection_request.error**: Error message if request failed

Status is automatically updated when running `npm run outreach`

## Important Considerations

### LinkedIn ToS Compliance

This tool operates in a gray area of LinkedIn's terms of service. The codebase includes safety features (rate limiting, human-like behavior) but users are responsible for ethical usage. Code should not be modified to bypass rate limits or detection mechanisms beyond what's already implemented.

### Selector Fragility

LinkedIn frequently updates their DOM structure. If scraping fails, check these files first:
- scraper.js:59-151 (profile data extraction selectors)
- scraper.js:204-210 (Sales Navigator search result selectors)

### Error Handling

The scraper continues on individual profile errors (scraper.js:168-172) and increments error count in stats. It does not retry failed profiles to avoid infinite loops.

### Puppeteer Configuration

- **headless: false** by default - allows monitoring and manual intervention for verification
- **userDataDir** must persist between runs - browser profile contains login state
- Stealth plugin must be applied before launch (browser.js:15)

## Testing & Debugging

Start with small batches:
```bash
# Test with 5 profiles
npm run scrape -- --url "URL" --number 5

# Check what was scraped
ls -la profiles/
npm run check list

# Test MCP server qualification
npm run mcp  # In one terminal
# Then open Claude Desktop and say "Get the next LinkedIn profile to qualify"

# Test outreach on a qualified lead
npm run check list  # Find a qualified profile
npm run outreach -- "PROFILE_URL"
```

Monitor the browser window during scraping to observe human-like behavior and catch verification challenges.
