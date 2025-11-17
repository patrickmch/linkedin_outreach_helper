/**
 * Stats Routes
 * Dashboard statistics and analytics
 */

import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();

/**
 * GET /api/stats
 * Get comprehensive statistics
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();

    // Profile stats
    const profileStats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
        SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted
      FROM profiles
    `);

    // Qualification stats
    const qualificationStats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN qualified = 1 THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN qualified = 0 THEN 1 ELSE 0 END) as rejected,
        AVG(CASE WHEN qualified = 1 THEN score ELSE NULL END) as avg_qualified_score,
        AVG(score) as avg_overall_score
      FROM qualifications
    `);

    // Outreach stats
    const outreachStats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM outreach_tracking
    `);

    // Connection stats
    const connectionStats = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN follow_up_sent = 1 THEN 1 ELSE 0 END) as follow_up_sent,
        SUM(CASE WHEN follow_up_sent = 0 THEN 1 ELSE 0 END) as pending_follow_up
      FROM connections
    `);

    // Recent activity
    const recentProfiles = await db.all(`
      SELECT name, title, company, imported_at
      FROM profiles
      ORDER BY imported_at DESC
      LIMIT 5
    `);

    const recentQualifications = await db.all(`
      SELECT
        q.qualified,
        q.score,
        q.created_at,
        p.name,
        p.title,
        p.company
      FROM qualifications q
      JOIN profiles p ON q.profile_id = p.id
      ORDER BY q.created_at DESC
      LIMIT 5
    `);

    const recentConnections = await db.all(`
      SELECT
        c.connected_at,
        c.follow_up_sent,
        p.name,
        p.title,
        p.company
      FROM connections c
      JOIN profiles p ON c.profile_id = p.id
      ORDER BY c.connected_at DESC
      LIMIT 5
    `);

    // Score distribution
    const scoreDistribution = await db.all(`
      SELECT
        CASE
          WHEN score >= 90 THEN '90-100'
          WHEN score >= 80 THEN '80-89'
          WHEN score >= 70 THEN '70-79'
          WHEN score >= 60 THEN '60-69'
          WHEN score >= 50 THEN '50-59'
          ELSE '0-49'
        END as score_range,
        COUNT(*) as count
      FROM qualifications
      WHERE qualified = 1
      GROUP BY score_range
      ORDER BY score_range DESC
    `);

    res.json({
      profiles: profileStats,
      qualifications: qualificationStats,
      outreach: outreachStats,
      connections: connectionStats,
      recent_activity: {
        profiles: recentProfiles,
        qualifications: recentQualifications,
        connections: recentConnections
      },
      score_distribution: scoreDistribution,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/stats/funnel
 * Get conversion funnel statistics
 */
router.get('/funnel', async (req, res, next) => {
  try {
    const db = getDatabase();

    const funnel = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM profiles) as total_profiles,
        (SELECT COUNT(*) FROM qualifications WHERE qualified = 1) as qualified,
        (SELECT COUNT(*) FROM outreach_tracking WHERE status IN ('sent', 'delivered')) as outreach_sent,
        (SELECT COUNT(*) FROM connections) as connections_accepted,
        (SELECT COUNT(*) FROM connections WHERE follow_up_sent = 1) as follow_ups_sent
      FROM (SELECT 1)
    `);

    // Calculate conversion rates
    const conversionRates = {
      qualification_rate: funnel.total_profiles > 0
        ? (funnel.qualified / funnel.total_profiles * 100).toFixed(2)
        : 0,
      outreach_send_rate: funnel.qualified > 0
        ? (funnel.outreach_sent / funnel.qualified * 100).toFixed(2)
        : 0,
      acceptance_rate: funnel.outreach_sent > 0
        ? (funnel.connections_accepted / funnel.outreach_sent * 100).toFixed(2)
        : 0,
      follow_up_rate: funnel.connections_accepted > 0
        ? (funnel.follow_ups_sent / funnel.connections_accepted * 100).toFixed(2)
        : 0
    };

    res.json({
      funnel,
      conversion_rates: conversionRates
    });

  } catch (error) {
    next(error);
  }
});

export default router;
