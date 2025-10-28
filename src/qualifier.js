import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { loadAllProfiles } from './scraper.js';
import { incrementQualified, incrementDisqualified } from './stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const QUALIFIED_DIR = join(PROJECT_ROOT, 'data', 'qualified');

/**
 * Initialize Claude API client (only if API key is provided)
 */
let anthropic = null;
if (config.claude?.apiKey && config.claude.apiKey !== 'your-anthropic-api-key') {
  anthropic = new Anthropic({
    apiKey: config.claude.apiKey
  });
}

/**
 * Ensure qualified directory exists
 */
function ensureQualifiedDir() {
  if (!existsSync(QUALIFIED_DIR)) {
    mkdirSync(QUALIFIED_DIR, { recursive: true });
  }
}

/**
 * Save qualified prospect
 */
function saveQualifiedProspect(profile, analysis) {
  ensureQualifiedDir();
  const timestamp = Date.now();
  const filename = `qualified_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  const filepath = join(QUALIFIED_DIR, filename);

  const prospect = {
    ...profile,
    qualification: {
      isQualified: true,
      analysis: analysis,
      qualifiedAt: new Date().toISOString()
    }
  };

  writeFileSync(filepath, JSON.stringify(prospect, null, 2));
  return filepath;
}

/**
 * Build qualification prompt
 */
export function buildQualificationPrompt(profile) {
  const criteriaText = config.qualification.criteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  const disqualifiersText = config.qualification.disqualifiers
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n');

  return `You are a lead qualification expert. Analyze this LinkedIn profile and determine if they match our ideal customer profile.

IDEAL CUSTOMER PROFILE:
${config.qualification.idealProfile}

QUALIFICATION CRITERIA:
${criteriaText}

DISQUALIFIERS:
${disqualifiersText}

PROFILE TO ANALYZE:
Name: ${profile.name}
Title: ${profile.title}
Company: ${profile.company}
Location: ${profile.location}
About: ${profile.about || 'N/A'}

Experience:
${profile.experience.map(exp => `- ${exp.title} at ${exp.company} (${exp.dates})`).join('\n') || 'N/A'}

Education:
${profile.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n') || 'N/A'}

Please analyze this profile and respond with a JSON object in the following format:
{
  "qualified": true or false,
  "score": 0-100,
  "reasoning": "Detailed explanation of why they are or aren't qualified",
  "strengths": ["list", "of", "positive", "points"],
  "concerns": ["list", "of", "concerns", "or", "red", "flags"],
  "recommendedApproach": "If qualified, suggest how to approach this lead"
}

Respond ONLY with the JSON object, no additional text.`;
}

/**
 * Qualify a single profile using Claude API
 */
export async function qualifyProfile(profile) {
  if (!anthropic) {
    throw new Error('Claude API client not initialized. Check your API key in config.json');
  }

  try {
    console.log(`\nQualifying: ${profile.name}`);
    console.log(`  Title: ${profile.title}`);
    console.log(`  Company: ${profile.company}`);

    const prompt = buildQualificationPrompt(profile);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Parse the response
    const responseText = response.content[0].text;
    const analysis = JSON.parse(responseText);

    console.log(`  Score: ${analysis.score}/100`);
    console.log(`  Qualified: ${analysis.qualified ? '✓ YES' : '✗ NO'}`);
    console.log(`  Reasoning: ${analysis.reasoning}`);

    if (analysis.qualified) {
      const filepath = saveQualifiedProspect(profile, analysis);
      console.log(`  ✓ Saved to qualified prospects`);
      incrementQualified();
    } else {
      console.log(`  ✗ Disqualified`);
      incrementDisqualified();
    }

    return {
      profile,
      analysis,
      qualified: analysis.qualified
    };
  } catch (error) {
    console.error(`  Error qualifying profile:`, error.message);
    return {
      profile,
      analysis: null,
      qualified: false,
      error: error.message
    };
  }
}

/**
 * Export profiles for manual review with Claude Code
 */
export function exportProfilesForReview() {
  const profiles = loadAllProfiles();

  if (profiles.length === 0) {
    console.log('No profiles found to export.');
    console.log('Run the scrape command first to collect profiles.');
    return;
  }

  const exportFile = join(PROJECT_ROOT, 'data', 'profiles_for_review.md');

  let markdown = `# Profiles for Review\n\n`;
  markdown += `Total profiles: ${profiles.length}\n\n`;
  markdown += `## Qualification Criteria\n\n`;
  markdown += `**Ideal Profile:** ${config.qualification.idealProfile}\n\n`;
  markdown += `**Criteria:**\n`;
  config.qualification.criteria.forEach((c, i) => {
    markdown += `${i + 1}. ${c}\n`;
  });
  markdown += `\n**Disqualifiers:**\n`;
  config.qualification.disqualifiers.forEach((d, i) => {
    markdown += `${i + 1}. ${d}\n`;
  });
  markdown += `\n---\n\n`;

  profiles.forEach((profile, index) => {
    markdown += `## ${index + 1}. ${profile.name}\n\n`;
    markdown += `- **Title:** ${profile.title}\n`;
    markdown += `- **Company:** ${profile.company}\n`;
    markdown += `- **Location:** ${profile.location}\n`;
    markdown += `- **URL:** ${profile.url}\n`;
    markdown += `- **Scraped:** ${new Date(profile.scrapedAt).toLocaleString()}\n\n`;

    if (profile.about) {
      markdown += `**About:**\n${profile.about}\n\n`;
    }

    if (profile.experience && profile.experience.length > 0) {
      markdown += `**Experience:**\n`;
      profile.experience.forEach(exp => {
        markdown += `- ${exp.title} at ${exp.company}`;
        if (exp.dates) markdown += ` (${exp.dates})`;
        markdown += `\n`;
      });
      markdown += `\n`;
    }

    if (profile.education && profile.education.length > 0) {
      markdown += `**Education:**\n`;
      profile.education.forEach(edu => {
        markdown += `- ${edu.degree} from ${edu.school}\n`;
      });
      markdown += `\n`;
    }

    markdown += `**Qualified?** [ ] Yes [ ] No\n`;
    markdown += `**Score:** ___ / 100\n`;
    markdown += `**Notes:**\n\n\n`;
    markdown += `---\n\n`;
  });

  writeFileSync(exportFile, markdown);

  console.log(`\n✓ Exported ${profiles.length} profiles to: ${exportFile}`);
  console.log('\nYou can now:');
  console.log('1. Open this file in your editor');
  console.log('2. Paste sections to Claude Code for qualification analysis');
  console.log('3. Use the qualification prompt to get structured feedback\n');
}

/**
 * Qualify all unqualified profiles
 */
export async function qualifyAllProfiles() {
  console.log('\n=== Starting Lead Qualification ===\n');

  const profiles = loadAllProfiles();

  if (profiles.length === 0) {
    console.log('No profiles found to qualify.');
    console.log('Run the scrape command first to collect profiles.');
    return [];
  }

  console.log(`Found ${profiles.length} profiles to qualify`);

  const results = [];

  for (const profile of profiles) {
    const result = await qualifyProfile(profile);
    results.push(result);

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const qualifiedCount = results.filter((r) => r.qualified).length;
  const disqualifiedCount = results.filter((r) => !r.qualified).length;

  console.log(`\n=== Qualification Complete ===`);
  console.log(`Qualified: ${qualifiedCount}`);
  console.log(`Disqualified: ${disqualifiedCount}`);
  console.log(`Total: ${results.length}`);

  if (qualifiedCount > 0) {
    console.log(`\nQualified prospects saved to: ${QUALIFIED_DIR}`);
  }

  return results;
}

/**
 * Get summary of qualified prospects
 */
export function getQualifiedSummary() {
  ensureQualifiedDir();
  const { readdirSync, readFileSync } = await import('fs');

  const files = readdirSync(QUALIFIED_DIR).filter((file) => file.endsWith('.json'));

  console.log(`\n=== Qualified Prospects (${files.length}) ===\n`);

  files.forEach((file, index) => {
    try {
      const filepath = join(QUALIFIED_DIR, file);
      const data = readFileSync(filepath, 'utf8');
      const prospect = JSON.parse(data);

      console.log(`${index + 1}. ${prospect.name}`);
      console.log(`   Title: ${prospect.title}`);
      console.log(`   Company: ${prospect.company}`);
      console.log(`   Score: ${prospect.qualification.analysis.score}/100`);
      console.log(`   Approach: ${prospect.qualification.analysis.recommendedApproach}`);
      console.log(`   URL: ${prospect.url}`);
      console.log('');
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  });
}
