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
    if (!config.linkedin?.email || !config.linkedin?.password) {
      throw new Error('LinkedIn credentials are required in config.json');
    }

    // Claude API key is optional (for manual review mode)
    if (!config.claude?.apiKey) {
      console.warn('⚠️  Warning: No Claude API key configured. Automated qualification will not work.');
      console.warn('   You can still use manual review with: npm run export and npm run review\n');
    }

    return config;
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
  }
}

export const config = loadConfig();
