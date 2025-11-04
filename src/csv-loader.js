import { readFileSync, readdirSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Find the most recent LinkedIn CSV export in ~/Downloads
 */
export function findMostRecentCSV() {
  const downloadsDir = join(homedir(), 'Downloads');
  const files = readdirSync(downloadsDir);

  // Filter for LinkedIn export CSVs
  const linkedinCSVs = files
    .filter(f => f.startsWith('Profiles downloaded from') && f.endsWith('.csv'))
    .map(f => {
      const filepath = join(downloadsDir, f);
      const stats = readFileSync(filepath);
      return { path: filepath, name: f };
    })
    .sort((a, b) => {
      // Extract timestamp from filename
      const getTimestamp = (name) => {
        const match = name.match(/at (\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)/);
        return match ? match[1].replace(/-(\d{2})-(\d{2}\.\d{3}Z)/, ':$1:$2') : '';
      };
      return getTimestamp(b.name).localeCompare(getTimestamp(a.name));
    });

  if (linkedinCSVs.length === 0) {
    throw new Error('No LinkedIn CSV exports found in ~/Downloads');
  }

  return linkedinCSVs[0].path;
}

/**
 * Parse LinkedIn CSV and convert to profile format
 */
export function loadProfilesFromCSV(csvPath) {
  const csvContent = readFileSync(csvPath, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  return records.map(row => convertRowToProfile(row));
}

/**
 * Convert CSV row to profile object
 */
function convertRowToProfile(row) {
  // Build experience array from organization fields
  const experience = [];
  for (let i = 1; i <= 10; i++) {
    const company = row[`organization_${i}`];
    const title = row[`organization_title_${i}`];
    const start = row[`organization_start_${i}`];
    const end = row[`organization_end_${i}`];
    const description = row[`position_description_${i}`];

    if (company || title) {
      experience.push({
        company: company || 'Unknown',
        title: title || 'Unknown',
        dates: formatDateRange(start, end),
        description: description || ''
      });
    }
  }

  // Build education array from education fields
  const education = [];
  for (let i = 1; i <= 3; i++) {
    const school = row[`education_${i}`];
    const degree = row[`education_degree_${i}`];
    const fos = row[`education_fos_${i}`];
    const start = row[`education_start_${i}`];
    const end = row[`education_end_${i}`];

    if (school) {
      education.push({
        school: school,
        degree: degree ? `${degree}${fos ? ' - ' + fos : ''}` : (fos || 'Unknown'),
        dates: formatDateRange(start, end)
      });
    }
  }

  return {
    name: row.full_name || row.first_name + ' ' + row.last_name || 'Unknown',
    title: row.headline || row.current_company_position || 'Unknown',
    company: row.current_company || row.organization_1 || 'Unknown',
    location: row.location_name || 'Unknown',
    url: row.profile_url || '',
    about: row.summary || '',
    experience: experience,
    education: education,
    skills: row.skills ? row.skills.split(',').map(s => s.trim()) : [],
    connectionsCount: row.connections_count || 'Unknown',
    scrapedAt: row.result_created_at_iso || new Date().toISOString(),
    // Include raw CSV data for reference
    _csvData: {
      id: row.id,
      publicId: row.public_id,
      linkedin: row.linkedin,
      industry: row.industry
    }
  };
}

/**
 * Format date range for display
 */
function formatDateRange(start, end) {
  if (!start && !end) return '';
  if (!end || end === '') return `${start} - Present`;
  return `${start} - ${end}`;
}

/**
 * Get all profiles from most recent CSV
 */
export function loadAllProfiles() {
  const csvPath = findMostRecentCSV();
  return loadProfilesFromCSV(csvPath);
}
