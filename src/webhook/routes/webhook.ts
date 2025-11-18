/**
 * Webhook Route
 * Receives LinkedIn profile data and triggers async processing
 */

import express, { Request, Response } from 'express';
import { createContact } from '../services/contact-storage.js';
import { triggerAsyncProcessing } from '../services/processor.js';
import { WebhookRequest, WebhookResponse, LinkedInProfile } from '../types.js';

const router = express.Router();

/**
 * POST /webhook/linkedin-helper
 * Receives LinkedIn profile data, stores in Redis, returns immediately
 */
router.post('/linkedin-helper', async (req: Request, res: Response) => {
  try {
    const { profile }: WebhookRequest = req.body;

    // Validate required fields
    if (!profile || !profile.name || !profile.linkedinUrl) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name and linkedinUrl are required'
      });
      return;
    }

    // Validate LinkedIn URL format
    if (!isValidLinkedInUrl(profile.linkedinUrl)) {
      res.status(400).json({
        success: false,
        message: 'Invalid LinkedIn URL format'
      });
      return;
    }

    // Create contact in Redis
    await createContact(profile);

    // Trigger async processing (non-blocking)
    triggerAsyncProcessing(profile.linkedinUrl);

    // Return success immediately
    const response: WebhookResponse = {
      success: true,
      message: 'Contact received and queued for processing',
      linkedinUrl: profile.linkedinUrl
    };

    res.status(200).json(response);

    console.log(`✓ Webhook processed: ${profile.name}`);
  } catch (error) {
    console.error('✗ Webhook error:', error);

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

export default router;
