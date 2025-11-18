/**
 * LLM Qualification Service
 * Integrates with LLM Router API to qualify LinkedIn profiles
 */

import { config } from '../config.js';
import { LinkedInProfile, LLMQualificationRequest, LLMQualificationResponse, QualificationResult } from '../types.js';

const QUALIFICATION_CRITERIA = `
Looking for VP, Director, CTO, CEO level at tech/SaaS companies, 50-1000 employees.
Avoid freelancers and consultants.

Evaluate based on:
- Job title seniority (VP, Director, C-level)
- Company type (tech/SaaS preferred)
- Company size (50-1000 employees ideal)
- No freelancer/consultant indicators
`;

/**
 * Build qualification prompt for LLM
 */
function buildQualificationPrompt(profile: LinkedInProfile): string {
  const experienceSummary = profile.experience
    ?.map((exp, i) => `${i + 1}. ${exp.title} at ${exp.company}`)
    .join('\n') || 'No experience data';

  return `Analyze this LinkedIn profile and determine if they are a qualified lead.

Profile:
Name: ${profile.name}
Title: ${profile.title}
Company: ${profile.company}
Location: ${profile.location || 'Unknown'}
About: ${profile.about || 'No about section'}

Experience:
${experienceSummary}

Qualification Criteria:
${QUALIFICATION_CRITERIA}

Respond with ONLY a JSON object in this exact format:
{
  "qualified": true/false,
  "score": 0-100,
  "reasoning": "Brief explanation (max 200 chars)"
}`;
}

/**
 * Call LLM Router API to qualify profile
 */
export async function qualifyProfile(profile: LinkedInProfile): Promise<QualificationResult> {
  const prompt = buildQualificationPrompt(profile);

  const requestBody: LLMQualificationRequest = {
    prompt,
    llm: 'claude',
    context_source: 'json',
    context_config: {
      data: {
        criteria: QUALIFICATION_CRITERIA,
        profile: {
          name: profile.name,
          title: profile.title,
          company: profile.company,
          location: profile.location
        }
      }
    }
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

    // Parse JSON from LLM response
    const result = parseQualificationResult(data.response);

    console.log(`✓ Qualified ${profile.name}: ${result.qualified ? 'YES' : 'NO'} (Score: ${result.score})`);

    return result;
  } catch (error) {
    console.error(`✗ Failed to qualify ${profile.name}:`, error);

    // Return default disqualified result on error
    return {
      qualified: false,
      score: 0,
      reasoning: `Error during qualification: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse qualification result from LLM response
 */
function parseQualificationResult(response: string): QualificationResult {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.qualified !== 'boolean' || typeof parsed.score !== 'number') {
      throw new Error('Invalid qualification result structure');
    }

    return {
      qualified: parsed.qualified,
      score: parsed.score,
      reasoning: parsed.reasoning || 'No reasoning provided'
    };
  } catch (error) {
    console.error('Failed to parse LLM response:', error);
    console.error('Response was:', response);

    // Return default result
    return {
      qualified: false,
      score: 0,
      reasoning: 'Failed to parse LLM response'
    };
  }
}

/**
 * Check if qualified based on score threshold
 */
export function isQualified(score: number): boolean {
  return score >= config.QUALIFICATION_THRESHOLD;
}
