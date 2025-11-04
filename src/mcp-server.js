#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { loadAllProfiles, findMostRecentCSV } from './csv-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const QUALIFIED_DIR = join(PROJECT_ROOT, 'data', 'qualified');
const DISQUALIFIED_DIR = join(PROJECT_ROOT, 'data', 'disqualified');

/**
 * Ensure qualified directory exists
 */
function ensureQualifiedDir() {
  if (!existsSync(QUALIFIED_DIR)) {
    mkdirSync(QUALIFIED_DIR, { recursive: true });
  }
}

/**
 * Ensure disqualified directory exists
 */
function ensureDisqualifiedDir() {
  if (!existsSync(DISQUALIFIED_DIR)) {
    mkdirSync(DISQUALIFIED_DIR, { recursive: true });
  }
}

/**
 * Get list of already processed profile names (qualified + disqualified)
 */
function getProcessedProfileNames() {
  const names = new Set();

  // Get qualified profiles
  ensureQualifiedDir();
  const qualifiedFiles = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  qualifiedFiles.forEach(file => {
    try {
      const filepath = join(QUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      names.add(data.name);
    } catch (error) {
      // Skip invalid files
    }
  });

  // Get disqualified profiles
  ensureDisqualifiedDir();
  const disqualifiedFiles = readdirSync(DISQUALIFIED_DIR).filter(f => f.endsWith('.json'));
  disqualifiedFiles.forEach(file => {
    try {
      const filepath = join(DISQUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      names.add(data.name);
    } catch (error) {
      // Skip invalid files
    }
  });

  return names;
}

/**
 * Get list of qualified profile names only
 */
function getQualifiedProfileNames() {
  ensureQualifiedDir();
  const files = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  const names = new Set();

  files.forEach(file => {
    try {
      const filepath = join(QUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      names.add(data.name);
    } catch (error) {
      // Skip invalid files
    }
  });

  return names;
}

/**
 * Get all qualified profiles
 */
function getQualifiedProfiles() {
  ensureQualifiedDir();
  const files = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  const profiles = [];

  files.forEach(file => {
    try {
      const filepath = join(QUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      profiles.push({ ...data, _filepath: filepath });
    } catch (error) {
      // Skip invalid files
    }
  });

  return profiles;
}

/**
 * Get next qualified profile to contact (not yet contacted)
 */
function getNextToContact() {
  const qualified = getQualifiedProfiles();

  // Find first profile that hasn't been contacted
  const uncontacted = qualified.find(p => !p.outreach || !p.outreach.contacted);

  return uncontacted || null;
}

/**
 * Mark profile as contacted
 */
function markAsContacted(profileName, notes = '') {
  const qualified = getQualifiedProfiles();
  const profile = qualified.find(p => p.name === profileName);

  if (!profile) {
    throw new Error(`Qualified profile not found: ${profileName}`);
  }

  // Update profile with outreach data
  profile.outreach = {
    contacted: true,
    contactedAt: new Date().toISOString(),
    notes: notes
  };

  // Remove internal filepath property
  delete profile._filepath;

  // Find the original file and update it
  const qualifiedFiles = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  let updated = false;

  for (const file of qualifiedFiles) {
    const filepath = join(QUALIFIED_DIR, file);
    try {
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      if (data.name === profileName) {
        // Update the file with new outreach data
        data.outreach = profile.outreach;
        writeFileSync(filepath, JSON.stringify(data, null, 2));
        updated = true;
        break;
      }
    } catch (error) {
      // Skip invalid files
    }
  }

  if (!updated) {
    throw new Error(`Could not update profile file for: ${profileName}`);
  }

  return { success: true, profile };
}

/**
 * Get next unprocessed profile
 */
function getNextUnqualifiedProfile() {
  const allProfiles = loadAllProfiles();
  const processedNames = getProcessedProfileNames();

  // Find first profile that hasn't been processed yet
  const unprocessed = allProfiles.find(p => !processedNames.has(p.name));

  return unprocessed || null;
}

/**
 * Get unprocessed profiles count
 */
function getUnqualifiedCount() {
  const allProfiles = loadAllProfiles();
  const processedNames = getProcessedProfileNames();
  return allProfiles.filter(p => !processedNames.has(p.name)).length;
}

/**
 * Save qualification result
 */
function saveQualification(profileName, qualificationData) {
  const allProfiles = loadAllProfiles();
  const profile = allProfiles.find(p => p.name === profileName);

  if (!profile) {
    throw new Error(`Profile not found: ${profileName}`);
  }

  const { qualified, score, reasoning, strengths, concerns, recommendedApproach } = qualificationData;

  if (qualified && score >= config.minScore) {
    // Save to qualified directory
    ensureQualifiedDir();
    const timestamp = Date.now();
    const filename = `qualified_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = join(QUALIFIED_DIR, filename);

    const prospect = {
      ...profile,
      qualification: {
        isQualified: true,
        analysis: {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        },
        qualifiedAt: new Date().toISOString()
      }
    };

    writeFileSync(filepath, JSON.stringify(prospect, null, 2));

    return { saved: true, filepath, qualified: true };
  } else {
    // Save to disqualified directory
    ensureDisqualifiedDir();
    const timestamp = Date.now();
    const filename = `disqualified_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = join(DISQUALIFIED_DIR, filename);

    const prospect = {
      ...profile,
      qualification: {
        isQualified: false,
        analysis: {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        },
        disqualifiedAt: new Date().toISOString()
      }
    };

    writeFileSync(filepath, JSON.stringify(prospect, null, 2));

    return { saved: true, filepath, qualified: false };
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'linkedin-outreach-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_next_profile',
        description: 'Get the next unqualified LinkedIn profile to analyze. ⚠️ IMPORTANT: Load qualification criteria from Google Drive first! Returns profile data including name, title, company, experience, education, etc.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_next_batch',
        description: 'Get the next 5 unqualified profiles for batch processing. ⚠️ CRITICAL: You MUST load qualification criteria from Google Drive before using this tool! Process: 1) Quick screen for obvious disqualifiers, 2) Deep analysis on promising ones only, 3) Save all 5.',
        inputSchema: {
          type: 'object',
          properties: {
            batchSize: {
              type: 'number',
              description: 'Number of profiles to return (default 5, max 10)',
            },
          },
        },
      },
      {
        name: 'save_qualification',
        description: 'Save the qualification decision for a profile. IMPORTANT: Keep text concise to avoid errors. Max 500 chars for reasoning/approach, max 100 chars per strength/concern, max 5 items per array.',
        inputSchema: {
          type: 'object',
          properties: {
            profileName: {
              type: 'string',
              description: 'The exact name of the profile being qualified',
            },
            qualified: {
              type: 'boolean',
              description: 'Whether the profile is qualified (true) or not (false)',
            },
            score: {
              type: 'number',
              description: 'Qualification score from 0-100',
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation (max 500 chars). Be concise.',
            },
            strengths: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of 2-5 brief strengths (max 100 chars each)',
              maxItems: 5,
            },
            concerns: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of 2-5 brief concerns (max 100 chars each)',
              maxItems: 5,
            },
            recommendedApproach: {
              type: 'string',
              description: 'Brief outreach suggestion (max 500 chars)',
            },
          },
          required: ['profileName', 'qualified', 'score', 'reasoning', 'strengths', 'concerns', 'recommendedApproach'],
        },
      },
      {
        name: 'get_stats',
        description: 'Get qualification statistics including total profiles, qualified count, and remaining profiles',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_next_to_contact',
        description: 'Get the next qualified profile to contact (profile that has not yet been contacted)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'mark_contacted',
        description: 'Mark a qualified profile as contacted with timestamp and optional notes',
        inputSchema: {
          type: 'object',
          properties: {
            profileName: {
              type: 'string',
              description: 'The exact name of the profile that was contacted',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the outreach (e.g., connection request sent, message sent, etc.)',
            },
          },
          required: ['profileName'],
        },
      },
      {
        name: 'get_csv_info',
        description: 'Get information about the current LinkedIn CSV file being processed',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_next_profile': {
      const profile = getNextUnqualifiedProfile();
      if (!profile) {
        return {
          content: [
            {
              type: 'text',
              text: 'No more profiles to qualify. All profiles have been processed!',
            },
          ],
        };
      }

      const unqualifiedCount = getUnqualifiedCount();
      const allProfiles = loadAllProfiles();
      const isFirstProfile = unqualifiedCount === allProfiles.length;

      // Add reminder to load criteria if this is the first profile
      let reminder = '';
      if (isFirstProfile) {
        reminder = `📋 REMINDER: Load your qualification criteria from Google Drive before analyzing profiles!\n\n`;
      }

      // Format profile data nicely
      const profileText = `${reminder}Profile: ${profile.name}
Title: ${profile.title}
Company: ${profile.company}
Location: ${profile.location}
URL: ${profile.url}

About:
${profile.about || 'N/A'}

Experience:
${profile.experience.map(exp => `- ${exp.title} at ${exp.company} (${exp.dates})`).join('\n') || 'N/A'}

Education:
${profile.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n') || 'N/A'}

Profiles remaining: ${unqualifiedCount}`;

      return {
        content: [
          {
            type: 'text',
            text: profileText,
          },
        ],
      };
    }

    case 'get_next_batch': {
      const batchSize = Math.min(args.batchSize || 5, 10);
      const allProfiles = loadAllProfiles();
      const processedNames = getProcessedProfileNames();

      const unprocessedProfiles = allProfiles.filter(p => !processedNames.has(p.name));
      const batch = unprocessedProfiles.slice(0, batchSize);

      if (batch.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No more profiles to qualify. All profiles have been processed!',
            },
          ],
        };
      }

      const unqualifiedCount = unprocessedProfiles.length;
      const isFirstBatch = unqualifiedCount === allProfiles.length;

      // Forceful reminder to load criteria
      let reminder = '';
      if (isFirstBatch) {
        reminder = `🚨 CRITICAL REMINDER: Load your qualification criteria from Google Drive RIGHT NOW before analyzing!\n\n`;
      }

      // Format batch nicely
      let batchText = `${reminder}Batch of ${batch.length} profiles (${unqualifiedCount} remaining):\n\n`;
      batchText += `PROCESS:\n`;
      batchText += `1. Quick screen for obvious disqualifiers (incomplete, pure sales, government, etc)\n`;
      batchText += `2. Deep analysis ONLY on promising ones\n`;
      batchText += `3. Save all ${batch.length} using save_qualification\n\n`;
      batchText += `---\n\n`;

      batch.forEach((profile, i) => {
        batchText += `[${i + 1}] ${profile.name}\n`;
        batchText += `Title: ${profile.title}\n`;
        batchText += `Company: ${profile.company}\n`;
        batchText += `Location: ${profile.location}\n`;

        if (profile.about && profile.about.length > 200) {
          batchText += `About: ${profile.about.substring(0, 200)}...\n`;
        } else {
          batchText += `About: ${profile.about || 'N/A'}\n`;
        }

        if (profile.experience && profile.experience.length > 0) {
          batchText += `Current: ${profile.experience[0].title} at ${profile.experience[0].company}\n`;
        }

        batchText += `\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: batchText,
          },
        ],
      };
    }

    case 'save_qualification': {
      const { profileName, qualified, score, reasoning, strengths, concerns, recommendedApproach } = args;

      try {
        // Validate parameter lengths to prevent errors
        const validationErrors = [];

        if (reasoning && reasoning.length > 500) {
          validationErrors.push(`reasoning is ${reasoning.length} chars (max 500)`);
        }

        if (recommendedApproach && recommendedApproach.length > 500) {
          validationErrors.push(`recommendedApproach is ${recommendedApproach.length} chars (max 500)`);
        }

        if (strengths && strengths.length > 5) {
          validationErrors.push(`strengths has ${strengths.length} items (max 5)`);
        }

        if (strengths && strengths.some(s => s.length > 100)) {
          const longItems = strengths.filter(s => s.length > 100).map(s => s.substring(0, 50) + '...');
          validationErrors.push(`some strengths exceed 100 chars: ${longItems.join(', ')}`);
        }

        if (concerns && concerns.length > 5) {
          validationErrors.push(`concerns has ${concerns.length} items (max 5)`);
        }

        if (concerns && concerns.some(c => c.length > 100)) {
          const longItems = concerns.filter(c => c.length > 100).map(c => c.substring(0, 50) + '...');
          validationErrors.push(`some concerns exceed 100 chars: ${longItems.join(', ')}`);
        }

        if (validationErrors.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Validation failed - text too long:\n${validationErrors.map(e => `  • ${e}`).join('\n')}\n\nPlease shorten the text and try again.`,
              },
            ],
            isError: true,
          };
        }

        const result = saveQualification(profileName, {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        });

        const message = result.qualified
          ? `✓ Profile "${profileName}" saved as QUALIFIED (score: ${score}/100)\n  Location: ${result.filepath}`
          : `✗ Profile "${profileName}" saved as DISQUALIFIED (score: ${score}/100)\n  Location: ${result.filepath}`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'get_stats': {
      const allProfiles = loadAllProfiles();
      const qualifiedNames = getQualifiedProfileNames();
      const processedNames = getProcessedProfileNames();
      const unprocessedCount = getUnqualifiedCount();
      const disqualifiedCount = processedNames.size - qualifiedNames.size;

      const statsText = `Total profiles scraped: ${allProfiles.length}
Qualified profiles: ${qualifiedNames.size}
Disqualified profiles: ${disqualifiedCount}
Remaining to process: ${unprocessedCount}`;

      return {
        content: [
          {
            type: 'text',
            text: statsText,
          },
        ],
      };
    }

    case 'get_next_to_contact': {
      const profile = getNextToContact();
      if (!profile) {
        return {
          content: [
            {
              type: 'text',
              text: 'No more qualified profiles to contact. All qualified profiles have been contacted!',
            },
          ],
        };
      }

      // Format profile data nicely
      const profileText = `Next Profile to Contact: ${profile.name}
Title: ${profile.title}
Company: ${profile.company}
URL: ${profile.url}

Qualification Score: ${profile.qualification?.analysis?.score || 'N/A'}/100

Qualification Summary:
${profile.qualification?.analysis?.reasoning || 'N/A'}

Strengths:
${profile.qualification?.analysis?.strengths?.map(s => `- ${s}`).join('\n') || 'N/A'}

Recommended Approach:
${profile.qualification?.analysis?.recommendedApproach || 'N/A'}`;

      return {
        content: [
          {
            type: 'text',
            text: profileText,
          },
        ],
      };
    }

    case 'mark_contacted': {
      const { profileName, notes } = args;

      try {
        const result = markAsContacted(profileName, notes || '');

        const message = `✓ Profile "${profileName}" marked as contacted
  Contacted at: ${result.profile.outreach.contactedAt}
  Notes: ${result.profile.outreach.notes || 'None'}`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case 'get_csv_info': {
      try {
        const csvPath = findMostRecentCSV();
        const stats = statSync(csvPath);
        const profiles = loadAllProfiles();

        const infoText = `Current LinkedIn CSV:
  File: ${csvPath}
  Size: ${(stats.size / 1024).toFixed(2)} KB
  Modified: ${stats.mtime.toLocaleString()}
  Total profiles: ${profiles.length}`;

        return {
          content: [
            {
              type: 'text',
              text: infoText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LinkedIn Outreach MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
