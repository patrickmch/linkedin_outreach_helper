/**
 * Health Check Route
 * Verifies server and Redis connectivity
 */

import express, { Request, Response } from 'express';
import { testRedisConnection } from '../redis-client.js';
import { HealthResponse } from '../types.js';

const router = express.Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const redisConnected = await testRedisConnection();

    const response: HealthResponse = {
      status: redisConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: redisConnected ? 'connected' : 'disconnected'
    };

    const statusCode = redisConnected ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    console.error('✗ Health check error:', error);

    const response: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: 'disconnected'
    };

    res.status(503).json(response);
  }
});

export default router;
