import { config } from './config.js';

/**
 * Heyreach API Client
 * Handles adding prospects to Heyreach campaigns
 */

/**
 * Add a lead to a Heyreach list (which triggers the campaign)
 * @param {Object} profile - Profile object with name, url, title, company, etc.
 * @returns {Promise<Object>} - Heyreach response with lead ID
 */
export async function addProspectToCampaign(profile) {
  if (!config.heyreach) {
    throw new Error('Heyreach configuration not found in config.json');
  }

  const { apiKey, listId, baseUrl } = config.heyreach;

  if (!apiKey || !listId) {
    throw new Error('Heyreach API key and list ID are required');
  }

  // Extract LinkedIn profile URL
  const linkedinUrl = profile.url;
  if (!linkedinUrl) {
    throw new Error('LinkedIn profile URL is required');
  }

  // Parse name into first/last (best effort)
  const nameParts = profile.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build lead object according to Heyreach API format
  const lead = {
    firstName: firstName,
    lastName: lastName,
    location: profile.location || '',
    summary: profile.title || '',
    companyName: profile.company || '',
    position: profile.title || '',
    about: profile.about || '',
    emailAddress: '', // We don't have email addresses from LinkedIn scraping
    profileUrl: linkedinUrl
  };

  // Build request body - array of leads + listId
  const requestBody = {
    leads: [lead],
    listId: parseInt(listId)
  };

  try {
    const response = await fetch(`${baseUrl}/list/AddLeadsToListV2`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Heyreach API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      heyreachId: data.id || data.leadId || linkedinUrl, // Use URL as fallback ID
      response: data
    };
  } catch (error) {
    console.error('Failed to add lead to Heyreach:', error.message);
    throw error;
  }
}

/**
 * Get failed Heyreach sends from qualified profiles
 * @param {Array} qualifiedProfiles - Array of qualified profile objects
 * @returns {Array} - Profiles that failed to send to Heyreach
 */
export function getFailedHeyreachSends(qualifiedProfiles) {
  return qualifiedProfiles.filter(p => {
    return p.heyreach && p.heyreach.sent === false && p.heyreach.error;
  });
}
