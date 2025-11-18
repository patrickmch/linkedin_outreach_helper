/**
 * Contacts Routes
 * Endpoints to query and view contacts
 */

import express, { Request, Response } from 'express';
import { getAllContacts, getPendingContacts, getQualifiedContacts, getContactCount } from '../services/contact-storage.js';
import { ContactsResponse } from '../types.js';

const router = express.Router();

/**
 * GET /contacts
 * Returns all contacts from Redis
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const contacts = await getAllContacts();

    const response: ContactsResponse = {
      contacts,
      total: contacts.length
    };

    res.json(response);
  } catch (error) {
    console.error('✗ Error fetching contacts:', error);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch contacts'
    });
  }
});

/**
 * GET /contacts/pending
 * Returns contacts with status='pending'
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const contacts = await getPendingContacts();

    const response: ContactsResponse = {
      contacts,
      total: contacts.length
    };

    res.json(response);
  } catch (error) {
    console.error('✗ Error fetching pending contacts:', error);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch pending contacts'
    });
  }
});

/**
 * GET /contacts/qualified
 * Returns contacts with status='qualified'
 */
router.get('/qualified', async (req: Request, res: Response) => {
  try {
    const contacts = await getQualifiedContacts();

    const response: ContactsResponse = {
      contacts,
      total: contacts.length
    };

    res.json(response);
  } catch (error) {
    console.error('✗ Error fetching qualified contacts:', error);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch qualified contacts'
    });
  }
});

/**
 * GET /contacts/stats
 * Returns contact statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [total, pending, qualified, disqualified] = await Promise.all([
      getContactCount(),
      getContactCount('pending'),
      getContactCount('qualified'),
      getContactCount('disqualified')
    ]);

    res.json({
      total,
      pending,
      qualified,
      disqualified,
      processed: qualified + disqualified
    });
  } catch (error) {
    console.error('✗ Error fetching stats:', error);

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch stats'
    });
  }
});

export default router;
