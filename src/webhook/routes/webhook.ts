/**
 * Webhook Route
 * Receives LinkedIn profile data from LinkedHelper and triggers async processing
 */

import express, { Request, Response } from 'express';
import { createContact } from '../services/contact-storage.js';
import { triggerAsyncProcessing } from '../services/processor.js';
import { LinkedInProfile, LinkedHelperPayload, JobHistoryEntry } from '../types.js';

const router = express.Router();

/**
 * Normalize LinkedHelper payload to internal format
 * Handles snake_case fields from LinkedHelper and maps to our structure
 */
function normalizePayload(payload: any): LinkedInProfile {
  // Check if it's already in our format (has profile wrapper)
  if (payload.profile && payload.profile.linkedinUrl) {
    return payload.profile;
  }

  // LinkedHelper flat format - extract and normalize
  const raw = payload as LinkedHelperPayload;

  // Build name from parts or use full_name
  const name = raw.full_name
    || raw.name
    || [raw.first_name, raw.last_name].filter(Boolean).join(' ')
    || 'Unknown';

  // Get LinkedIn URL from various possible field names
  const linkedinUrl = raw.profile_url
    || raw.profileUrl
    || raw.linkedin_url
    || raw.linkedinUrl
    || '';

  // Extract job history from position_N_* fields
  const jobHistory = extractJobHistory(raw);

  const profile: LinkedInProfile = {
    name,
    linkedinUrl,
    headline: raw.headline || raw.title || undefined,
    summary: raw.summary || raw.about || undefined,
    currentCompany: raw.current_company || raw.company || undefined,
    currentTitle: raw.current_title || raw.position || raw.title || undefined,
    location: raw.location || raw.location_name || undefined,
    industry: raw.industry || undefined,
    skills: raw.skills || undefined,
    followers: raw.followers || raw.connections || raw.connections_count || undefined,
    jobHistory: jobHistory.length > 0 ? jobHistory : undefined,
    rawPayload: raw
  };

  return profile;
}

/**
 * Extract job history from LinkedHelper's position_N_* fields
 */
function extractJobHistory(payload: LinkedHelperPayload): JobHistoryEntry[] {
  const history: JobHistoryEntry[] = [];

  // LinkedHelper sends up to 10 positions as position_1_title, position_1_company, etc.
  for (let i = 1; i <= 10; i++) {
    const title = payload[`position_${i}_title`];
    const company = payload[`position_${i}_company`];

    if (title || company) {
      history.push({
        title: title || '',
        company: company || '',
        duration: payload[`position_${i}_duration`] || undefined,
        description: payload[`position_${i}_description`] || undefined
      });
    }
  }

  return history;
}

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

/**
 * POST /webhook/linkedin-helper
 * Receives LinkedIn profile data, stores in Redis, returns immediately
 */
router.post('/linkedin-helper', async (req: Request, res: Response) => {
  try {
    // Log raw payload for debugging
    console.log(`\n📥 Webhook received:`, JSON.stringify(req.body, null, 2));

    // Normalize payload to internal format
    const profile = normalizePayload(req.body);

    // Validate required fields
    if (!profile.name || profile.name === 'Unknown') {
      res.status(400).json({
        success: false,
        message: 'Missing required field: name (or first_name/last_name)'
      });
      return;
    }

    if (!isValidLinkedInUrl(profile.linkedinUrl)) {
      res.status(400).json({
        success: false,
        message: 'Missing or invalid LinkedIn URL (profile_url)'
      });
      return;
    }

    // Create contact in Redis
    await createContact(profile);

    // Trigger async processing (non-blocking)
    triggerAsyncProcessing(profile.linkedinUrl);

    // Return success immediately
    res.status(200).json({
      success: true,
      message: 'Contact received and queued for processing',
      linkedinUrl: profile.linkedinUrl
    });

    console.log(`✓ Webhook processed: ${profile.name}`);
  } catch (error) {
    console.error('✗ Webhook error:', error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;
