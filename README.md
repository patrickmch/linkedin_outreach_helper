# LinkedIn Outreach Helper

An intelligent LinkedIn Sales Navigator scraper with AI-powered lead qualification using Claude API.

## Features

- **Stealth Scraping**: Uses Puppeteer-extra with Stealth plugin to avoid detection
- **Persistent Sessions**: Maintains Chrome profile and cookies to avoid re-login
- **Rate Limiting**: Configurable daily limits (default: 80 profiles/day) with stats tracking
- **Human-like Behavior**:
  - Normal distribution delays (not uniform random)
  - Random human actions (scrolling, mouse movements, checking notifications)
  - 3-8 second delays between actions
- **AI Lead Qualification**: Uses Claude API to automatically qualify leads based on your criteria
- **Data Persistence**: Saves all profiles and qualified prospects to JSON files
- **CLI Interface**: Easy-to-use commands for scraping, qualifying, and viewing stats

## Safety Features

- Runs with `headless: false` so you can monitor activity
- Uses persistent Chrome profile with `userDataDir`
- Limits to 80 profile views per day (configurable)
- Random delays between 3-8 seconds using normal distribution
- Saves cookies to avoid re-login
- Tracks daily limits in stats file
- Occasional random human actions to mimic real behavior

## Installation

1. Clone or navigate to the project directory:
```bash
cd linkedin-outreach-helper
```

2. Install dependencies:
```bash
npm install
```

3. Configure your credentials:
```bash
cp config.template.json config.json
```

4. Edit `config.json` and fill in:
   - Your LinkedIn email and password
   - Your Anthropic API key
   - Your qualification criteria
   - Daily limits (optional)

## Configuration

Edit `config.json` to customize:

### LinkedIn Credentials
```json
"linkedin": {
  "email": "your-email@example.com",
  "password": "your-password"
}
```

### Claude API Key
```json
"claude": {
  "apiKey": "sk-ant-..."
}
```

### Rate Limits
```json
"limits": {
  "maxProfileViewsPerDay": 80,
  "minDelaySeconds": 3,
  "maxDelaySeconds": 8,
  "delayStdDev": 1.5
}
```

### Qualification Criteria
Customize to match your ideal customer profile:
```json
"qualification": {
  "criteria": [
    "Works in B2B SaaS companies",
    "Has decision-making authority (Director, VP, C-level)",
    "Located in North America or Europe"
  ],
  "idealProfile": "Senior leaders in B2B SaaS...",
  "disqualifiers": [
    "Works in unrelated industries",
    "Junior positions without authority"
  ]
}
```

## Usage

### 1. Test Login (Optional)
Test your LinkedIn login and save the session:
```bash
npm run start login
```

### 2. Scrape Profiles
Scrape profiles from a Sales Navigator search:

```bash
npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 20
```

**To get your Sales Navigator URL:**
1. Go to LinkedIn Sales Navigator
2. Perform a search with your filters
3. Copy the URL from your browser
4. Use that URL in the command above

Example:
```bash
npm run scrape -- --url "https://www.linkedin.com/sales/search/people?query=(filters...)" --number 15
```

### 3. Qualify Leads

#### Option A: Manual Review (Perfect for Testing!)

Test without API costs using Claude Code:

```bash
# Export profiles to markdown
npm run export

# Review profiles one-by-one
npm run review -- --index 1
# Copy the prompt to Claude Code and get qualification feedback
```

**Benefits:**
- No API costs during testing
- Refine your criteria interactively
- Learn what makes a good lead for your use case
- See `MANUAL_REVIEW.md` for the complete workflow

#### Option B: Automated Qualification

Run AI qualification on all scraped profiles:
```bash
npm run qualify
```

This will:
- Analyze each profile using Claude API
- Score each lead (0-100)
- Determine if they match your criteria
- Save qualified prospects to `data/qualified/`

### 4. View Statistics
Display your scraping and qualification stats:
```bash
npm run stats
```

Shows:
- Today's profile views and remaining quota
- Qualified vs disqualified counts
- All-time statistics
- Recent daily activity

### 5. View Configuration
Display your current configuration (with sensitive data masked):
```bash
npm run start config
```

### 6. Export for Manual Review
Export all profiles to markdown format:
```bash
npm run export
```

Creates `data/profiles_for_review.md` with all profiles formatted for easy review.

### 7. Review Individual Profiles
Get qualification prompt for a specific profile:
```bash
npm run review -- --index 1
```

Perfect for manually reviewing profiles with Claude Code. The command outputs a formatted prompt you can copy and paste.

## Directory Structure

```
linkedin-outreach-helper/
├── src/
│   ├── index.js          # CLI interface
│   ├── config.js         # Configuration loader
│   ├── browser.js        # Browser automation
│   ├── scraper.js        # LinkedIn scraping logic
│   ├── qualifier.js      # Claude AI qualification
│   ├── stats.js          # Statistics tracking
│   └── utils.js          # Utility functions
├── data/
│   ├── stats.json        # Daily statistics
│   ├── cookies.json      # Saved session cookies
│   └── qualified/        # Qualified prospects (JSON)
├── profiles/             # All scraped profiles (JSON)
├── chrome-profile/       # Persistent Chrome profile
├── config.json           # Your configuration (not committed)
├── config.template.json  # Configuration template
└── package.json
```

## How It Works

### Scraping Process
1. Launches Chrome with stealth plugin and persistent profile
2. Loads saved cookies or logs in if needed
3. Navigates to your Sales Navigator search URL
4. Extracts profile data (name, title, company, location, experience, education)
5. Saves each profile to `profiles/` directory
6. Uses normal distribution for delays (3-8 seconds)
7. Performs random human-like actions between profiles
8. Tracks daily view count and respects limits

### Qualification Process
1. Loads all scraped profiles from `profiles/` directory
2. For each profile, sends data to Claude API with your criteria
3. Claude analyzes and scores the profile (0-100)
4. Returns qualification decision with reasoning
5. Saves qualified prospects to `data/qualified/`
6. Updates statistics

## Best Practices

1. **Start Small**: Test with 5-10 profiles before scaling up
2. **Daily Limits**: Keep under 80 profiles/day to avoid LinkedIn flags
3. **Use Sales Navigator**: Regular LinkedIn has stricter rate limits
4. **Monitor First Run**: Watch the browser to ensure everything works
5. **Refine Criteria**: Adjust qualification criteria based on results
6. **Regular Sessions**: Run daily rather than bulk scraping
7. **Check Stats**: Monitor your stats regularly with `npm run stats`

## Safety & Ethics

This tool is for legitimate lead generation purposes only:

- ✅ Use for B2B outreach to qualified prospects
- ✅ Respect LinkedIn's terms of service
- ✅ Keep within reasonable rate limits
- ✅ Use with Sales Navigator (designed for sales activities)
- ❌ Don't use for spam or mass messaging
- ❌ Don't exceed reasonable daily limits
- ❌ Don't scrape personal data for unauthorized purposes

**Remember**: This tool should be used responsibly and in compliance with LinkedIn's terms of service and applicable laws.

## Troubleshooting

### "Daily limit reached"
Wait until the next day, or increase `maxProfileViewsPerDay` in config.json (not recommended above 80).

### "Login failed"
1. Check your credentials in config.json
2. Try the `npm run start login` command to test
3. Complete any verification challenges in the browser
4. LinkedIn may require 2FA - complete it in the browser window

### "No profiles found"
1. Verify your Sales Navigator search URL is correct
2. Make sure you're logged into Sales Navigator (not just regular LinkedIn)
3. Check that your search has results

### Chrome profile errors
Delete the `chrome-profile/` directory and try again:
```bash
rm -rf chrome-profile/
```

## API Costs

This tool uses the Claude API for lead qualification:
- Model: claude-3-5-sonnet-20241022
- Cost: ~$0.003 per profile qualification
- 100 profiles ≈ $0.30

Monitor your usage at: https://console.anthropic.com/

## License

MIT

## Disclaimer

This tool is provided as-is for legitimate lead generation purposes. Users are responsible for complying with LinkedIn's terms of service and all applicable laws. The authors assume no liability for misuse.
