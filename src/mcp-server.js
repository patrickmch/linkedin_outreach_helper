#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
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
 * Ensure qualified directory exists
 */
function ensureQualifiedDir() {
  if (!existsSync(QUALIFIED_DIR)) {
    mkdirSync(QUALIFIED_DIR, { recursive: true });
  }
}

/**
 * Get list of already qualified profile names
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
 * Get next unqualified profile
 */
function getNextUnqualifiedProfile() {
  const allProfiles = loadAllProfiles();
  const qualifiedNames = getQualifiedProfileNames();

  // Find first profile that hasn't been qualified
  const unqualified = allProfiles.find(p => !qualifiedNames.has(p.name));

  return unqualified || null;
}

/**
 * Get unqualified profiles count
 */
function getUnqualifiedCount() {
  const allProfiles = loadAllProfiles();
  const qualifiedNames = getQualifiedProfileNames();
  return allProfiles.filter(p => !qualifiedNames.has(p.name)).length;
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

  if (qualified && score >= (config.qualification.minScore || 70)) {
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
    incrementQualified();

    return { saved: true, filepath, qualified: true };
  } else {
    // Just increment disqualified counter
    incrementDisqualified();
    return { saved: false, qualified: false, reason: qualified ? 'Score below threshold' : 'Not qualified' };
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
        description: 'Get the next unqualified LinkedIn profile to analyze. Returns profile data including name, title, company, experience, education, etc.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'save_qualification',
        description: 'Save the qualification decision for a profile. If qualified=true and score >= threshold (default 70), saves to qualified directory. Updates stats.',
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
              description: 'Detailed explanation of the qualification decision',
            },
            strengths: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of strengths or positive points about this lead',
            },
            concerns: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of concerns or red flags',
            },
            recommendedApproach: {
              type: 'string',
              description: 'Suggested approach for outreach (if qualified)',
            },
          },
          required: ['profileName', 'qualified', 'score', 'reasoning', 'strengths', 'concerns', 'recommendedApproach'],
        },
      },
      {
        name: 'get_qualification_criteria',
        description: 'Get the qualification criteria from config to use when analyzing profiles',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
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

      // Format profile data nicely
      const profileText = `Profile: ${profile.name}
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

Profiles remaining: ${getUnqualifiedCount()}`;

      return {
        content: [
          {
            type: 'text',
            text: profileText,
          },
        ],
      };
    }

    case 'save_qualification': {
      const { profileName, qualified, score, reasoning, strengths, concerns, recommendedApproach } = args;

      try {
        const result = saveQualification(profileName, {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        });

        const message = result.saved
          ? `✓ Profile "${profileName}" saved as QUALIFIED (score: ${score}/100)\n  Location: ${result.filepath}`
          : `✗ Profile "${profileName}" marked as DISQUALIFIED (${result.reason})`;

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

    case 'get_qualification_criteria': {
      const criteria = config.qualification;
      const criteriaText = `IDEAL CUSTOMER PROFILE:
${criteria.idealProfile}

QUALIFICATION CRITERIA:
${criteria.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

DISQUALIFIERS:
${criteria.disqualifiers.map((d, i) => `${i + 1}. ${d}`).join('\n')}

MINIMUM SCORE THRESHOLD: ${config.qualification.minScore || 70}`;

      return {
        content: [
          {
            type: 'text',
            text: criteriaText,
          },
        ],
      };
    }

    case 'get_stats': {
      const allProfiles = loadAllProfiles();
      const qualifiedNames = getQualifiedProfileNames();
      const unqualifiedCount = getUnqualifiedCount();

      const statsText = `Total profiles scraped: ${allProfiles.length}
Qualified profiles: ${qualifiedNames.size}
Remaining to qualify: ${unqualifiedCount}`;

      return {
        content: [
          {
            type: 'text',
            text: statsText,
          },
        ],
      };
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
