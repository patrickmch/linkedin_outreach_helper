/**
 * Outreach Routes
 * Handle Heyreach campaign integration
 */

import express from 'express';
import { getDatabase } from '../database/db.js';
import { config } from '../config.js';

const router = express.Router();

/**
 * Send prospect to Heyreach
 */
async function sendToHeyreach(profile) {
  const { apiKey, listId, baseUrl } = config.heyreach;

  if (!apiKey || !listId) {
    throw new Error('Heyreach configuration missing');
  }

  const [firstName, ...lastNameParts] = profile.name.split(' ');
  const lastName = lastNameParts.join(' ');

  const response = await fetch(`${baseUrl}/list/AddLeadsToListV2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({
      leads: [{
        firstName,
        lastName,
        location: profile.location || '',
        summary: profile.title || '',
        companyName: profile.company || '',
        position: profile.title || '',
        about: profile.about || '',
        emailAddress: '',
        profileUrl: profile.linkedin_url
      }],
      listId: parseInt(listId)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Heyreach API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * POST /api/outreach/send
 * Send qualified profile(s) to Heyreach campaign
 * Body: { profile_id } or { profile_ids: [] }
 */
router.post('/send', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { profile_id, profile_ids } = req.body;

    // Handle single or batch
    const ids = profile_id ? [profile_id] : profile_ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'profile_id or profile_ids array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const id of ids) {
      try {
        // Get profile with qualification
        const profile = await db.get(`
          SELECT
            p.*,
            q.qualified,
            q.score,
            q.recommended_approach
          FROM profiles p
          LEFT JOIN qualifications q ON p.id = q.profile_id
          WHERE p.id = ?
        `, id);

        if (!profile) {
          errors.push({ profile_id: id, error: 'Profile not found' });
          continue;
        }

        // Check if qualified
        if (!profile.qualified) {
          errors.push({ profile_id: id, error: 'Profile not qualified' });
          continue;
        }

        // Check if already sent
        const existing = await db.get(`
          SELECT id FROM outreach_tracking WHERE profile_id = ?
        `, id);

        if (existing) {
          errors.push({ profile_id: id, error: 'Already sent to Heyreach' });
          continue;
        }

        // Send to Heyreach
        const heyreachResponse = await sendToHeyreach(profile);

        // Track in database
        await db.run(`
          INSERT INTO outreach_tracking (
            profile_id, heyreach_list_id, heyreach_lead_id,
            message_text, sent_at, status
          ) VALUES (?, ?, ?, ?, ?, 'sent')
        `, [
          id,
          config.heyreach.listId,
          profile.linkedin_url, // Using URL as lead ID
          profile.recommended_approach || '',
          new Date().toISOString()
        ]);

        // Update profile status
        await db.run(`
          UPDATE profiles SET status = 'contacted' WHERE id = ?
        `, id);

        results.push({
          profile_id: id,
          name: profile.name,
          sent: true,
          heyreach_response: heyreachResponse
        });

      } catch (error) {
        errors.push({
          profile_id: id,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      total: ids.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/outreach/status
 * Get outreach campaign status
 */
router.get('/status', async (req, res, next) => {
  try {
    const db = getDatabase();

    const stats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM outreach_tracking
    `);

    // Get recent outreach
    const recent = await db.all(`
      SELECT
        o.*,
        p.name,
        p.title,
        p.company
      FROM outreach_tracking o
      JOIN profiles p ON o.profile_id = p.id
      ORDER BY o.sent_at DESC
      LIMIT 10
    `);

    res.json({
      stats,
      recent_outreach: recent
    });

  } catch (error) {
    next(error);
  }
});

export default router;
