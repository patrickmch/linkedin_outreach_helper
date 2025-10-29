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
 * Generate random delay between min and max milliseconds
 * More human-like than fixed delays
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Ensure profiles directory exists
 */
function ensureProfilesDir() {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

/**
 * Save profile to JSON file and HTML file
 */
function saveProfile(profile) {
  ensureProfilesDir();
  const timestamp = Date.now();
  const namePart = profile.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `profile_${timestamp}_${namePart}.json`;
  const htmlFilename = `profile_${timestamp}_${namePart}.html`;
  const filepath = join(PROFILES_DIR, filename);
  const htmlFilepath = join(PROFILES_DIR, htmlFilename);

  // Save HTML separately if available
  if (profile.profileHtml) {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${profile.name} - LinkedIn Profile</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; }
    .metadata { background: #f3f6f8; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
    .metadata h2 { margin-top: 0; }
    .metadata p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="metadata">
    <h2>Profile Metadata</h2>
    <p><strong>Name:</strong> ${profile.name}</p>
    <p><strong>Title:</strong> ${profile.title}</p>
    <p><strong>Company:</strong> ${profile.company}</p>
    <p><strong>Location:</strong> ${profile.location || 'N/A'}</p>
    <p><strong>Scraped:</strong> ${profile.scrapedAt}</p>
    <p><strong>URL:</strong> <a href="${profile.url}">${profile.url}</a></p>
    <p><strong>HTML Source:</strong> ${profile._htmlSource || 'unknown'}</p>
  </div>
  <hr>
  ${profile.profileHtml}
</body>
</html>`;

    writeFileSync(htmlFilepath, htmlContent);
    console.log(`  ✓ Saved HTML to ${htmlFilename}`);

    // Remove HTML from JSON to keep JSON smaller and more readable
    const profileForJson = { ...profile };
    delete profileForJson.profileHtml;
    delete profileForJson._htmlSource;
    delete profileForJson._debug;

    writeFileSync(filepath, JSON.stringify(profileForJson, null, 2));
  } else {
    writeFileSync(filepath, JSON.stringify(profile, null, 2));
  }

  console.log(`  ✓ Saved JSON to ${filename}`);

  return filepath;
}

/**
 * Scrape a single LinkedIn profile
 * Assumes the page is already on the profile (navigated via clicking)
 */
export async function scrapeProfile(page, profileUrl) {
  try {
    console.log(`\nScraping: ${profileUrl}`);

    // Profile is already loaded from clicking, just wait for content
    await sleep(2000);

    // Perform random human-like actions
    await performRandomAction(page);

    // Extract profile data
    const profile = await page.evaluate((profileUrl) => {
      const data = {
        url: profileUrl, // Use the actual profile URL, not window.location.href
        scrapedAt: new Date().toISOString(),
        name: '',
        title: '',
        company: '',
        location: '',
        about: '',
        experience: [],
        education: [],
        profileHtml: ''
      };

      // Detect if this is a Sales Navigator page or sidebar
      // Sidebar: on search page but has profile data loaded
      const isSalesNav = window.location.href.includes('/sales/lead/') ||
                         window.location.href.includes('/sales/search/') ||
                         document.querySelector('[data-anonymize="person-name"]') !== null;

      // Helper function to try multiple selectors
      const trySelectors = (selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            return element.textContent.trim();
          }
        }
        return '';
      };

      if (isSalesNav) {
        // Sales Navigator specific selectors

        // Debug: Log available classes and elements
        data._debug = {
          topLevelClasses: Array.from(document.body.classList),
          headerClasses: [],
          allH1: [],
          allH2: [],
          dataAnonymizeAttrs: []
        };

        // Find all h1 and h2 elements
        document.querySelectorAll('h1').forEach(h1 => {
          data._debug.allH1.push({
            text: h1.textContent.trim().substring(0, 50),
            classes: Array.from(h1.classList),
            parent: h1.parentElement?.className
          });
        });

        document.querySelectorAll('h2').forEach(h2 => {
          data._debug.allH2.push({
            text: h2.textContent.trim().substring(0, 50),
            classes: Array.from(h2.classList)
          });
        });

        // Find elements with data-anonymize attribute
        document.querySelectorAll('[data-anonymize]').forEach(el => {
          data._debug.dataAnonymizeAttrs.push({
            attr: el.getAttribute('data-anonymize'),
            text: el.textContent.trim().substring(0, 50),
            tag: el.tagName
          });
        });

        // Name - try multiple possible selectors
        // Sidebar-specific selectors first (when scraping from sidebar)
        data.name = trySelectors([
          'h1[data-x--lead--name]', // Sidebar name header
          'h1[data-x--lead--name] a', // Sidebar name link
          '.profile-topcard-person-entity__name',
          '.artdeco-entity-lockup__title',
          'h1.text-heading-xlarge',
          '.lead-detail-header h1'
        ]);

        // Title - current position
        data.title = trySelectors([
          'span[data-anonymize="job-title"]',
          '[data-anonymize="job-title"]',
          '[data-anonymize="headline"]',
          '.profile-topcard__headline',
          '.profile-topcard-person-entity__headline',
          '.artdeco-entity-lockup__subtitle',
          '.lead-detail-header .text-body-medium'
        ]);

        // Company
        data.company = trySelectors([
          '.profile-topcard__company-name',
          'a[data-anonymize="company-name"]',
          '.profile-topcard-person-entity__company',
          '.artdeco-entity-lockup__subtitle a'
        ]);

        // Location
        data.location = trySelectors([
          '.profile-topcard__location',
          '[data-anonymize="location"]',
          '.profile-topcard-person-entity__location',
          '.text-body-small.t-black--light'
        ]);

        // About - summary section
        const aboutSelectors = [
          'div[data-anonymize="person-blurb"]',
          '[data-anonymize="person-blurb"]',
          '[data-anonymize="summary"]',
          '.profile-section-card__summary',
          '.lead-about-section'
        ];
        for (const selector of aboutSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.about = element.textContent.trim();
            break;
          }
        }

        // Remove debug data before saving
        delete data._debug;

      } else {
        // Regular LinkedIn profile selectors

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
      }

      // Capture full profile HTML for thorough data extraction
      // Try multiple selectors to get the most complete profile content
      const profileContainerSelectors = [
        'main',
        '[role="main"]',
        '.lead-detail',
        '.scaffold-layout__main',
        '#main-content',
        'body'
      ];

      for (const selector of profileContainerSelectors) {
        const container = document.querySelector(selector);
        if (container) {
          data.profileHtml = container.innerHTML;
          data._htmlSource = selector; // Track which selector we used
          break;
        }
      }

      return data;
    }, profileUrl); // Pass profileUrl to page.evaluate

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

  // Verify navigation succeeded
  const currentUrl = page.url();
  const pageTitle = await page.title();
  console.log(`Current URL: ${currentUrl}`);
  console.log(`Page title: ${pageTitle}`);

  if (!currentUrl.includes('/sales/search/') && !currentUrl.includes('savedSearchId')) {
    console.error('\n✗ Failed to navigate to Sales Navigator search page');
    console.error(`Expected URL to contain '/sales/search/', but got: ${currentUrl}`);
    console.error('This could mean:');
    console.error('  - Sales Navigator subscription required or expired');
    console.error('  - Search URL is invalid or expired');
    console.error('  - LinkedIn redirected to a different page');
    return [];
  }

  // Try multiple selectors to find profile links
  const selectors = [
    'a[href*="/sales/lead/"]',
    'a[href*="/sales/people/"]',
    'a[data-control-name="view_lead_panel_via_search_lead_name"]',
    '.artdeco-entity-lockup__title a'
  ];

  console.log('\nWaiting for profile links to load...');
  let profileSelector = null;

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      profileSelector = selector;
      console.log(`Found profiles using selector: ${selector}`);
      break;
    } catch (error) {
      // Try next selector
    }
  }

  if (!profileSelector) {
    console.error('\n✗ Could not find profile links on page');
    console.error('Debugging information:');

    // Get sample links to help debug
    const sampleLinks = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      return allLinks.slice(0, 10).map(a => ({
        href: a.href,
        text: a.textContent.trim().substring(0, 50)
      }));
    });
    console.error('Sample links found on page:', JSON.stringify(sampleLinks, null, 2));

    // Check for access/subscription issues
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.toLowerCase().includes('subscription') ||
        pageText.toLowerCase().includes('upgrade') ||
        pageText.toLowerCase().includes('premium')) {
      console.error('\n⚠️  Page may be showing a subscription or access message');
    }

    return [];
  }

  const scrapedProfiles = [];
  let profilesScraped = 0;

  while (profilesScraped < maxProfiles && canViewMoreProfiles()) {
    console.log(`\n--- Profile ${profilesScraped + 1}/${maxProfiles} ---`);
    console.log(`Remaining daily views: ${getRemainingViews()}`);

    try {
      // Ensure any previous sidebar is closed before querying
      await page.keyboard.press('Escape');
      await sleep(randomDelay(200, 400));

      // Query for profile link elements once with sidebar closed
      // Get unique profile URLs (deduplicate by profile ID)
      const profileData = await page.evaluate((selector) => {
        const links = Array.from(document.querySelectorAll(selector));
        const seen = new Set();
        const unique = [];

        links.forEach((link, idx) => {
          const href = link.href;
          const match = href.match(/\/sales\/lead\/([^,]+)/);
          const profileId = match ? match[1] : null;

          if (profileId && !seen.has(profileId)) {
            seen.add(profileId);
            unique.push({ href, elementIndex: idx });
          }
        });

        return unique;
      }, profileSelector);

      if (profileData.length === 0) {
        console.log('No more profiles found on this page');
        break;
      }

      console.log(`Found ${profileData.length} unique profiles on page`);

      // Get the profile at the current index
      const profileIndex = profilesScraped;

      if (profileIndex >= profileData.length) {
        console.log('No more profiles on this page');
        break;
      }

      // Get the profile data
      const profileEntry = profileData[profileIndex];
      const profileLink = profileEntry.href;

      // Click to open profile (opens sidebar - just like a real user)
      console.log(`\nOpening profile sidebar (profile ${profileIndex + 1})...`);

      try {
        // Get the actual link element by its index in the DOM
        const profileLinkElements = await page.$$(profileSelector);
        const linkElement = profileLinkElements[profileEntry.elementIndex];

        if (!linkElement) {
          console.log('Link element not found, skipping');
          continue;
        }

        // Hover over the link first (human behavior)
        await linkElement.hover();
        await sleep(randomDelay(300, 800));

        // Click to open sidebar preview
        await linkElement.click();

        // Wait for sidebar to load with NEW profile content
        // Extract the profile ID from the URL to verify sidebar updated
        const profileId = profileLink.match(/\/sales\/lead\/([^,]+)/)?.[1];
        if (profileId) {
          // Wait for sidebar link containing this profile ID
          await page.waitForFunction(
            (id) => {
              const sidebarLink = document.querySelector(`h1[data-x--lead--name] a[href*="${id}"]`);
              return sidebarLink !== null;
            },
            { timeout: 10000 },
            profileId
          ).catch(() => {});
        }
        await sleep(randomDelay(500, 1000));

        // The sidebar is now open - scrape from it
        // No need to navigate away - real users often just read the sidebar

      } catch (clickError) {
        console.error('  Error clicking profile link:', clickError.message);
        incrementErrors();
        continue;
      }

      // Scrape the profile (sidebar is open)
      const profile = await scrapeProfile(page, profileLink);

      if (profile) {
        scrapedProfiles.push(profile);
        profilesScraped++;
      }

      // Close the sidebar before moving to next profile
      // Press Escape key (very human-like way to close modals/sidebars)
      try {
        await page.keyboard.press('Escape');
        await sleep(randomDelay(500, 1000));
      } catch (error) {
        // Sidebar might auto-close, continue
      }

      // Random human action between profiles
      await performRandomAction(page);

      if (profilesScraped < maxProfiles && canViewMoreProfiles()) {
        console.log('\nMoving to next profile...');
        await sleep(randomDelay(1000, 2000));

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
