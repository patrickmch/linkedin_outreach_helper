/**
 * Contact Storage Service
 * Handles all Redis operations for contacts
 */

import { getRedisClient } from '../redis-client.js';
import { Contact, LinkedInProfile, ContactStatus } from '../types.js';

const CONTACT_KEY_PREFIX = 'contact:';
const PENDING_SET = 'contacts:pending';
const QUALIFIED_SET = 'contacts:qualified';
const DISQUALIFIED_SET = 'contacts:disqualified';

/**
 * Create a new contact in Redis
 */
export async function createContact(profile: LinkedInProfile): Promise<Contact> {
  const redis = getRedisClient();

  const contact: Contact = {
    rawData: profile,
    status: 'pending',
    qualificationScore: null,
    qualificationReason: null,
    processedAt: null,
    sentToHeyreachAt: null,
    createdAt: new Date().toISOString()
  };

  const key = `${CONTACT_KEY_PREFIX}${profile.linkedinUrl}`;

  // Store contact (Upstash Redis handles JSON serialization)
  await redis.set(key, contact);

  // Add to pending set
  await redis.sadd(PENDING_SET, profile.linkedinUrl);

  console.log(`✓ Created contact: ${profile.name} (${profile.linkedinUrl})`);

  return contact;
}

/**
 * Get a contact by LinkedIn URL
 */
export async function getContact(linkedinUrl: string): Promise<Contact | null> {
  const redis = getRedisClient();
  const key = `${CONTACT_KEY_PREFIX}${linkedinUrl}`;

  const data = await redis.get<Contact>(key);

  if (!data) {
    return null;
  }

  return data;
}

/**
 * Update a contact's status and qualification data
 */
export async function updateContact(
  linkedinUrl: string,
  updates: Partial<Contact>
): Promise<Contact | null> {
  const redis = getRedisClient();
  const contact = await getContact(linkedinUrl);

  if (!contact) {
    return null;
  }

  const updatedContact: Contact = {
    ...contact,
    ...updates
  };

  const key = `${CONTACT_KEY_PREFIX}${linkedinUrl}`;
  await redis.set(key, updatedContact);

  // Update status sets if status changed
  if (updates.status && updates.status !== contact.status) {
    await moveContactBetweenSets(linkedinUrl, contact.status, updates.status);
  }

  console.log(`✓ Updated contact: ${contact.rawData.name} - Status: ${updatedContact.status}`);

  return updatedContact;
}

/**
 * Move contact between status sets
 */
async function moveContactBetweenSets(
  linkedinUrl: string,
  oldStatus: ContactStatus,
  newStatus: ContactStatus
): Promise<void> {
  const redis = getRedisClient();

  const oldSet = getSetForStatus(oldStatus);
  const newSet = getSetForStatus(newStatus);

  if (oldSet) {
    await redis.srem(oldSet, linkedinUrl);
  }

  if (newSet) {
    await redis.sadd(newSet, linkedinUrl);
  }
}

/**
 * Get Redis set name for status
 */
function getSetForStatus(status: ContactStatus): string | null {
  switch (status) {
    case 'pending':
      return PENDING_SET;
    case 'qualified':
      return QUALIFIED_SET;
    case 'disqualified':
      return DISQUALIFIED_SET;
    default:
      return null;
  }
}

/**
 * Get all contacts
 */
export async function getAllContacts(): Promise<Contact[]> {
  const redis = getRedisClient();

  // Get all contact keys
  const keys = await redis.keys(`${CONTACT_KEY_PREFIX}*`);

  if (keys.length === 0) {
    return [];
  }

  // Fetch all contacts
  const contacts: Contact[] = [];

  for (const key of keys) {
    const data = await redis.get<Contact>(key);
    if (data) {
      contacts.push(data);
    }
  }

  return contacts;
}

/**
 * Get contacts by status
 */
export async function getContactsByStatus(status: ContactStatus): Promise<Contact[]> {
  const redis = getRedisClient();
  const setName = getSetForStatus(status);

  if (!setName) {
    return [];
  }

  // Get all LinkedIn URLs in the set
  const linkedinUrls = await redis.smembers(setName);

  if (linkedinUrls.length === 0) {
    return [];
  }

  // Fetch each contact
  const contacts: Contact[] = [];

  for (const linkedinUrl of linkedinUrls) {
    const contact = await getContact(linkedinUrl);
    if (contact) {
      contacts.push(contact);
    }
  }

  return contacts;
}

/**
 * Get pending contacts
 */
export async function getPendingContacts(): Promise<Contact[]> {
  return getContactsByStatus('pending');
}

/**
 * Get qualified contacts
 */
export async function getQualifiedContacts(): Promise<Contact[]> {
  return getContactsByStatus('qualified');
}

/**
 * Get contact count by status
 */
export async function getContactCount(status?: ContactStatus): Promise<number> {
  const redis = getRedisClient();

  if (!status) {
    // Count all contacts
    const keys = await redis.keys(`${CONTACT_KEY_PREFIX}*`);
    return keys.length;
  }

  const setName = getSetForStatus(status);
  if (!setName) {
    return 0;
  }

  return await redis.scard(setName);
}
