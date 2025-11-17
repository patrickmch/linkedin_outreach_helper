/**
 * Profiles Routes
 * Handle LinkedIn profile import and management
 */

import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { getDatabase } from '../database/db.js';

const router = express.Router();

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * POST /api/profiles/import
 * Import LinkedIn CSV export
 */
router.post('/import', upload.single('csv'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    const db = getDatabase();
    const csvContent = req.file.buffer.toString('utf-8');

    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    let imported = 0;
    let skipped = 0;
    let errors = [];

    // Import each profile
    for (const record of records) {
      try {
        // Extract core fields
        const linkedinUrl = record.profile_url || record.profileUrl || record.url;
        const name = record.full_name || record.name || record.fullName;

        if (!linkedinUrl || !name) {
          skipped++;
          errors.push({ name: name || 'Unknown', error: 'Missing required fields' });
          continue;
        }

        // Build profile data object
        const profileData = {
          experience: [],
          education: [],
          skills: record.skills || '',
          connections_count: parseInt(record.connections_count) || 0,
          raw: record
        };

        // Parse experience (up to 10 positions)
        for (let i = 1; i <= 10; i++) {
          const title = record[`position_${i}_title`];
          if (title) {
            profileData.experience.push({
              title,
              company: record[`position_${i}_company`] || '',
              duration: record[`position_${i}_duration`] || '',
              description: record[`position_${i}_description`] || ''
            });
          }
        }

        // Parse education (up to 3 schools)
        for (let i = 1; i <= 3; i++) {
          const school = record[`school_${i}_name`];
          if (school) {
            profileData.education.push({
              school,
              degree: record[`school_${i}_degree`] || '',
              field: record[`school_${i}_field_of_study`] || ''
            });
          }
        }

        // Insert or update profile
        await db.run(`
          INSERT INTO profiles (
            linkedin_url, name, title, company, location, headline, about,
            connections_count, profile_data, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
          ON CONFLICT(linkedin_url) DO UPDATE SET
            name = excluded.name,
            title = excluded.title,
            company = excluded.company,
            location = excluded.location,
            headline = excluded.headline,
            about = excluded.about,
            connections_count = excluded.connections_count,
            profile_data = excluded.profile_data,
            updated_at = CURRENT_TIMESTAMP
        `, [
          linkedinUrl,
          name,
          record.headline || record.title || '',
          record.company || '',
          record.location_name || record.location || '',
          record.headline || '',
          record.about || record.summary || '',
          profileData.connections_count,
          JSON.stringify(profileData)
        ]);

        imported++;
      } catch (error) {
        skipped++;
        errors.push({ name: record.full_name || record.name, error: error.message });
      }
    }

    res.json({
      success: true,
      imported,
      skipped,
      total: records.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profiles
 * List profiles with optional filtering
 * Query params: status, limit, offset, qualified
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      status,
      limit = 10,
      offset = 0,
      qualified
    } = req.query;

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (qualified !== undefined) {
      conditions.push('q.qualified = ?');
      params.push(qualified === 'true' ? 1 : 0);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get profiles with qualification data
    const profiles = await db.all(`
      SELECT
        p.*,
        q.qualified,
        q.score,
        q.reasoning,
        q.created_at as qualified_at
      FROM profiles p
      LEFT JOIN qualifications q ON p.id = q.profile_id
      ${whereClause}
      ORDER BY p.imported_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count
    const countResult = await db.get(`
      SELECT COUNT(*) as total
      FROM profiles p
      LEFT JOIN qualifications q ON p.id = q.profile_id
      ${whereClause}
    `, params);

    // Parse JSON fields
    const parsedProfiles = profiles.map(p => ({
      ...p,
      profile_data: p.profile_data ? JSON.parse(p.profile_data) : null
    }));

    res.json({
      profiles: parsedProfiles,
      total: countResult.total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/profiles/:id
 * Get single profile by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const profile = await db.get(`
      SELECT
        p.*,
        q.qualified,
        q.score,
        q.reasoning,
        q.strengths,
        q.concerns,
        q.recommended_approach,
        q.created_at as qualified_at
      FROM profiles p
      LEFT JOIN qualifications q ON p.id = q.profile_id
      WHERE p.id = ?
    `, id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Parse JSON fields
    profile.profile_data = profile.profile_data ? JSON.parse(profile.profile_data) : null;
    profile.strengths = profile.strengths ? JSON.parse(profile.strengths) : null;
    profile.concerns = profile.concerns ? JSON.parse(profile.concerns) : null;

    res.json(profile);

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/profiles/:id
 * Update profile metadata
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status, notes } = req.body;

    // Verify profile exists
    const existing = await db.get('SELECT id FROM profiles WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);

    await db.run(`
      UPDATE profiles
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    res.json({ success: true, message: 'Profile updated' });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/profiles/:id
 * Delete profile (for bad imports)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const result = await db.run('DELETE FROM profiles WHERE id = ?', id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ success: true, message: 'Profile deleted' });

  } catch (error) {
    next(error);
  }
});

export default router;
