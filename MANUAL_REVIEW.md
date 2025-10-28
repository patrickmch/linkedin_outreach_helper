# Manual Review with Claude Code

Use Claude Code to manually review and qualify leads without API costs - perfect for testing!

## Quick Start

### 1. Export Profiles for Review

After scraping profiles, export them to a markdown file:

```bash
npm run export
```

This creates `data/profiles_for_review.md` with all your scraped profiles in an easy-to-read format.

### 2. Review Individual Profiles

Get the qualification prompt for a specific profile:

```bash
npm run review
```

Or review a specific profile by index:

```bash
npm run review -- --index 2
```

This will output a formatted prompt you can copy and paste to Claude Code.

### 3. Paste to Claude Code

The `review` command outputs a complete qualification prompt. Simply:

1. Copy the prompt from your terminal
2. Paste it to Claude Code
3. I'll analyze the profile and give you structured feedback

### 4. Iterate Through Profiles

The `review` command tells you the next command to run:

```bash
npm run start review -- --index 1
npm run start review -- --index 2
npm run start review -- --index 3
```

## Example Workflow

```bash
# Step 1: Scrape some profiles
npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 5

# Step 2: Export all profiles to markdown
npm run export

# Step 3: Review profiles one by one
npm run review -- --index 1
# Copy/paste the output to Claude Code
# Get qualification feedback
# Move to next profile

npm run review -- --index 2
# Repeat...
```

## Using the Markdown Export

The markdown export (`data/profiles_for_review.md`) includes:

- Your qualification criteria at the top
- Each profile formatted nicely with checkboxes
- Space for notes and scores

You can:
- Open it in your editor
- Copy sections to Claude Code for batch review
- Use it as a reference while reviewing
- Add your own notes directly in the file

## Benefits of Manual Review

**For Testing:**
- No API costs while you refine your criteria
- Learn what makes a good/bad lead for your use case
- Test the scraper without worrying about qualification quality

**For Production:**
- Quality control - review edge cases manually
- Train your eye to spot good leads
- Supplement automated qualification for high-value prospects

## Switching to Automated Qualification

Once you're happy with your criteria, you can switch to automated qualification:

1. Add your Anthropic API key to `config.json`
2. Run `npm run qualify` to automatically qualify all profiles
3. Profiles will be scored and saved to `data/qualified/`

## Tips

- **Start small**: Scrape 5-10 profiles first, review them manually
- **Refine criteria**: Update `config.json` based on what you learn
- **Batch review**: Copy multiple profiles from the markdown export
- **Take notes**: The markdown file is yours to annotate
- **Mix approaches**: Use manual review for high-value leads, automated for volume

## Example Prompt Usage

When you run `npm run review`, you'll get output like this:

```
Profile 1 of 5
Name: John Doe
Title: VP of Engineering
Company: Acme Corp

================================================================================

Copy and paste this prompt to Claude Code:

================================================================================

You are a lead qualification expert. Analyze this LinkedIn profile...

[Full qualification prompt with profile details]

================================================================================

Next profile: npm run start review -- --index 2
```

Just copy everything between the equal signs and paste it to me!

## Profile Format

Each profile includes:
- Name, title, company, location
- LinkedIn URL
- About section
- Work experience with dates
- Education

All the data you need to make an informed qualification decision.
