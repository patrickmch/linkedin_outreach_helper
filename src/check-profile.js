import fs from 'fs/promises';
import path from 'path';

/**
 * Check if a profile URL has already been scraped
 */
async function checkProfile(profileUrl) {
  const results = {
    found: false,
    locations: []
  };

  // Check profiles directory
  const profilesDir = path.join(process.cwd(), 'profiles');
  try {
    const files = await fs.readdir(profilesDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(profilesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const profile = JSON.parse(content);

        if (profile.url === profileUrl) {
          results.found = true;
          results.locations.push({
            type: 'scraped',
            file: file,
            name: profile.name,
            scrapedAt: profile.scrapedAt
          });
        }
      }
    }
  } catch (error) {
    // Profiles directory doesn't exist or is empty
  }

  // Check qualified directory
  const qualifiedDir = path.join(process.cwd(), 'data', 'qualified');
  try {
    const files = await fs.readdir(qualifiedDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(qualifiedDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const profile = JSON.parse(content);

        if (profile.url === profileUrl) {
          results.found = true;
          results.locations.push({
            type: 'qualified',
            file: file,
            name: profile.name,
            score: profile.qualification?.analysis?.score,
            connectionStatus: profile.connection_request?.status
          });
        }
      }
    }
  } catch (error) {
    // Qualified directory doesn't exist or is empty
  }

  return results;
}

/**
 * List all scraped profile URLs
 */
async function listAllProfiles() {
  const profiles = [];

  // Get all scraped profiles
  const profilesDir = path.join(process.cwd(), 'profiles');
  try {
    const files = await fs.readdir(profilesDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(profilesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const profile = JSON.parse(content);

        profiles.push({
          name: profile.name,
          url: profile.url,
          scrapedAt: profile.scrapedAt,
          qualified: false
        });
      }
    }
  } catch (error) {
    // Profiles directory doesn't exist
  }

  // Check which ones are qualified
  const qualifiedDir = path.join(process.cwd(), 'data', 'qualified');
  try {
    const files = await fs.readdir(qualifiedDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(qualifiedDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const qualProfile = JSON.parse(content);

        const existing = profiles.find(p => p.url === qualProfile.url);
        if (existing) {
          existing.qualified = true;
          existing.score = qualProfile.qualification?.analysis?.score;
          existing.connectionStatus = qualProfile.connection_request?.status;
        }
      }
    }
  } catch (error) {
    // Qualified directory doesn't exist
  }

  return profiles;
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];
  const profileUrl = process.argv[3];

  if (command === 'check' && profileUrl) {
    console.log(`\n=== Checking Profile ===\n`);
    const result = await checkProfile(profileUrl);

    if (result.found) {
      console.log('✓ Profile already scraped!\n');
      for (const location of result.locations) {
        if (location.type === 'scraped') {
          console.log(`  Scraped: ${location.name}`);
          console.log(`  Date: ${location.scrapedAt}`);
          console.log(`  File: ${location.file}\n`);
        } else if (location.type === 'qualified') {
          console.log(`  Qualified: ${location.name}`);
          console.log(`  Score: ${location.score}/100`);
          console.log(`  Connection: ${location.connectionStatus || 'not_sent'}`);
          console.log(`  File: ${location.file}\n`);
        }
      }
    } else {
      console.log('✗ Profile not found - safe to scrape\n');
    }
  } else if (command === 'list') {
    console.log(`\n=== All Scraped Profiles ===\n`);
    const profiles = await listAllProfiles();

    if (profiles.length === 0) {
      console.log('No profiles scraped yet.\n');
    } else {
      profiles.sort((a, b) => new Date(b.scrapedAt) - new Date(a.scrapedAt));

      for (const profile of profiles) {
        const qualifiedMark = profile.qualified ? `✓ [${profile.score}] ` : '  ';
        const connectionMark = profile.connectionStatus ? `[${profile.connectionStatus}]` : '';
        console.log(`${qualifiedMark}${profile.name} ${connectionMark}`);
      }

      console.log(`\nTotal: ${profiles.length} profiles`);
      console.log(`Qualified: ${profiles.filter(p => p.qualified).length}\n`);
    }
  } else {
    console.log('Usage:');
    console.log('  node src/check-profile.js check "<profile-url>"  - Check if URL is already scraped');
    console.log('  node src/check-profile.js list                   - List all scraped profiles');
    process.exit(1);
  }
}

main().catch(console.error);
