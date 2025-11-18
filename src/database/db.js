/**
 * Database Module
 * SQLite database initialization and utilities for Railway deployment
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Initialize SQLite database
 * @param {string} dbPath - Path to SQLite database file
 * @returns {Promise<Database>} SQLite database instance
 */
export async function initializeDatabase(dbPath = './data/linkedin-outreach.db') {
  if (db) {
    return db;
  }

  // Ensure the directory exists
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log('✓ Created database directory:', dbDir);
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');

  // Load and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');
  await db.exec(schema);

  console.log('✓ Database initialized:', dbPath);

  return db;
}

/**
 * Get database instance
 * @returns {Database} SQLite database instance
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

/**
 * Transaction wrapper
 * @param {Function} callback - Async function to execute in transaction
 * @returns {Promise<any>} Result of callback
 */
export async function transaction(callback) {
  const database = getDatabase();

  await database.exec('BEGIN TRANSACTION');

  try {
    const result = await callback(database);
    await database.exec('COMMIT');
    return result;
  } catch (error) {
    await database.exec('ROLLBACK');
    throw error;
  }
}
