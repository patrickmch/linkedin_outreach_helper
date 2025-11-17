/**
 * LinkedIn Outreach API Server
 * Railway-hosted Express API with SQLite database
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/db.js';

// Import route modules
import profilesRouter from './routes/profiles.js';
import qualificationsRouter from './routes/qualifications.js';
import outreachRouter from './routes/outreach.js';
import connectionsRouter from './routes/connections.js';
import statsRouter from './routes/stats.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_PATH || './data/linkedin-outreach.db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// API routes
app.use('/api/profiles', profilesRouter);
app.use('/api/qualifications', qualificationsRouter);
app.use('/api/outreach', outreachRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/stats', statsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'LinkedIn Outreach API',
    version: '3.0.0',
    endpoints: {
      health: 'GET /health',
      profiles: 'GET /api/profiles',
      import: 'POST /api/profiles/import',
      qualify: 'POST /api/qualifications',
      outreach: 'POST /api/outreach/send',
      connections: 'POST /api/connections/sync',
      stats: 'GET /api/stats'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
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

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase(DB_PATH);

    // Start Express server
    app.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  LinkedIn Outreach API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Status: Running`);
      console.log(`  Port: ${PORT}`);
      console.log(`  Database: ${DB_PATH}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`  Health: http://localhost:${PORT}/health`);
      console.log(`  API: http://localhost:${PORT}/api`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

startServer();
