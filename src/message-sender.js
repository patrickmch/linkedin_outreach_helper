import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Heyreach Message Sender
 * Sends LinkedIn messages to accepted connections via Heyreach API
 */

/**
 * Send a LinkedIn message via Heyreach
 * @param {string} linkedInAccountId - Your LinkedIn sender account ID
 * @param {string} recipientLinkedInUrl - Recipient's LinkedIn profile URL
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} Response from Heyreach
 */
async function sendLinkedInMessage(linkedInAccountId, recipientLinkedInUrl, message) {
  const { apiKey, baseUrl } = config.heyreach;

  const url = `${baseUrl}/inbox/SendMessage`;

  // Request body format (need to verify exact structure from example)
  const payload = {
    linkedInAccountId: linkedInAccountId,
    recipientUrl: recipientLinkedInUrl, // May need adjustment based on actual API
    message: message
  };

  console.log(`Sending message via Heyreach API...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'text/plain'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Heyreach API error (${response.status}): ${errorText}`);
    }

    const data = await response.text(); // API returns text/plain
    return {
      success: true,
      response: data
    };
  } catch (error) {
    console.error('Failed to send message via Heyreach:', error.message);
    throw error;
  }
}

/**
 * Load qualified profiles ready to receive messages
 * Criteria: connectionAccepted=true, outreachApproved=true, messageSent!=true
 * @returns {Array} Array of {filepath, profile} objects
 */
function loadProfilesReadyForMessage() {
  const qualifiedDir = './data/qualified';
  const files = readdirSync(qualifiedDir)
    .filter(f => f.endsWith('.json'))
    .map(f => join(qualifiedDir, f));

  const profiles = [];
  for (const filepath of files) {
    try {
      const profile = JSON.parse(readFileSync(filepath, 'utf-8'));

      // Must be: connected + approved + has message + not sent yet
      if (
        profile.connectionAccepted === true &&
        profile.outreachApproved === true &&
        profile.outreachMessage &&
        profile.messageSent !== true
      ) {
        profiles.push({ filepath, profile });
      }
    } catch (error) {
      console.error(`Warning: Could not read ${filepath}: ${error.message}`);
    }
  }

  return profiles;
}

/**
 * Send messages to all ready profiles
 * @returns {Object} Stats about messages sent
 */
export async function sendMessagesToReadyProfiles() {
  if (!config.heyreach?.linkedInAccountId) {
    throw new Error('LinkedIn Account ID not configured in config.json (heyreach.linkedInAccountId)');
  }

  const linkedInAccountId = config.heyreach.linkedInAccountId;

  console.log('='.repeat(60));
  console.log('Heyreach Message Sender');
  console.log('='.repeat(60));
  console.log(`LinkedIn Account ID: ${linkedInAccountId}`);
  console.log('');

  // Load profiles ready for messaging
  const profiles = loadProfilesReadyForMessage();

  console.log(`Found ${profiles.length} profiles ready to receive messages`);
  console.log('  (Connected + Approved + Not yet sent)');
  console.log('');

  if (profiles.length === 0) {
    console.log('No messages to send');
    return {
      total: 0,
      sent: 0,
      failed: 0
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const { filepath, profile } of profiles) {
    console.log(`[${sentCount + failedCount + 1}/${profiles.length}] ${profile.name}`);

    try {
      // Send message via Heyreach
      const result = await sendLinkedInMessage(
        linkedInAccountId,
        profile.url,
        profile.outreachMessage
      );

      // Update profile with sent status
      profile.messageSent = true;
      profile.messageSentAt = new Date().toISOString();
      profile.messageSentResponse = result.response;

      writeFileSync(filepath, JSON.stringify(profile, null, 2));
      console.log(`  ✓ Message sent successfully`);
      sentCount++;

    } catch (error) {
      // Update profile with error status
      profile.messageSent = false;
      profile.messageError = error.message;
      profile.messageAttemptedAt = new Date().toISOString();

      writeFileSync(filepath, JSON.stringify(profile, null, 2));
      console.error(`  ✗ Failed: ${error.message}`);
      failedCount++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total profiles: ${profiles.length}`);
  console.log(`Messages sent: ${sentCount}`);
  console.log(`Failed: ${failedCount}`);

  return {
    total: profiles.length,
    sent: sentCount,
    failed: failedCount
  };
}
