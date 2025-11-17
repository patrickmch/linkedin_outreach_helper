# Railway Deployment Guide

## Overview

This guide covers deploying the LinkedIn Outreach API to Railway.app with SQLite database persistence.

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository connected to Railway
3. LLM Router API deployed and accessible
4. Heyreach API key and campaign ID

## Quick Deploy

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### 2. Configure Environment Variables

In Railway dashboard, add these environment variables:

```bash
# Server
PORT=3000
NODE_ENV=production

# Database (will be created in Railway volume)
DATABASE_PATH=/app/data/linkedin-outreach.db

# LLM Router
LLM_ROUTER_URL=https://your-llm-router.railway.app

# Heyreach
HEYREACH_API_KEY=your_api_key_here
HEYREACH_LIST_ID=406467
HEYREACH_BASE_URL=https://api.heyreach.io/api/public
HEYREACH_CAMPAIGN_ID=your_campaign_id_here
```

### 3. Add Persistent Volume

To persist the SQLite database across deployments:

1. Go to Railway project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add a volume:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (or as needed)

### 4. Deploy

```bash
# Push to Railway
railway up

# Or connect to GitHub and auto-deploy on push
```

## Verifying Deployment

Check health endpoint:
```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-17T...",
  "database": "connected"
}
```

## Initial Setup

### 1. Import LinkedIn CSV

```bash
curl -X POST https://your-app.railway.app/api/profiles/import \
  -F "csv=@linkedin_export.csv"
```

### 2. Verify Import

```bash
curl https://your-app.railway.app/api/stats
```

### 3. Test Qualification

```bash
curl -X POST https://your-app.railway.app/api/qualifications \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "criteria": {
      "role": "CEO or Partner",
      "company_size": "Mid-market",
      "location": "Target regions"
    },
    "llm": "claude"
  }'
```

## Database Backups

### Manual Backup

```bash
# SSH into Railway container
railway shell

# Copy database
cp /app/data/linkedin-outreach.db /tmp/backup.db

# Download from Railway logs or mount
```

### Automated Backups

Consider setting up automated backups to S3 or similar:

1. Add AWS SDK or similar
2. Create cron job to backup database
3. Store in external storage

## Monitoring

### Logs

```bash
# View logs
railway logs

# Follow logs
railway logs --tail
```

### Metrics

Monitor in Railway dashboard:
- CPU usage
- Memory usage
- Request volume
- Error rates

## Troubleshooting

### Database Connection Issues

```bash
# Check database file exists
railway shell
ls -la /app/data/

# Verify permissions
chmod 755 /app/data
chmod 644 /app/data/linkedin-outreach.db
```

### LLM Router Connection Issues

```bash
# Test LLM Router connectivity
curl https://your-llm-router.railway.app/health
```

### Memory Issues

If SQLite database grows large:
1. Increase Railway plan
2. Add database indexes (already included in schema)
3. Archive old data periodically

## Scaling Considerations

### Current Setup
- Single instance
- SQLite database
- Good for ~10,000 profiles

### For Larger Scale
Consider migrating to:
- PostgreSQL (Railway native support)
- Redis for caching
- Background job queue for batch processing

## Security

### API Authentication (Recommended)

Add API key authentication:

1. Set `API_KEY` environment variable
2. Add middleware to verify headers
3. Update documentation with auth requirements

Example:
```javascript
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### Rate Limiting

Consider adding rate limiting for production:

```bash
npm install express-rate-limit
```

## Cost Optimization

Railway pricing considerations:
- **Starter plan**: $5/month
- **Compute**: ~$0.000463/GB-hour
- **Volume storage**: ~$0.25/GB/month

Estimated cost for typical usage:
- 512MB RAM
- 1GB storage
- ~$10-15/month

## Updates and Maintenance

### Deploying Updates

```bash
# From local
git push

# Railway auto-deploys on push

# Or manual
railway up
```

### Database Migrations

When schema changes:
1. Backup current database
2. Update `schema.sql`
3. Railway will recreate on next deploy
4. Or run migrations manually

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: https://github.com/your-repo/issues
