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
    console.error('Please copy config.template.json to config.json and fill in your credentials.');
    process.exit(1);
  }

  try {
    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate required fields
    if (!config.qualification?.criteria || !config.qualification?.idealProfile) {
      throw new Error('Qualification criteria are required in config.json');
    }

    return config;
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
  }
}

export const config = loadConfig();
