/**
 * LinkedIn Outreach Webhook Server
 * Express.js TypeScript server with Redis and async processing
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config } from './config.js';
import { testRedisConnection } from './redis-client.js';

// Import routes
import webhookRouter from './routes/webhook.js';
import contactsRouter from './routes/contacts.js';
import healthRouter from './routes/health.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/webhook', webhookRouter);
app.use('/contacts', contactsRouter);
app.use('/health', healthRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'LinkedIn Outreach Webhook Bot',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /webhook/linkedin-helper',
      contacts: 'GET /contacts',
      pending: 'GET /contacts/pending',
      qualified: 'GET /contacts/qualified',
      stats: 'GET /contacts/stats',
      health: 'GET /health'
    },
    documentation: 'https://github.com/patrickmch/linkedin_outreach_helper'
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Start server
async function startServer() {
  try {
    // Test Redis connection
    console.log('Testing Redis connection...');
    const redisOk = await testRedisConnection();

    if (!redisOk) {
      console.error('✗ Redis connection failed');
      console.error('Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
      process.exit(1);
    }

    console.log('✓ Redis connection successful');

    // Start Express server
    app.listen(config.PORT, () => {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  LinkedIn Outreach Webhook Bot');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Status: Running`);
      console.log(`  Port: ${config.PORT}`);
      console.log(`  Redis: Connected`);
      console.log(`  LLM Router: ${config.LLM_ROUTER_URL}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Webhook: http://localhost:${config.PORT}/webhook/linkedin-helper`);
      console.log(`  Health: http://localhost:${config.PORT}/health`);
      console.log(`  Contacts: http://localhost:${config.PORT}/contacts`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

startServer();
