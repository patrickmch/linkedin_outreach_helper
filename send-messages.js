#!/usr/bin/env node

import { sendMessagesToReadyProfiles } from './src/message-sender.js';

// Send messages to all ready profiles
try {
  const result = await sendMessagesToReadyProfiles();

  console.log('');
  console.log('✓ Message sending complete!');
  process.exit(0);
} catch (error) {
  console.error('');
  console.error('✗ Error sending messages:', error.message);
  process.exit(1);
}
