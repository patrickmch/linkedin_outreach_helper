import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Heyreach Acceptance Tracker
 * Checks Heyreach campaign for accepted connections and updates profile JSONs
 */

/**
 * Fetch leads from Heyreach campaign with pagination
 * @param {number} campaignId - Campaign ID
 * @param {number} offset - Records to skip
 * @param {number} limit - Max records to return
 * @returns {Promise<Object>} Response with items and totalCount
 */
async function getCampaignLeads(campaignId, offset = 0, limit = 100) {
  const { apiKey, baseUrl } = config.heyreach;

  const url = `${baseUrl}/campaign/GetLeadsFromCampaign`;
  const payload = {
    campaignId: parseInt(campaignId),
    offset,
    limit,
    timeFilter: "Everywhere" // Get all leads regardless of time
  };

  console.log(`Fetching leads from campaign ${campaignId}, offset ${offset}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Heyreach API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Get all leads from campaign (handles pagination automatically)
 * @param {number} campaignId - Campaign ID
 * @returns {Promise<Array>} All leads
 */
async function getAllCampaignLeads(campaignId) {
  const allLeads = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await getCampaignLeads(campaignId, offset, limit);
    const leads = result.items || [];

    if (leads.length === 0) {
      break;
    }

    allLeads.push(...leads);
    console.log(`  Fetched ${leads.length} leads (total so far: ${allLeads.length})`);

    // Check if we've fetched all leads
    const totalCount = result.totalCount || 0;
    if (totalCount && allLeads.length >= totalCount) {
      break;
    }

    // If we got less than requested, we're done
    if (leads.length < limit) {
      break;
    }

    offset += limit;
  }

  console.log(`Fetched total of ${allLeads.length} leads from campaign`);
  return allLeads;
}

/**
 * Check if a lead has accepted the connection
 * @param {Object} lead - Lead data from Heyreach
 * @returns {boolean}
 */
function isConnectionAccepted(lead) {
  const status = lead.leadConnectionStatus || '';
  return status === 'ConnectionAccepted';
}

/**
 * Extract LinkedIn URL from lead (various possible field names)
 * @param {Object} lead - Lead data from Heyreach
 * @returns {string|null}
 */
function getLinkedInUrl(lead) {
  const profile = lead.linkedInUserProfile || {};
  return profile.profileUrl || lead.profile_url || null;
}

/**
 * Load all qualified profiles from data/qualified/
 * @returns {Array} Array of {filepath, profile} objects
 */
function loadQualifiedProfiles() {
  const qualifiedDir = './data/qualified';
  const files = readdirSync(qualifiedDir)
    .filter(f => f.endsWith('.json'))
    .map(f => join(qualifiedDir, f));

  const profiles = [];
  for (const filepath of files) {
    try {
      const profile = JSON.parse(readFileSync(filepath, 'utf-8'));
      profiles.push({ filepath, profile });
    } catch (error) {
      console.error(`Warning: Could not read ${filepath}: ${error.message}`);
    }
  }

  return profiles;
}

/**
 * Normalize LinkedIn URL by removing trailing slash
 * @param {string} url - LinkedIn URL
 * @returns {string}
 */
function normalizeLinkedInUrl(url) {
  return url.replace(/\/$/, '');
}

/**
 * Match accepted leads to qualified profiles and update JSONs
 * @param {Array} acceptedLeads - Leads with accepted connections
 * @returns {number} Number of profiles updated
 */
function updateProfilesWithAcceptances(acceptedLeads) {
  const profiles = loadQualifiedProfiles();
  let updatedCount = 0;

  console.log(`\nMatching ${acceptedLeads.length} accepted connections to qualified profiles...`);

  for (const lead of acceptedLeads) {
    const linkedinUrl = getLinkedInUrl(lead);
    if (!linkedinUrl) {
      console.log(`  ⚠ Skipping lead (no LinkedIn URL): ${lead.id}`);
      continue;
    }

    // Normalize URLs for comparison (remove trailing slashes)
    const normalizedLeadUrl = normalizeLinkedInUrl(linkedinUrl);

    // Find matching profile by LinkedIn URL
    const match = profiles.find(p => normalizeLinkedInUrl(p.profile.url) === normalizedLeadUrl);

    if (!match) {
      console.log(`  ⚠ No matching profile found for: ${linkedinUrl}`);
      continue;
    }

    // Skip if already marked as accepted
    if (match.profile.connectionAccepted) {
      console.log(`  ℹ Already marked as accepted: ${match.profile.name}`);
      continue;
    }

    // Update profile with acceptance data
    match.profile.connectionAccepted = true;
    match.profile.connectionAcceptedAt = new Date().toISOString();
    match.profile.heyreachLeadId = lead.id;
    match.profile.outreachSent = false; // Initialize for follow-up tracking

    // Write updated profile back to file
    writeFileSync(match.filepath, JSON.stringify(match.profile, null, 2));
    console.log(`  ✓ Updated: ${match.profile.name} (${match.profile.company})`);
    updatedCount++;
  }

  return updatedCount;
}

/**
 * Main function: Check Heyreach for accepted connections and update profiles
 */
export async function checkAcceptedConnections() {
  if (!config.heyreach?.campaignId) {
    throw new Error('Campaign ID not configured in config.json (heyreach.campaignId)');
  }

  const campaignId = config.heyreach.campaignId;

  console.log('='.repeat(60));
  console.log('Heyreach Connection Acceptance Tracker');
  console.log('='.repeat(60));
  console.log(`Campaign ID: ${campaignId}`);
  console.log('');

  // Fetch all leads from campaign
  console.log('Fetching leads from Heyreach...');
  const leads = await getAllCampaignLeads(campaignId);

  // Filter for accepted connections
  const acceptedLeads = leads.filter(isConnectionAccepted);

  console.log('');
  console.log(`Found ${leads.length} total leads in campaign`);
  console.log(`Found ${acceptedLeads.length} leads with accepted connections`);

  if (acceptedLeads.length === 0) {
    console.log('No accepted connections to track');
    return {
      totalLeads: leads.length,
      acceptedLeads: 0,
      updatedProfiles: 0
    };
  }

  // Update profile JSONs
  const updatedCount = updateProfilesWithAcceptances(acceptedLeads);

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total leads in campaign: ${leads.length}`);
  console.log(`Accepted connections: ${acceptedLeads.length}`);
  console.log(`Profiles updated: ${updatedCount}`);
  console.log(`Already tracked: ${acceptedLeads.length - updatedCount}`);

  return {
    totalLeads: leads.length,
    acceptedLeads: acceptedLeads.length,
    updatedProfiles: updatedCount
  };
}
