#!/usr/bin/env node

/**
 * Batch Qualification Script
 * Processes unqualified profiles in batches and saves results
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAllProfiles } from './src/csv-loader.js';
import { config } from './src/config.js';
import { addProspectToCampaign } from './src/heyreach-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = __dirname;
const QUALIFIED_DIR = join(PROJECT_ROOT, 'data', 'qualified');
const DISQUALIFIED_DIR = join(PROJECT_ROOT, 'data', 'disqualified');

/**
 * Ensure directories exist
 */
function ensureDirs() {
  if (!existsSync(QUALIFIED_DIR)) {
    mkdirSync(QUALIFIED_DIR, { recursive: true });
  }
  if (!existsSync(DISQUALIFIED_DIR)) {
    mkdirSync(DISQUALIFIED_DIR, { recursive: true });
  }
}

/**
 * Get list of already processed profile names
 */
function getProcessedProfileNames() {
  const names = new Set();

  ensureDirs();

  // Get qualified profiles
  const qualifiedFiles = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  qualifiedFiles.forEach(file => {
    try {
      const filepath = join(QUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      names.add(data.name);
    } catch (error) {
      // Skip invalid files
    }
  });

  // Get disqualified profiles
  const disqualifiedFiles = readdirSync(DISQUALIFIED_DIR).filter(f => f.endsWith('.json'));
  disqualifiedFiles.forEach(file => {
    try {
      const filepath = join(DISQUALIFIED_DIR, file);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      names.add(data.name);
    } catch (error) {
      // Skip invalid files
    }
  });

  return names;
}

/**
 * Get next batch of unprocessed profiles
 */
function getNextBatch(batchSize = 5) {
  const allProfiles = loadAllProfiles();
  const processedNames = getProcessedProfileNames();
  const unprocessed = allProfiles.filter(p => !processedNames.has(p.name));

  return unprocessed.slice(0, batchSize);
}

/**
 * Save qualification result
 */
async function saveQualification(profileName, qualificationData) {
  const allProfiles = loadAllProfiles();
  const profile = allProfiles.find(p => p.name === profileName);

  if (!profile) {
    throw new Error(`Profile not found: ${profileName}`);
  }

  const { qualified, score, reasoning, strengths, concerns, recommendedApproach } = qualificationData;

  if (qualified && score >= config.minScore) {
    // Save to qualified directory
    ensureDirs();
    const timestamp = Date.now();
    const filename = `qualified_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = join(QUALIFIED_DIR, filename);

    const prospect = {
      ...profile,
      qualification: {
        isQualified: true,
        analysis: {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        },
        qualifiedAt: new Date().toISOString()
      }
    };

    // Try to send to Heyreach automatically
    if (config.heyreach && config.heyreach.apiKey) {
      try {
        console.log(`Sending ${profileName} to Heyreach...`);
        const heyreachResult = await addProspectToCampaign(profile);

        prospect.heyreach = {
          sent: true,
          sentAt: new Date().toISOString(),
          heyreachId: heyreachResult.heyreachId,
          listId: config.heyreach.listId
        };

        console.log(`✓ Successfully sent ${profileName} to Heyreach`);
      } catch (error) {
        console.log(`✗ Failed to send ${profileName} to Heyreach: ${error.message}`);

        prospect.heyreach = {
          sent: false,
          error: error.message,
          attemptedAt: new Date().toISOString()
        };
      }
    }

    writeFileSync(filepath, JSON.stringify(prospect, null, 2));

    return {
      saved: true,
      filepath,
      qualified: true,
      heyreachSent: prospect.heyreach?.sent || false
    };
  } else {
    // Save to disqualified directory
    ensureDirs();
    const timestamp = Date.now();
    const filename = `disqualified_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filepath = join(DISQUALIFIED_DIR, filename);

    const prospect = {
      ...profile,
      qualification: {
        isQualified: false,
        analysis: {
          qualified,
          score,
          reasoning,
          strengths,
          concerns,
          recommendedApproach
        },
        disqualifiedAt: new Date().toISOString()
      }
    };

    writeFileSync(filepath, JSON.stringify(prospect, null, 2));

    return { saved: true, filepath, qualified: false };
  }
}

/**
 * Get stats
 */
function getStats() {
  const allProfiles = loadAllProfiles();
  const processedNames = getProcessedProfileNames();
  const unprocessed = allProfiles.filter(p => !processedNames.has(p.name));

  const qualifiedFiles = readdirSync(QUALIFIED_DIR).filter(f => f.endsWith('.json'));
  const disqualifiedFiles = readdirSync(DISQUALIFIED_DIR).filter(f => f.endsWith('.json'));

  return {
    total: allProfiles.length,
    qualified: qualifiedFiles.length,
    disqualified: disqualifiedFiles.length,
    remaining: unprocessed.length,
    processed: processedNames.size
  };
}

// Export functions for use in interactive mode
export {
  getNextBatch,
  saveQualification,
  getStats,
  getProcessedProfileNames
};

// If run directly, show stats
if (import.meta.url === `file://${process.argv[1]}`) {
  const stats = getStats();
  console.log('\n📊 Qualification Statistics:');
  console.log(`   Total profiles: ${stats.total}`);
  console.log(`   Qualified: ${stats.qualified}`);
  console.log(`   Disqualified: ${stats.disqualified}`);
  console.log(`   Remaining: ${stats.remaining}`);
  console.log(`   Processed: ${stats.processed}\n`);
}
