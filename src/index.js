#!/usr/bin/env node

import { Command } from 'commander';
import { launchBrowser, ensureLoggedIn } from './browser.js';
import { scrapeFromSalesNav, loadAllProfiles } from './scraper.js';
import { qualifyAllProfiles, exportProfilesForReview, buildQualificationPrompt } from './qualifier.js';
import { displayStats, getRemainingViews } from './stats.js';
import { config } from './config.js';

const program = new Command();

program
  .name('linkedin-outreach-helper')
  .description('LinkedIn Sales Navigator scraper with AI-powered lead qualification')
  .version('1.0.0');

/**
 * Scrape command
 */
program
  .command('scrape')
  .description('Scrape LinkedIn profiles from Sales Navigator')
  .option('-u, --url <url>', 'Sales Navigator search URL')
  .option('-n, --number <number>', 'Number of profiles to scrape', '10')
  .action(async (options) => {
    try {
      console.log('\n🚀 LinkedIn Outreach Helper - Scraper\n');

      const maxProfiles = parseInt(options.number, 10);

      if (!options.url) {
        console.error('Error: Sales Navigator search URL is required');
        console.error('Usage: npm run scrape -- --url "YOUR_SALES_NAV_URL" --number 10');
        console.error('\nExample:');
        console.error('  npm run scrape -- --url "https://www.linkedin.com/sales/search/people?query=..." --number 20');
        process.exit(1);
      }

      console.log(`Max profiles to scrape: ${maxProfiles}`);
      console.log(`Remaining views today: ${getRemainingViews()}`);
      console.log('');

      // Launch browser
      const browser = await launchBrowser();
      const page = await browser.newPage();

      // Login
      await ensureLoggedIn(page);

      // Scrape profiles
      await scrapeFromSalesNav(page, options.url, maxProfiles);

      // Close browser
      await browser.close();

      console.log('\n✓ Scraping complete!');
      console.log('\nNext steps:');
      console.log('  1. Run "npm run qualify" to qualify the leads');
      console.log('  2. Run "npm run stats" to see your stats');
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Qualify command
 */
program
  .command('qualify')
  .description('Qualify scraped profiles using Claude AI')
  .action(async () => {
    try {
      console.log('\n🤖 LinkedIn Outreach Helper - Qualifier\n');

      await qualifyAllProfiles();

      console.log('\n✓ Qualification complete!');
      console.log('\nNext steps:');
      console.log('  1. Check data/qualified/ for qualified prospects');
      console.log('  2. Run "npm run stats" to see your stats');
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Stats command
 */
program
  .command('stats')
  .description('Display statistics')
  .action(async () => {
    try {
      displayStats();
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Login command (for testing)
 */
program
  .command('login')
  .description('Test LinkedIn login and save session')
  .action(async () => {
    try {
      console.log('\n🔐 LinkedIn Outreach Helper - Login Test\n');

      const browser = await launchBrowser();
      const page = await browser.newPage();

      await ensureLoggedIn(page);

      console.log('\n✓ Login successful!');
      console.log('Session has been saved. You can now run scrape commands.');

      // Keep browser open for a few seconds so user can see
      console.log('\nClosing browser in 3 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      await browser.close();
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Config command - show current configuration
 */
program
  .command('config')
  .description('Display current configuration (sanitized)')
  .action(() => {
    console.log('\n⚙️  Current Configuration:\n');
    console.log('LinkedIn:');
    console.log(`  Email: ${config.linkedin.email}`);
    console.log(`  Password: ${'*'.repeat(config.linkedin.password.length)}`);
    console.log('');
    console.log('Claude API:');
    console.log(`  API Key: ${config.claude.apiKey.substring(0, 20)}...`);
    console.log('');
    console.log('Limits:');
    console.log(`  Max profiles per day: ${config.limits.maxProfileViewsPerDay}`);
    console.log(`  Delay range: ${config.limits.minDelaySeconds}-${config.limits.maxDelaySeconds}s`);
    console.log(`  Delay std dev: ${config.limits.delayStdDev}s`);
    console.log('');
    console.log('Qualification Criteria:');
    config.qualification.criteria.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c}`);
    });
    console.log('');
  });

/**
 * Export command - export profiles for manual review
 */
program
  .command('export')
  .description('Export scraped profiles to markdown for manual review with Claude Code')
  .action(() => {
    try {
      console.log('\n📋 Exporting Profiles for Manual Review\n');
      exportProfilesForReview();
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Review command - get qualification prompt for a specific profile
 */
program
  .command('review')
  .description('Generate qualification prompt for manual review')
  .option('-i, --index <number>', 'Profile index (1-based)', '1')
  .action((options) => {
    try {
      console.log('\n🔍 Profile Review\n');

      const profiles = loadAllProfiles();
      if (profiles.length === 0) {
        console.log('No profiles found to review.');
        console.log('Run the scrape command first to collect profiles.');
        process.exit(1);
      }

      const index = parseInt(options.index, 10) - 1;
      if (index < 0 || index >= profiles.length) {
        console.error(`Invalid index. Must be between 1 and ${profiles.length}`);
        process.exit(1);
      }

      const profile = profiles[index];
      const prompt = buildQualificationPrompt(profile);

      console.log(`Profile ${index + 1} of ${profiles.length}`);
      console.log(`Name: ${profile.name}`);
      console.log(`Title: ${profile.title}`);
      console.log(`Company: ${profile.company}\n`);
      console.log('='.repeat(80));
      console.log('\nCopy and paste this prompt to Claude Code:\n');
      console.log('='.repeat(80));
      console.log('\n' + prompt + '\n');
      console.log('='.repeat(80));
      console.log('\nNext profile: npm run start review -- --index ' + (index + 2));
      console.log('');
    } catch (error) {
      console.error('\n✗ Error:', error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();

// If no command specified, show help
if (process.argv.length === 2) {
  program.help();
}
