/**
 * Configuration Management
 * Loads and validates environment variables
 */

import dotenv from 'dotenv';
import { Config } from './types.js';

// Load environment variables
dotenv.config();

export function loadConfig(): Config {
  const requiredEnvVars = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'LLM_ROUTER_URL'
  ];

  // Check for required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    PORT: parseInt(process.env.PORT || '3001', 10),
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
    LLM_ROUTER_URL: process.env.LLM_ROUTER_URL!,
    QUALIFICATION_THRESHOLD: parseInt(process.env.QUALIFICATION_THRESHOLD || '70', 10)
  };
}

export const config = loadConfig();
