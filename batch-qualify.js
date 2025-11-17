#!/usr/bin/env node

/**
 * Batch Qualification Script
 * Gets qualification statistics via API
 * Requires API server to be running
 *
 * Note: For actual qualification, use the API endpoints:
 *   POST /api/qualifications - Single qualification
 *   POST /api/qualifications/batch - Batch qualification
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

console.log('Fetching qualification statistics...\n');

try {
  // Get comprehensive stats from API
  const response = await fetch(`${API_URL}/api/stats`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  console.log('='.repeat(50));
  console.log('📊 Qualification Statistics');
  console.log('='.repeat(50));
  console.log('\nProfiles:');
  console.log(`  Total: ${data.profiles.total}`);
  console.log(`  New (unqualified): ${data.profiles.new}`);
  console.log(`  Qualified: ${data.profiles.qualified}`);
  console.log(`  Rejected: ${data.profiles.rejected}`);
  console.log(`  Contacted: ${data.profiles.contacted}`);

  if (data.qualifications) {
    console.log('\nQualifications:');
    console.log(`  Total processed: ${data.qualifications.total}`);
    console.log(`  Qualified: ${data.qualifications.qualified}`);
    console.log(`  Rejected: ${data.qualifications.rejected}`);
    console.log(`  Avg score (qualified): ${data.qualifications.avg_qualified_score?.toFixed(1) || 'N/A'}`);
    console.log(`  Avg score (overall): ${data.qualifications.avg_overall_score?.toFixed(1) || 'N/A'}`);
  }

  if (data.outreach) {
    console.log('\nOutreach:');
    console.log(`  Sent: ${data.outreach.sent}`);
    console.log(`  Accepted: ${data.outreach.accepted}`);
    console.log(`  Replied: ${data.outreach.replied}`);
    console.log(`  Failed: ${data.outreach.failed}`);
  }

  if (data.connections) {
    console.log('\nConnections:');
    console.log(`  Total: ${data.connections.total}`);
    console.log(`  Follow-up sent: ${data.connections.follow_up_sent}`);
    console.log(`  Pending follow-up: ${data.connections.pending_follow_up}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('\nTo qualify profiles:');
  console.log('  1. Get unqualified profiles: curl "' + API_URL + '/api/profiles?status=new&limit=5"');
  console.log('  2. Qualify: curl -X POST "' + API_URL + '/api/qualifications" -d \'{"profile_id":1,"criteria":{...}}\'');
  console.log('  3. Batch qualify: curl -X POST "' + API_URL + '/api/qualifications/batch" -d \'{"profile_ids":[1,2,3],"criteria":{...}}\'');
  console.log('='.repeat(50));

  process.exit(0);

} catch (error) {
  console.error('\n✗ Error:', error.message);
  console.error('\nMake sure:');
  console.error('  1. API server is running (npm start)');
  console.error('  2. API_URL is correct:', API_URL);
  process.exit(1);
}
