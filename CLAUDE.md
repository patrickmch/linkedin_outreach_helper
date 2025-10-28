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

1. **Scraping**: Browser → Sales Navigator URL → Extract profiles → Save to `profiles/*.json` → Update stats
2. **Qualification**: Load profiles → Build prompt with criteria → Claude API → Save qualified to `data/qualified/*.json`
3. **Manual Review**: Load profiles → Generate prompts → Export to markdown for manual analysis

### Anti-Detection Strategy

The scraper implements several techniques to avoid LinkedIn detection:

- **Stealth Plugin**: Uses puppeteer-extra-plugin-stealth to mask automation signatures
- **Persistent Profile**: Maintains chrome-profile directory with userDataDir to preserve cookies and browser fingerprint
- **Normal Distribution Delays**: Generates human-like delays using Box-Muller transform (3-8 seconds configurable)
- **Random Actions**: 20% chance of random scrolling, mouse movements, or UI interactions between profiles
- **Daily Limits**: Hard-coded quota system (default 80 profiles/day) tracked in stats.json
- **Session Persistence**: Saves cookies to `data/cookies.json` to avoid repeated logins

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
- **claude**: API key (optional - can use manual review mode without API)
- **limits**: Daily quota, delay ranges, standard deviation for normal distribution
- **qualification**: Criteria array, ideal profile description, disqualifiers
- **browser**: userDataDir path, headless mode, viewport dimensions

## Common Development Commands

### Running Commands

```bash
# Test login and save session
npm run start login

# Scrape profiles from Sales Navigator
npm run scrape -- --url "SALES_NAV_URL" --number 20

# Qualify profiles using Claude API (requires API key)
npm run qualify

# Export profiles to markdown for manual review
npm run export

# Generate qualification prompt for specific profile
npm run review -- --index 1

# View statistics
npm run stats

# Show current config (sanitized)
npm run start config
```

### Directory Structure

```
profiles/              # Scraped profiles as JSON (profile_<timestamp>_<name>.json)
data/
  stats.json          # Daily quota tracking and qualification counts
  cookies.json        # LinkedIn session cookies
  qualified/          # Qualified prospects with AI analysis
  profiles_for_review.md  # Exported markdown for manual review
chrome-profile/       # Persistent browser profile (gitignored)
config.json           # User configuration (gitignored)
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

### Claude API Integration

Qualification uses structured prompts (qualifier.js:58-102):
- Model: `claude-3-5-sonnet-20241022`
- Max tokens: 1024
- Returns JSON with: qualified (bool), score (0-100), reasoning, strengths, concerns, recommendedApproach
- Cost: ~$0.003 per profile

### Manual Review Workflow

Alternative to API qualification (zero cost):
1. `npm run export` generates markdown with all profiles
2. `npm run review --index N` creates qualification prompt for specific profile
3. User copies prompt to Claude Code for interactive analysis
4. Iterates through profiles without API consumption

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

# Test qualification prompt without API
npm run export
npm run review -- --index 1
```

Monitor the browser window during scraping to observe human-like behavior and catch verification challenges.
