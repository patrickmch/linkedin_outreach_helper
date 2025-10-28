import { writeFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sleep, humanDelay, performRandomAction } from './utils.js';
import {
  canViewMoreProfiles,
  getRemainingViews,
  incrementProfileViews,
  incrementErrors
} from './stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const PROFILES_DIR = join(PROJECT_ROOT, 'profiles');

/**
 * Ensure profiles directory exists
 */
function ensureProfilesDir() {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

/**
 * Save profile to JSON file
 */
function saveProfile(profile) {
  ensureProfilesDir();
  const timestamp = Date.now();
  const filename = `profile_${timestamp}_${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
  const filepath = join(PROFILES_DIR, filename);

  writeFileSync(filepath, JSON.stringify(profile, null, 2));
  console.log(`  ✓ Saved to ${filename}`);

  return filepath;
}

/**
 * Scrape a single LinkedIn profile
 */
export async function scrapeProfile(page, profileUrl) {
  try {
    console.log(`\nScraping: ${profileUrl}`);

    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await sleep(2000);

    // Perform random human-like actions
    await performRandomAction(page);

    // Extract profile data
    const profile = await page.evaluate(() => {
      const data = {
        url: window.location.href,
        scrapedAt: new Date().toISOString(),
        name: '',
        title: '',
        company: '',
        location: '',
        about: '',
        experience: [],
        education: []
      };

      // Name
      const nameElement = document.querySelector('.text-heading-xlarge');
      if (nameElement) {
        data.name = nameElement.textContent.trim();
      }

      // Title
      const titleElement = document.querySelector('.text-body-medium.break-words');
      if (titleElement) {
        data.title = titleElement.textContent.trim();
      }

      // Location
      const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
      if (locationElement) {
        data.location = locationElement.textContent.trim();
      }

      // Company (from title section)
      const companyElement = document.querySelector('.pv-text-details__right-panel .pv-text-details__right-panel-item-link');
      if (companyElement) {
        data.company = companyElement.textContent.trim();
      }

      // About section
      const aboutSection = document.querySelector('#about');
      if (aboutSection) {
        const aboutContainer = aboutSection.closest('.pvs-list__outer-container');
        if (aboutContainer) {
          const aboutText = aboutContainer.querySelector('.inline-show-more-text');
          if (aboutText) {
            data.about = aboutText.textContent.trim();
          }
        }
      }

      // Experience
      const experienceSection = document.querySelector('#experience');
      if (experienceSection) {
        const experienceContainer = experienceSection.closest('.pvs-list__outer-container');
        if (experienceContainer) {
          const experienceItems = experienceContainer.querySelectorAll('.pvs-list__paged-list-item');
          experienceItems.forEach((item) => {
            const titleEl = item.querySelector('.mr1.t-bold span[aria-hidden="true"]');
            const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
            const datesEl = item.querySelector('.pvs-entity__caption-wrapper');

            if (titleEl) {
              data.experience.push({
                title: titleEl.textContent.trim(),
                company: companyEl ? companyEl.textContent.trim() : '',
                dates: datesEl ? datesEl.textContent.trim() : ''
              });
            }
          });
        }
      }

      // Education
      const educationSection = document.querySelector('#education');
      if (educationSection) {
        const educationContainer = educationSection.closest('.pvs-list__outer-container');
        if (educationContainer) {
          const educationItems = educationContainer.querySelectorAll('.pvs-list__paged-list-item');
          educationItems.forEach((item) => {
            const schoolEl = item.querySelector('.mr1.t-bold span[aria-hidden="true"]');
            const degreeEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');

            if (schoolEl) {
              data.education.push({
                school: schoolEl.textContent.trim(),
                degree: degreeEl ? degreeEl.textContent.trim() : ''
              });
            }
          });
        }
      }

      return data;
    });

    // Save profile
    const filepath = saveProfile(profile);

    // Update stats
    incrementProfileViews();

    console.log(`  Name: ${profile.name}`);
    console.log(`  Title: ${profile.title}`);
    console.log(`  Company: ${profile.company}`);
    console.log(`  Location: ${profile.location}`);

    // Add delay before next action
    await humanDelay();

    return profile;
  } catch (error) {
    console.error(`  ✗ Error scraping profile:`, error.message);
    incrementErrors();
    return null;
  }
}

/**
 * Scrape profiles from Sales Navigator search results
 */
export async function scrapeFromSalesNav(page, searchUrl, maxProfiles = 10) {
  console.log('\n=== Starting LinkedIn Sales Navigator Scrape ===\n');

  if (!canViewMoreProfiles()) {
    console.log('Daily limit reached! Cannot view more profiles today.');
    console.log(`Remaining views: ${getRemainingViews()}`);
    return [];
  }

  console.log(`Navigating to Sales Navigator search...`);
  await page.goto(searchUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await sleep(3000);

  const scrapedProfiles = [];
  let profilesScraped = 0;

  while (profilesScraped < maxProfiles && canViewMoreProfiles()) {
    console.log(`\n--- Profile ${profilesScraped + 1}/${maxProfiles} ---`);
    console.log(`Remaining daily views: ${getRemainingViews()}`);

    try {
      // Get all profile links on current page
      const profileLinks = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('a[href*="/sales/lead/"]')
        );
        return links.map((link) => link.href).filter((href, index, self) =>
          self.indexOf(href) === index
        );
      });

      if (profileLinks.length === 0) {
        console.log('No more profiles found on this page');
        break;
      }

      // Get the next profile link that we haven't scraped yet
      const profileLink = profileLinks[profilesScraped % profileLinks.length];

      if (!profileLink) {
        console.log('No more profiles available');
        break;
      }

      // Scrape the profile
      const profile = await scrapeProfile(page, profileLink);

      if (profile) {
        scrapedProfiles.push(profile);
        profilesScraped++;
      }

      // Random human action between profiles
      await performRandomAction(page);

      // Go back to search results if we need more profiles
      if (profilesScraped < maxProfiles && canViewMoreProfiles()) {
        console.log('\nReturning to search results...');
        await page.goto(searchUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await sleep(2000);

        // Check if we need to go to next page
        if (profilesScraped > 0 && profilesScraped % 25 === 0) {
          console.log('Moving to next page of results...');
          const nextButton = await page.$('button[aria-label="Next"]');
          if (nextButton) {
            await nextButton.click();
            await sleep(3000);
          } else {
            console.log('No more pages available');
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error in scraping loop:', error.message);
      incrementErrors();
    }

    if (!canViewMoreProfiles()) {
      console.log('\nDaily limit reached!');
      break;
    }
  }

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Total profiles scraped: ${scrapedProfiles.length}`);
  console.log(`Remaining views today: ${getRemainingViews()}`);

  return scrapedProfiles;
}

/**
 * Load all scraped profiles
 */
export function loadAllProfiles() {
  ensureProfilesDir();

  const files = readdirSync(PROFILES_DIR).filter((file) => file.endsWith('.json'));
  const profiles = [];

  files.forEach((file) => {
    try {
      const filepath = join(PROFILES_DIR, file);
      const data = readFileSync(filepath, 'utf8');
      const profile = JSON.parse(data);
      profiles.push(profile);
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  });

  return profiles;
}
