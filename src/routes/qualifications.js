/**
 * Qualifications Routes
 * Handle AI-powered lead qualification via LLM Router
 */

import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();

/**
 * Call LLM Router API
 */
async function callLLMRouter(prompt, criteria, llm = 'claude') {
  const LLM_ROUTER_URL = process.env.LLM_ROUTER_URL || 'http://localhost:8000';

  const response = await fetch(`${LLM_ROUTER_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      llm,
      context_source: 'json',
      context_config: {
        data: criteria
      }
    })
  });

  if (!response.ok) {
    throw new Error(`LLM Router error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Build qualification prompt
 */
function buildQualificationPrompt(profile) {
  const experience = profile.profile_data?.experience || [];
  const education = profile.profile_data?.education || [];

  return `Analyze this LinkedIn profile and determine if they are a qualified lead.

Profile:
Name: ${profile.name}
Title: ${profile.title}
Company: ${profile.company}
Location: ${profile.location}
About: ${profile.about}

Experience:
${experience.map((exp, i) => `${i + 1}. ${exp.title} at ${exp.company}
   ${exp.duration}
   ${exp.description}`).join('\n\n')}

Education:
${education.map((edu, i) => `${i + 1}. ${edu.school} - ${edu.degree} ${edu.field}`).join('\n')}

Based on the qualification criteria provided in the context, evaluate this profile and respond with a JSON object:
{
  "qualified": true/false,
  "score": 0-100,
  "reasoning": "Brief explanation (max 500 chars)",
  "strengths": ["strength 1", "strength 2", ...],
  "concerns": ["concern 1", "concern 2", ...],
  "recommendedApproach": "How to approach this prospect (max 500 chars)"
}

IMPORTANT: Respond with ONLY the JSON object, no other text.`;
}

/**
 * POST /api/qualifications
 * Qualify a profile using LLM Router
 * Body: { profile_id, criteria, llm }
 */
router.post('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { profile_id, criteria, llm = 'claude' } = req.body;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id is required' });
    }

    if (!criteria) {
      return res.status(400).json({ error: 'criteria is required' });
    }

    // Get profile
    const profile = await db.get(`
      SELECT * FROM profiles WHERE id = ?
    `, profile_id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Parse profile data
    profile.profile_data = profile.profile_data ? JSON.parse(profile.profile_data) : {};

    // Check if already qualified
    const existing = await db.get(`
      SELECT id FROM qualifications WHERE profile_id = ?
    `, profile_id);

    if (existing) {
      return res.status(409).json({
        error: 'Profile already qualified',
        message: 'Use PATCH to update or DELETE to requalify'
      });
    }

    // Build prompt and call LLM
    const prompt = buildQualificationPrompt(profile);
    const llmResponse = await callLLMRouter(prompt, criteria, llm);

    // Parse LLM response
    let analysis;
    try {
      // Extract JSON from response
      const responseText = llmResponse.response;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to parse LLM response',
        llm_response: llmResponse.response
      });
    }

    // Validate analysis structure
    if (typeof analysis.qualified !== 'boolean' || typeof analysis.score !== 'number') {
      return res.status(500).json({
        error: 'Invalid LLM response structure',
        analysis
      });
    }

    // Insert qualification
    const result = await db.run(`
      INSERT INTO qualifications (
        profile_id, qualified, score, reasoning,
        strengths, concerns, recommended_approach,
        criteria_used, llm_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      profile_id,
      analysis.qualified ? 1 : 0,
      analysis.score,
      analysis.reasoning || '',
      JSON.stringify(analysis.strengths || []),
      JSON.stringify(analysis.concerns || []),
      analysis.recommendedApproach || '',
      JSON.stringify(criteria),
      JSON.stringify(llmResponse)
    ]);

    // Update profile status
    const newStatus = analysis.qualified ? 'qualified' : 'rejected';
    await db.run(`
      UPDATE profiles SET status = ? WHERE id = ?
    `, [newStatus, profile_id]);

    res.json({
      success: true,
      qualification_id: result.lastID,
      profile_id,
      qualified: analysis.qualified,
      score: analysis.score,
      reasoning: analysis.reasoning,
      strengths: analysis.strengths,
      concerns: analysis.concerns,
      recommended_approach: analysis.recommendedApproach
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/qualifications/batch
 * Qualify multiple profiles at once
 * Body: { profile_ids, criteria, llm }
 */
router.post('/batch', async (req, res, next) => {
  try {
    const { profile_ids, criteria, llm = 'claude' } = req.body;

    if (!profile_ids || !Array.isArray(profile_ids)) {
      return res.status(400).json({ error: 'profile_ids array is required' });
    }

    if (!criteria) {
      return res.status(400).json({ error: 'criteria is required' });
    }

    const results = [];
    const errors = [];

    // Process each profile
    for (const profile_id of profile_ids) {
      try {
        // Make individual qualification request
        const response = await fetch(`${req.protocol}://${req.get('host')}/api/qualifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ profile_id, criteria, llm })
        });

        const data = await response.json();

        if (response.ok) {
          results.push(data);
        } else {
          errors.push({ profile_id, error: data.error });
        }
      } catch (error) {
        errors.push({ profile_id, error: error.message });
      }
    }

    res.json({
      success: true,
      qualified: results.filter(r => r.qualified).length,
      rejected: results.filter(r => !r.qualified).length,
      total: profile_ids.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/qualifications
 * List all qualifications
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { qualified, limit = 10, offset = 0 } = req.query;

    const conditions = [];
    const params = [];

    if (qualified !== undefined) {
      conditions.push('qualified = ?');
      params.push(qualified === 'true' ? 1 : 0);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const qualifications = await db.all(`
      SELECT
        q.*,
        p.name,
        p.title,
        p.company,
        p.linkedin_url
      FROM qualifications q
      JOIN profiles p ON q.profile_id = p.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Parse JSON fields
    const parsed = qualifications.map(q => ({
      ...q,
      strengths: q.strengths ? JSON.parse(q.strengths) : [],
      concerns: q.concerns ? JSON.parse(q.concerns) : [],
      criteria_used: q.criteria_used ? JSON.parse(q.criteria_used) : null,
      llm_response: q.llm_response ? JSON.parse(q.llm_response) : null
    }));

    res.json({
      qualifications: parsed,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/qualifications/:id
 * Get single qualification
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const qualification = await db.get(`
      SELECT
        q.*,
        p.name,
        p.title,
        p.company,
        p.linkedin_url,
        p.profile_data
      FROM qualifications q
      JOIN profiles p ON q.profile_id = p.id
      WHERE q.id = ?
    `, id);

    if (!qualification) {
      return res.status(404).json({ error: 'Qualification not found' });
    }

    // Parse JSON fields
    qualification.strengths = qualification.strengths ? JSON.parse(qualification.strengths) : [];
    qualification.concerns = qualification.concerns ? JSON.parse(qualification.concerns) : [];
    qualification.criteria_used = qualification.criteria_used ? JSON.parse(qualification.criteria_used) : null;
    qualification.llm_response = qualification.llm_response ? JSON.parse(qualification.llm_response) : null;
    qualification.profile_data = qualification.profile_data ? JSON.parse(qualification.profile_data) : null;

    res.json(qualification);

  } catch (error) {
    next(error);
  }
});

export default router;
