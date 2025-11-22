/**
 * Async Contact Processor
 * Handles background processing of contacts after webhook receives them
 */

import { getContact, updateContact } from './contact-storage.js';
import { qualifyProfile, isQualified } from './qualification.js';

/**
 * Process a contact asynchronously
 * This runs after the webhook has returned 200 OK
 */
export async function processContact(linkedinUrl: string): Promise<void> {
  try {
    console.log(`\n🔄 Processing contact: ${linkedinUrl}`);

    // 1. Fetch contact from Redis
    const contact = await getContact(linkedinUrl);

    if (!contact) {
      console.error(`✗ Contact not found: ${linkedinUrl}`);
      return;
    }

    // 2. Call LLM to qualify profile
    const result = await qualifyProfile(contact.rawData);

    // 3. Determine status based on decision
    const qualified = isQualified(result.decision);
    const newStatus = qualified ? 'qualified' : 'disqualified';

    // 4. Update contact in Redis with full result
    await updateContact(linkedinUrl, {
      status: newStatus,
      tier: result.decision,
      qualificationReason: result.reason,
      roleDetected: result.roleDetected,
      clientTypeInferred: result.clientTypeInferred,
      mindsetSignals: result.mindsetSignals,
      processedAt: new Date().toISOString()
    });

    // 5. Log result
    if (qualified) {
      console.log(`\n🎯 QUALIFIED [${result.decision}]:`);
      console.log(`   Name: ${contact.rawData.name}`);
      console.log(`   Title: ${contact.rawData.currentTitle || contact.rawData.headline}`);
      console.log(`   Company: ${contact.rawData.currentCompany}`);
      console.log(`   Role: ${result.roleDetected}`);
      console.log(`   Reason: ${result.reason}`);
      console.log(`   LinkedIn: ${linkedinUrl}\n`);
    } else {
      console.log(`\n❌ SKIPPED:`);
      console.log(`   Name: ${contact.rawData.name}`);
      console.log(`   Reason: ${result.reason}\n`);
    }

    console.log(`✓ Processing complete for ${contact.rawData.name}`);
  } catch (error) {
    console.error(`✗ Error processing contact ${linkedinUrl}:`, error);

    // Update contact with error status
    try {
      await updateContact(linkedinUrl, {
        status: 'disqualified',
        tier: 'SKIP',
        qualificationReason: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error(`✗ Failed to update error status:`, updateError);
    }
  }
}

/**
 * Trigger async processing (non-blocking)
 * Uses setImmediate to ensure webhook response is sent first
 */
export function triggerAsyncProcessing(linkedinUrl: string): void {
  setImmediate(() => {
    processContact(linkedinUrl).catch(error => {
      console.error(`✗ Async processing failed for ${linkedinUrl}:`, error);
    });
  });

  console.log(`⏰ Queued async processing for: ${linkedinUrl}`);
}
