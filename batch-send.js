#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { addProspectToCampaign } from './src/heyreach-client.js';

const QUALIFIED_DIR = './data/qualified';
const BATCH_SIZE = 999; // Send all remaining

console.log('Finding qualified profiles to send to Heyreach...\n');

// Read all qualified profiles
const files = readdirSync(QUALIFIED_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => join(QUALIFIED_DIR, f));

// Filter for profiles not yet sent to Heyreach
const unsentProfiles = [];
for (const filepath of files) {
  try {
    const profile = JSON.parse(readFileSync(filepath, 'utf-8'));
    // Skip if already sent successfully
    if (!profile.heyreach || profile.heyreach.sent !== true) {
      unsentProfiles.push({ filepath, profile });
    }
  } catch (error) {
    console.error(`Warning: Could not read ${filepath}: ${error.message}`);
  }
}

console.log(`Found ${unsentProfiles.length} profiles not yet sent to Heyreach`);
console.log(`Sending first ${Math.min(BATCH_SIZE, unsentProfiles.length)} profiles...\n`);

// Send first N profiles
const toSend = unsentProfiles.slice(0, BATCH_SIZE);
let successCount = 0;
let failCount = 0;

for (const { filepath, profile } of toSend) {
  console.log(`[${successCount + failCount + 1}/${toSend.length}] ${profile.name}`);

  try {
    const result = await addProspectToCampaign(profile);

    // Update profile with success status
    profile.heyreach = {
      sent: true,
      sentAt: new Date().toISOString(),
      heyreachId: result.heyreachId,
      listId: "406467"
    };

    writeFileSync(filepath, JSON.stringify(profile, null, 2));
    console.log(`  ✓ Sent successfully`);
    successCount++;

  } catch (error) {
    // Update profile with error status
    profile.heyreach = {
      sent: false,
      error: error.message,
      attemptedAt: new Date().toISOString()
    };

    writeFileSync(filepath, JSON.stringify(profile, null, 2));
    console.error(`  ✗ Failed: ${error.message}`);
    failCount++;
  }

  console.log('');
}

console.log('='.repeat(50));
console.log(`Batch send complete!`);
console.log(`  Success: ${successCount}`);
console.log(`  Failed: ${failCount}`);
console.log(`  Remaining: ${unsentProfiles.length - toSend.length}`);
console.log('='.repeat(50));
