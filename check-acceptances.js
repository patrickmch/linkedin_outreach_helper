#!/usr/bin/env node

import { checkAcceptedConnections } from './src/acceptance-tracker.js';

// Run the acceptance tracker
try {
  const result = await checkAcceptedConnections();

  console.log('');
  console.log('✓ Acceptance check complete!');
  process.exit(0);
} catch (error) {
  console.error('');
  console.error('✗ Error checking acceptances:', error.message);
  process.exit(1);
}
