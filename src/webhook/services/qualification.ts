/**
 * LLM Qualification Service
 * Integrates with LLM Router API to qualify LinkedIn profiles
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { LinkedInProfile, LLMQualificationRequest, LLMQualificationResponse, QualificationResult, QualificationDecision } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load qualification prompt from file
let QUALIFICATION_PROMPT: string;

function loadPrompt(): string {
  if (QUALIFICATION_PROMPT) return QUALIFICATION_PROMPT;

  try {
    // Path from dist/webhook/services/ to project root prompts/
    const promptPath = join(__dirname, '..', '..', '..', 'prompts', 'qualification.md');
    QUALIFICATION_PROMPT = readFileSync(promptPath, 'utf-8');
    console.log('✓ Loaded qualification prompt from file');
    return QUALIFICATION_PROMPT;
  } catch (error) {
    console.error('✗ Failed to load qualification prompt:', error);
    throw new Error('Could not load qualification prompt file');
  }
}

/**
 * Build the complete prompt with profile data
 */
function buildPrompt(profile: LinkedInProfile): string {
  const criteria = loadPrompt();

  // Build job history string
  const jobHistoryStr = profile.jobHistory
    ?.map((job, i) => `${i + 1}. ${job.title} at ${job.company}${job.duration ? ` (${job.duration})` : ''}`)
    .join('\n') || 'Not available';

  return `${criteria}

---

## PROFILE TO EVALUATE

name: ${profile.name}
headline: ${profile.headline || 'Not provided'}
summary: ${profile.summary || 'Not provided'}
current_company: ${profile.currentCompany || 'Not provided'}
current_title: ${profile.currentTitle || 'Not provided'}
job_history:
${jobHistoryStr}
industry: ${profile.industry || 'Not provided'}
location: ${profile.location || 'Not provided'}
skills: ${profile.skills || 'Not provided'}
followers: ${profile.followers || 'Not provided'}

Evaluate this profile and return your JSON decision.`;
}

/**
 * Parse qualification result from LLM response
 */
function parseResult(response: string): QualificationResult {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate decision field
    const validDecisions: QualificationDecision[] = ['TIER_1', 'TIER_2', 'TIER_3', 'SKIP'];
    if (!validDecisions.includes(parsed.decision)) {
      throw new Error(`Invalid decision: ${parsed.decision}`);
    }

    return {
      decision: parsed.decision,
      reason: parsed.reason || 'No reason provided',
      roleDetected: parsed.role_detected || '',
      clientTypeInferred: parsed.client_type_inferred || '',
      mindsetSignals: parsed.mindset_signals || ''
    };
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    console.error('Response was:', response);

    return {
      decision: 'SKIP',
      reason: 'Failed to parse LLM response',
      roleDetected: '',
      clientTypeInferred: '',
      mindsetSignals: ''
    };
  }
}

/**
 * Call LLM Router API to qualify profile
 */
export async function qualifyProfile(profile: LinkedInProfile): Promise<QualificationResult> {
  const prompt = buildPrompt(profile);

  const requestBody: LLMQualificationRequest = {
    prompt,
    llm: 'claude'
  };

  try {
    const response = await fetch(`${config.LLM_ROUTER_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`LLM Router error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as LLMQualificationResponse;

    // Parse result from LLM response
    const result = parseResult(data.response);

    console.log(`✓ Qualified ${profile.name}: ${result.decision} - ${result.reason}`);

    return result;
  } catch (error) {
    console.error(`✗ Failed to qualify ${profile.name}:`, error);

    return {
      decision: 'SKIP',
      reason: `Error during qualification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      roleDetected: '',
      clientTypeInferred: '',
      mindsetSignals: ''
    };
  }
}

/**
 * Check if decision is qualified (any tier)
 */
export function isQualified(decision: QualificationDecision): boolean {
  return decision === 'TIER_1' || decision === 'TIER_2' || decision === 'TIER_3';
}
