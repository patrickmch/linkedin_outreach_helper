/**
 * Async Contact Processor
 * Handles background processing of contacts after webhook receives them
 */

import { getContact, updateContact } from './contact-storage.js';
import { qualifyProfile, isQualified } from './qualification.js';
import { config } from '../config.js';

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

    // 3. Determine new status
    const qualified = isQualified(result.score);
    const newStatus = qualified ? 'qualified' : 'disqualified';

    // 4. Update contact in Redis
    await updateContact(linkedinUrl, {
      status: newStatus,
      qualificationScore: result.score,
      qualificationReason: result.reasoning,
      processedAt: new Date().toISOString()
    });

    // 5. Check if should send to Heyreach (logging only for now)
    if (qualified && result.score > config.QUALIFICATION_THRESHOLD) {
      console.log(`\n🎯 QUALIFIED FOR HEYREACH:`);
      console.log(`   Name: ${contact.rawData.name}`);
      console.log(`   Title: ${contact.rawData.title}`);
      console.log(`   Company: ${contact.rawData.company}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      console.log(`   LinkedIn: ${linkedinUrl}`);
      console.log(`   → Would send to Heyreach (integration pending)\n`);

      // TODO: Actual Heyreach integration
      // await sendToHeyreach(contact);
      // await updateContact(linkedinUrl, { sentToHeyreachAt: new Date().toISOString() });
    } else {
      console.log(`\n❌ DISQUALIFIED:`);
      console.log(`   Name: ${contact.rawData.name}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Reasoning: ${result.reasoning}\n`);
    }

    console.log(`✓ Processing complete for ${contact.rawData.name}`);
  } catch (error) {
    console.error(`✗ Error processing contact ${linkedinUrl}:`, error);

    // Update contact with error status
    try {
      await updateContact(linkedinUrl, {
        status: 'disqualified',
        qualificationScore: 0,
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
