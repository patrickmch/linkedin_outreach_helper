#!/usr/bin/env node

/**
 * Check Acceptances Script
 * Syncs accepted connections from Heyreach via API
 * Requires API server to be running
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const CAMPAIGN_ID = process.env.HEYREACH_CAMPAIGN_ID;

console.log('Checking for accepted connections from Heyreach...\n');

try {
  if (!CAMPAIGN_ID) {
    throw new Error('HEYREACH_CAMPAIGN_ID environment variable is required');
  }

  // Call API to sync connections
  const response = await fetch(`${API_URL}/api/connections/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ campaign_id: CAMPAIGN_ID })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Sync failed: ${errorData.error || response.statusText}`);
  }

  const result = await response.json();

  console.log('='.repeat(50));
  console.log('✓ Acceptance check complete!');
  console.log(`  New connections: ${result.new_connections}`);
  console.log(`  Updated connections: ${result.updated_connections}`);
  console.log(`  Total processed: ${result.total_processed}`);
  console.log('='.repeat(50));

  process.exit(0);

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error('\nMake sure:');
  console.error('  1. API server is running (npm start)');
  console.error('  2. API_URL is correct:', API_URL);
  console.error('  3. HEYREACH_CAMPAIGN_ID is set');
  process.exit(1);
}
