import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Load and validate configuration
 */
export function loadConfig() {
  const configPath = join(PROJECT_ROOT, 'config.json');

  if (!existsSync(configPath)) {
    console.error('Error: config.json not found!');
    console.error('Please create config.json with: { "minScore": 60 }');
    process.exit(1);
  }

  try {
    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    return {
      minScore: config.minScore || 60,
      heyreach: config.heyreach || null
    };
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
  }
}

export const config = loadConfig();
