/**
 * Connections Routes
 * Handle connection acceptance tracking and follow-up messages
 */

import express from 'express';
import { getDatabase } from '../database/db.js';
import { config } from '../config.js';

const router = express.Router();

/**
 * Fetch campaign leads from Heyreach
 */
async function fetchHeyreachLeads(campaignId, page = 1, pageSize = 100) {
  const { apiKey, baseUrl } = config.heyreach;

  if (!apiKey) {
    throw new Error('Heyreach API key not configured');
  }

  const response = await fetch(`${baseUrl}/campaign/GetCampaignLeads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({
      campaignId: parseInt(campaignId),
      page,
      pageSize
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Heyreach API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * POST /api/connections/sync
 * Sync accepted connections from Heyreach
 * Body: { campaign_id }
 */
router.post('/sync', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { campaign_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    let page = 1;
    let hasMore = true;
    let newConnections = 0;
    let updatedConnections = 0;

    while (hasMore) {
      // Fetch leads from Heyreach
      const response = await fetchHeyreachLeads(campaign_id, page);
      const leads = response.leads || [];

      if (leads.length === 0) {
        hasMore = false;
        break;
      }

      // Process each lead
      for (const lead of leads) {
        // Only process accepted connections
        if (lead.leadConnectionStatus !== 'ConnectionAccepted') {
          continue;
        }

        // Find matching profile by LinkedIn URL
        const profile = await db.get(`
          SELECT id FROM profiles WHERE linkedin_url = ?
        `, lead.linkedInProfileURL);

        if (!profile) {
          console.log(`Profile not found for URL: ${lead.linkedInProfileURL}`);
          continue;
        }

        // Check if connection already exists
        const existing = await db.get(`
          SELECT id FROM connections WHERE profile_id = ?
        `, profile.id);

        if (existing) {
          // Update existing
          await db.run(`
            UPDATE connections
            SET heyreach_lead_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE profile_id = ?
          `, [lead.id, profile.id]);
          updatedConnections++;
        } else {
          // Insert new connection
          await db.run(`
            INSERT INTO connections (
              profile_id, heyreach_lead_id, connected_at
            ) VALUES (?, ?, ?)
          `, [
            profile.id,
            lead.id,
            new Date().toISOString()
          ]);
          newConnections++;
        }

        // Update outreach tracking status
        await db.run(`
          UPDATE outreach_tracking
          SET status = 'accepted', last_synced_at = CURRENT_TIMESTAMP
          WHERE profile_id = ?
        `, profile.id);
      }

      // Check if there are more pages
      if (leads.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    res.json({
      success: true,
      new_connections: newConnections,
      updated_connections: updatedConnections,
      total_processed: newConnections + updatedConnections
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/connections/pending
 * Get connections that need follow-up messages
 */
router.get('/pending', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { limit = 10, offset = 0 } = req.query;

    const connections = await db.all(`
      SELECT
        c.*,
        p.name,
        p.title,
        p.company,
        p.location,
        p.about,
        p.linkedin_url,
        p.profile_data,
        q.score,
        q.reasoning,
        q.recommended_approach
      FROM connections c
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN qualifications q ON p.id = q.profile_id
      WHERE c.follow_up_sent = 0
      ORDER BY c.connected_at ASC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    // Parse JSON fields
    const parsed = connections.map(c => ({
      ...c,
      profile_data: c.profile_data ? JSON.parse(c.profile_data) : null
    }));

    // Get total count
    const countResult = await db.get(`
      SELECT COUNT(*) as total
      FROM connections
      WHERE follow_up_sent = 0
    `);

    res.json({
      connections: parsed,
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/connections/:id
 * Get single connection details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const connection = await db.get(`
      SELECT
        c.*,
        p.*,
        q.score,
        q.reasoning,
        q.strengths,
        q.concerns,
        q.recommended_approach
      FROM connections c
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN qualifications q ON p.id = q.profile_id
      WHERE c.id = ?
    `, id);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Parse JSON fields
    connection.profile_data = connection.profile_data ? JSON.parse(connection.profile_data) : null;
    connection.strengths = connection.strengths ? JSON.parse(connection.strengths) : [];
    connection.concerns = connection.concerns ? JSON.parse(connection.concerns) : [];

    res.json(connection);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/connections/:id/message
 * Save follow-up message for a connection
 * Body: { message, send_now }
 */
router.post('/:id/message', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { message, send_now = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Verify connection exists
    const connection = await db.get(`
      SELECT id, profile_id FROM connections WHERE id = ?
    `, id);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Update connection with message
    await db.run(`
      UPDATE connections
      SET
        follow_up_message = ?,
        follow_up_sent = ?,
        follow_up_sent_at = ?,
        notes = COALESCE(notes || '\n\n', '') || 'Message saved: ' || CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      message,
      send_now ? 1 : 0,
      send_now ? new Date().toISOString() : null,
      id
    ]);

    res.json({
      success: true,
      connection_id: id,
      message_saved: true,
      marked_as_sent: send_now
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/connections/:id
 * Update connection metadata
 * Body: { follow_up_sent, notes }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { follow_up_sent, notes } = req.body;

    // Build update query
    const updates = [];
    const params = [];

    if (follow_up_sent !== undefined) {
      updates.push('follow_up_sent = ?');
      params.push(follow_up_sent ? 1 : 0);

      if (follow_up_sent) {
        updates.push('follow_up_sent_at = ?');
        params.push(new Date().toISOString());
      }
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);

    const result = await db.run(`
      UPDATE connections
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ success: true, message: 'Connection updated' });

  } catch (error) {
    next(error);
  }
});

export default router;
