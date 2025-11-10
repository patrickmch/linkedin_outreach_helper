#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { addProspectToCampaign } from './src/heyreach-client.js';

// Read the test profile
const profilePath = './data/qualified/qualified_1730937600000_Patrick_McHeyser.json';
const profile = JSON.parse(readFileSync(profilePath, 'utf-8'));

console.log('Testing Heyreach integration...');
console.log(`Profile: ${profile.name}`);
console.log(`URL: ${profile.url}`);
console.log('');

try {
  console.log('Sending to Heyreach API...');
  const result = await addProspectToCampaign(profile);

  console.log('✓ Successfully sent to Heyreach!');
  console.log(`  Heyreach ID: ${result.heyreachId}`);
  console.log('');

  // Update profile with heyreach data
  profile.heyreach = {
    sent: true,
    sentAt: new Date().toISOString(),
    heyreachId: result.heyreachId,
    listId: "406467"
  };

  writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  console.log('✓ Updated profile with Heyreach send status');
  console.log('');
  console.log('Test complete! Check your Heyreach dashboard for the new lead.');

} catch (error) {
  console.error('✗ Failed to send to Heyreach:', error.message);

  // Update profile with error
  profile.heyreach = {
    sent: false,
    error: error.message,
    attemptedAt: new Date().toISOString()
  };

  writeFileSync(profilePath, JSON.stringify(profile, null, 2));
  console.log('✓ Updated profile with error status');
  process.exit(1);
}
