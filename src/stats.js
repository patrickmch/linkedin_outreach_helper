import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getTodayString } from './utils.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const STATS_FILE = join(PROJECT_ROOT, 'data', 'stats.json');

/**
 * Load stats from file
 */
function loadStats() {
  if (!existsSync(STATS_FILE)) {
    return {
      dailyStats: {},
      totalProfilesViewed: 0,
      totalQualified: 0,
      totalDisqualified: 0
    };
  }

  try {
    const data = readFileSync(STATS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading stats:', error.message);
    return {
      dailyStats: {},
      totalProfilesViewed: 0,
      totalQualified: 0,
      totalDisqualified: 0
    };
  }
}

/**
 * Save stats to file
 */
function saveStats(stats) {
  try {
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error saving stats:', error.message);
  }
}

/**
 * Get today's stats
 */
export function getTodayStats() {
  const stats = loadStats();
  const today = getTodayString();

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      profilesViewed: 0,
      qualified: 0,
      disqualified: 0,
      errors: 0
    };
  }

  return stats.dailyStats[today];
}

/**
 * Check if daily limit has been reached
 */
export function canViewMoreProfiles() {
  const todayStats = getTodayStats();
  const maxViews = config.limits.maxProfileViewsPerDay;
  return todayStats.profilesViewed < maxViews;
}

/**
 * Get remaining profile views for today
 */
export function getRemainingViews() {
  const todayStats = getTodayStats();
  const maxViews = config.limits.maxProfileViewsPerDay;
  return Math.max(0, maxViews - todayStats.profilesViewed);
}

/**
 * Increment profile view count
 */
export function incrementProfileViews() {
  const stats = loadStats();
  const today = getTodayString();

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      profilesViewed: 0,
      qualified: 0,
      disqualified: 0,
      errors: 0
    };
  }

  stats.dailyStats[today].profilesViewed++;
  stats.totalProfilesViewed++;

  saveStats(stats);
}

/**
 * Increment qualified count
 */
export function incrementQualified() {
  const stats = loadStats();
  const today = getTodayString();

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      profilesViewed: 0,
      qualified: 0,
      disqualified: 0,
      errors: 0
    };
  }

  stats.dailyStats[today].qualified++;
  stats.totalQualified++;

  saveStats(stats);
}

/**
 * Increment disqualified count
 */
export function incrementDisqualified() {
  const stats = loadStats();
  const today = getTodayString();

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      profilesViewed: 0,
      qualified: 0,
      disqualified: 0,
      errors: 0
    };
  }

  stats.dailyStats[today].disqualified++;
  stats.totalDisqualified++;

  saveStats(stats);
}

/**
 * Increment error count
 */
export function incrementErrors() {
  const stats = loadStats();
  const today = getTodayString();

  if (!stats.dailyStats[today]) {
    stats.dailyStats[today] = {
      date: today,
      profilesViewed: 0,
      qualified: 0,
      disqualified: 0,
      errors: 0
    };
  }

  stats.dailyStats[today].errors++;

  saveStats(stats);
}

/**
 * Get all stats
 */
export function getAllStats() {
  return loadStats();
}

/**
 * Display stats in a formatted way
 */
export function displayStats() {
  const stats = loadStats();
  const today = getTodayString();
  const todayStats = stats.dailyStats[today] || {
    profilesViewed: 0,
    qualified: 0,
    disqualified: 0,
    errors: 0
  };

  console.log('\n=== LinkedIn Outreach Helper Stats ===\n');

  console.log('Today (' + today + '):');
  console.log('  Profiles viewed: ' + todayStats.profilesViewed + '/' + config.limits.maxProfileViewsPerDay);
  console.log('  Qualified: ' + todayStats.qualified);
  console.log('  Disqualified: ' + todayStats.disqualified);
  console.log('  Errors: ' + todayStats.errors);
  console.log('  Remaining views: ' + getRemainingViews());

  console.log('\nAll Time:');
  console.log('  Total profiles viewed: ' + stats.totalProfilesViewed);
  console.log('  Total qualified: ' + stats.totalQualified);
  console.log('  Total disqualified: ' + stats.totalDisqualified);

  if (stats.totalQualified + stats.totalDisqualified > 0) {
    const qualificationRate = (
      (stats.totalQualified / (stats.totalQualified + stats.totalDisqualified)) *
      100
    ).toFixed(1);
    console.log('  Qualification rate: ' + qualificationRate + '%');
  }

  console.log('\nRecent Days:');
  const recentDays = Object.keys(stats.dailyStats)
    .sort()
    .reverse()
    .slice(0, 7);

  recentDays.forEach((date) => {
    const dayStats = stats.dailyStats[date];
    console.log(
      `  ${date}: ${dayStats.profilesViewed} viewed, ${dayStats.qualified} qualified, ${dayStats.disqualified} disqualified`
    );
  });

  console.log('\n');
}
