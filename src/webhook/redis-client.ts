/**
 * Upstash Redis Client
 * Singleton instance for Redis connection
 */

import { Redis } from '@upstash/redis';
import { config } from './config.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: config.UPSTASH_REDIS_REST_URL,
      token: config.UPSTASH_REDIS_REST_TOKEN
    });

    console.log('✓ Redis client initialized');
  }

  return redisClient;
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}
