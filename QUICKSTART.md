# Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd linkedin-outreach-helper
npm install
```

## Step 2: Configure

```bash
# Copy the template
cp config.template.json config.json

# Edit with your credentials
# - Add your LinkedIn email/password
# - Add your Anthropic API key (get one at https://console.anthropic.com/)
# - Customize qualification criteria for your target audience
```

## Step 3: Test Login (Optional but Recommended)

```bash
npm run start login
```

This will:
- Open a browser window
- Log you into LinkedIn
- Save your session for future use
- Let you complete any 2FA/verification

## Step 4: Get Your Sales Navigator URL

1. Go to LinkedIn Sales Navigator
2. Perform a search (e.g., "VP of Engineering in San Francisco")
3. Apply your filters (location, company size, etc.)
4. Copy the entire URL from your browser address bar

It should look like:
```
https://www.linkedin.com/sales/search/people?query=(filters...)
```

## Step 5: Scrape Profiles

```bash
npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 10
```

Replace `YOUR_SALES_NAV_URL` with the URL you copied. Start with 10 profiles.

Example:
```bash
npm run scrape -- --url "https://www.linkedin.com/sales/search/people?query=(recentSearchParam:(...))" --number 10
```

This will:
- Open browser (you can watch it work)
- Navigate to your search
- Scrape 10 profiles with human-like delays
- Save them to `profiles/` directory

## Step 6: Qualify Leads

### Option A: Manual Review (Testing - No API Costs)

Perfect for testing and refining your criteria:

```bash
# Export all profiles to markdown
npm run export

# Review profiles one by one with Claude Code
npm run review -- --index 1
# Copy the prompt and paste it to Claude Code for analysis
```

See `MANUAL_REVIEW.md` for full details on the manual review workflow.

### Option B: Automated Qualification (Production - Uses API)

Once you have your API key set up:

```bash
npm run qualify
```

This will:
- Send each profile to Claude AI
- Get a qualification score and reasoning
- Save qualified prospects to `data/qualified/`

## Step 7: View Stats

```bash
npm run stats
```

See your:
- Today's activity and remaining quota
- Qualified vs disqualified counts
- All-time statistics

## Step 8: Check Your Qualified Leads

```bash
ls data/qualified/
cat data/qualified/qualified_*.json
```

Each qualified prospect includes:
- Full profile data
- Qualification score (0-100)
- Reasoning for qualification
- Recommended approach for outreach

## Daily Workflow

Run this daily for best results:

```bash
# Morning: Scrape new profiles (respects daily limit)
npm run scrape -- --url "YOUR_SEARCH_URL" --number 20

# Afternoon: Qualify the leads
npm run qualify

# Evening: Check your stats and review qualified prospects
npm run stats
```

## Tips

- **Start small**: Test with 5-10 profiles first
- **Watch it work**: The browser opens so you can monitor
- **Stay under limits**: Keep to 50-80 profiles/day max
- **Refine criteria**: Adjust config.json based on qualification results
- **Run daily**: Better than bulk scraping

## Common Issues

**"Daily limit reached"**
- Wait until tomorrow, or adjust `maxProfileViewsPerDay` in config.json

**"Login failed"**
- Double-check credentials in config.json
- Run `npm run start login` to test
- Complete verification in browser window

**"No profiles found"**
- Verify your Sales Navigator URL has `/sales/search/people`
- Make sure the search has results in Sales Navigator

## Need Help?

Check the full README.md for detailed documentation.

Happy prospecting! 🚀
