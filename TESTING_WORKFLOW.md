# Testing Workflow - Use Claude Code Instead of API

This guide shows you how to test the LinkedIn scraper using Claude Code for manual qualification, avoiding API costs while you refine your criteria.

## Why This Approach?

- **No API costs** during testing and development
- **Interactive refinement** of qualification criteria
- **Learn patterns** in good vs bad leads
- **Quality control** before automating
- **Easy switching** to automated mode later

## Complete Testing Workflow

### 1. Setup (One Time)

```bash
cd linkedin-outreach-helper
cp config.template.json config.json
```

Edit `config.json`:
- Add your LinkedIn email/password
- **Skip the API key** (leave it as "your-anthropic-api-key")
- Customize qualification criteria for your target audience

### 2. Test Scraping

Start with a small test:

```bash
npm run start login
# Test your LinkedIn login, complete any 2FA

npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 5
# Scrape just 5 profiles to test
```

### 3. Export Profiles

```bash
npm run export
```

This creates `data/profiles_for_review.md` with:
- Your qualification criteria
- All scraped profiles nicely formatted
- Checkboxes and spaces for notes

### 4. Review Profiles with Claude Code

Two ways to review:

#### Method A: One-by-one (Interactive)

```bash
npm run review -- --index 1
```

This outputs a prompt like:

```
Profile 1 of 5
Name: John Doe
Title: VP of Engineering
Company: Acme Corp

================================================================================

Copy and paste this prompt to Claude Code:

================================================================================

You are a lead qualification expert. Analyze this LinkedIn profile...

[Full profile data and qualification criteria]

================================================================================

Next profile: npm run start review -- --index 2
```

**What to do:**
1. Copy everything between the equal signs
2. Paste it to me (Claude Code)
3. I'll analyze it and give you:
   - Qualified: Yes/No
   - Score: 0-100
   - Reasoning
   - Strengths and concerns
   - Recommended approach

4. Move to next profile:
```bash
npm run review -- --index 2
```

#### Method B: Batch Review (Markdown)

1. Open `data/profiles_for_review.md` in your editor
2. Copy 2-3 profile sections at a time
3. Paste to Claude Code: "Analyze these profiles based on the criteria at the top"
4. I'll give you qualification feedback for all of them

### 5. Refine Criteria

Based on the feedback:

1. Edit `config.json` to update your qualification criteria
2. Run `npm run export` again to regenerate the markdown
3. Review more profiles with updated criteria
4. Repeat until you're happy with the results

### 6. Scale Up

Once you've validated your criteria:

```bash
# Scrape more profiles
npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 20

# Export and review
npm run export
npm run review -- --index 1
```

### 7. Switch to Automated (Optional)

When ready for production:

1. Add your Anthropic API key to `config.json`
2. Run `npm run qualify` to automatically process all profiles
3. Qualified leads saved to `data/qualified/`

## Daily Testing Workflow

```bash
# Morning: Scrape new batch
npm run scrape -- --url "YOUR_URL" --number 10

# Afternoon: Export for review
npm run export

# Review as you have time
npm run review -- --index 1
# Copy/paste to Claude Code, get feedback

npm run review -- --index 2
# Repeat...

# Evening: Check stats
npm run stats
```

## Tips for Effective Testing

### Start Small
- Scrape 5-10 profiles first
- Don't try to process 80 profiles manually
- Quality over quantity during testing

### Take Notes
- Keep notes on what makes a good lead
- Document patterns you see
- Update criteria based on learnings

### Iterate Quickly
- Test criteria → Get feedback → Refine → Repeat
- Don't try to get perfect criteria on first try
- Real profiles will teach you more than theory

### Use Both Methods
- Use `npm run review` for detailed one-by-one analysis
- Use the markdown export for quick batch scanning
- Mix approaches based on your workflow

### Track Your Learnings
Create a notes file:
```bash
# Add to your notes
echo "## Learning: $(date)" >> LEARNINGS.md
echo "- Good leads tend to have X" >> LEARNINGS.md
echo "- Red flag: Y always fails" >> LEARNINGS.md
```

## Example Session

```bash
# Setup
cp config.template.json config.json
vim config.json  # Add LinkedIn creds, skip API key

# First test
npm run start login
npm run scrape -- --url "https://..." --number 3

# Review
npm run export
npm run review -- --index 1
# Paste to Claude Code: "Too junior, score 35/100"

npm run review -- --index 2
# Paste to Claude Code: "Perfect fit! Score 92/100"

npm run review -- --index 3
# Paste to Claude Code: "Wrong industry, score 20/100"

# Refine criteria based on feedback
vim config.json  # Update criteria

# Test again with new criteria
npm run scrape -- --url "https://..." --number 5
npm run export
# Review and iterate...

# Check stats
npm run stats
```

## Switching to Production

When you're ready:

```bash
# 1. Add API key to config.json
vim config.json

# 2. Test automated qualification on existing profiles
npm run qualify

# 3. Check results in data/qualified/
ls data/qualified/

# 4. If good, use for production
npm run scrape -- --url "YOUR_URL" --number 50
npm run qualify
npm run stats
```

## Advantages Over Direct API Use

1. **Interactive**: Get immediate feedback and clarification
2. **Educational**: Learn what makes a good lead
3. **Cost-effective**: No API charges during testing
4. **Flexible**: Can ask follow-up questions
5. **Quality**: Higher quality analysis with back-and-forth
6. **Fast iteration**: Update criteria and retest immediately

## Questions to Ask Claude Code

When reviewing profiles, ask me things like:

- "Is this profile a good fit for my criteria?"
- "What are the red flags here?"
- "How would you score this 0-100?"
- "What's the best way to approach this lead?"
- "Should I update my criteria based on this profile?"
- "Compare these 3 profiles - which is best?"

## Getting Help

If you need help with:
- Refining criteria: Share profiles and ask for suggestions
- Understanding patterns: Ask me to analyze your qualified/disqualified lists
- Scaling strategy: Ask about best practices for your use case
- Technical issues: Check README.md or ask me directly

Happy testing! 🚀
