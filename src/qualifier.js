import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { loadAllProfiles } from './scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Build qualification prompt for manual review
 * Used by export command and MCP server
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
 * Export profiles for manual review with Claude Desktop (via MCP)
 */
export function exportProfilesForReview() {
  const profiles = loadAllProfiles();

  if (profiles.length === 0) {
    console.log('No profiles found to export.');
    console.log('Run the scrape command first to collect profiles.');
    return;
  }

  const dataDir = join(PROJECT_ROOT, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const exportFile = join(dataDir, 'profiles_for_review.md');

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
  console.log('\nTo qualify these profiles:');
  console.log('1. Open Claude Desktop (not Claude Code)');
  console.log('2. Say: "Get the next LinkedIn profile to qualify"');
  console.log('3. Claude Desktop will use the MCP server to fetch and analyze profiles');
  console.log('4. Alternatively, open this markdown file and review manually\n');
}
