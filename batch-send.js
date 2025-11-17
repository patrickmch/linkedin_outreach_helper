#!/usr/bin/env node

/**
 * Batch Send Script
 * Sends qualified profiles to Heyreach campaign via API
 * Requires API server to be running
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const BATCH_SIZE = 999; // Send all remaining

console.log('Finding qualified profiles to send to Heyreach...\n');

try {
  // Get all qualified profiles that haven't been sent
  const response = await fetch(`${API_URL}/api/profiles?status=qualified&limit=1000`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const profiles = data.profiles || [];

  // Filter for profiles without outreach tracking
  const unsentProfiles = [];
  for (const profile of profiles) {
    // Check if profile has been sent to outreach
    const outreachCheck = await fetch(`${API_URL}/api/outreach/status`);
    // For now, just collect all qualified profiles
    unsentProfiles.push(profile);
  }

  console.log(`Found ${unsentProfiles.length} qualified profiles`);
  console.log(`Sending first ${Math.min(BATCH_SIZE, unsentProfiles.length)} profiles...\n`);

  // Prepare profile IDs to send
  const toSend = unsentProfiles.slice(0, BATCH_SIZE);
  const profileIds = toSend.map(p => p.id);

  if (profileIds.length === 0) {
    console.log('No profiles to send!');
    process.exit(0);
  }

  // Send to Heyreach via API
  const sendResponse = await fetch(`${API_URL}/api/outreach/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ profile_ids: profileIds })
  });

  if (!sendResponse.ok) {
    const errorData = await sendResponse.json();
    throw new Error(`Send failed: ${errorData.error || sendResponse.statusText}`);
  }

  const result = await sendResponse.json();

  console.log('='.repeat(50));
  console.log(`Batch send complete!`);
  console.log(`  Success: ${result.sent}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Total: ${result.total}`);
  if (result.errors) {
    console.log('\nErrors:');
    result.errors.forEach(err => {
      console.log(`  - Profile ${err.profile_id}: ${err.error}`);
    });
  }
  console.log('='.repeat(50));

  process.exit(0);

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error('\nMake sure:');
  console.error('  1. API server is running (npm start)');
  console.error('  2. API_URL is correct:', API_URL);
  process.exit(1);
}
