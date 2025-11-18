# LinkedIn Outreach Webhook Bot

TypeScript-based webhook server with Redis storage and async AI qualification.

## Architecture

- **Language**: TypeScript
- **Framework**: Express.js
- **Storage**: Upstash Redis (serverless)
- **AI**: LLM Router API integration
- **Deployment**: Railway

## Features

✅ **Webhook-first design** - Receive LinkedIn profiles via POST webhook
✅ **Immediate response** - Returns 200 OK instantly, processes asynchronously
✅ **Redis storage** - Fast, serverless storage with Upstash
✅ **AI qualification** - Automatic profile evaluation via LLM Router
✅ **Type-safe** - Full TypeScript for reliability
✅ **Production-ready** - Error handling, logging, health checks

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
# Server
PORT=3001

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# LLM Router
LLM_ROUTER_URL=https://your-llm-router.com

# Qualification
QUALIFICATION_THRESHOLD=70
```

### 3. Build & Run

```bash
# Build TypeScript
npm run build

# Start webhook server
npm run start:webhook
```

## API Endpoints

### Webhook Endpoint

**POST /webhook/linkedin-helper**

Receives LinkedIn profile data and queues for processing.

**Request:**
```json
{
  "profile": {
    "name": "John Doe",
    "title": "VP of Engineering",
    "company": "TechCorp",
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "location": "San Francisco, CA",
    "about": "Experienced tech leader..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact received and queued for processing",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

### Query Endpoints

**GET /contacts**
Returns all contacts from Redis

**GET /contacts/pending**
Returns contacts with status='pending'

**GET /contacts/qualified**
Returns contacts with status='qualified'

**GET /contacts/stats**
Returns contact statistics

**GET /health**
Health check with Redis connectivity status

## Data Flow

```
1. POST /webhook/linkedin-helper
   ↓ Store in Redis with status='pending'
   ↓ Return 200 OK immediately
   ↓
2. Async Processing (background)
   ↓ Call LLM Router with profile + criteria
   ↓ Parse qualification result
   ↓ Update Redis with score & status
   ↓
3. Status: 'qualified' or 'disqualified'
   ↓ If score > 70: Log "Would send to Heyreach"
   ↓ (Heyreach integration TBD)
```

## Redis Data Structure

### Contact Hash
**Key**: `contact:{linkedinUrl}`

**Value** (JSON):
```json
{
  "rawData": { /* LinkedIn profile */ },
  "status": "pending|qualified|disqualified|sent_to_heyreach",
  "qualificationScore": 85,
  "qualificationReason": "Strong tech leader at mid-size SaaS...",
  "processedAt": "2025-11-18T...",
  "sentToHeyreachAt": null,
  "createdAt": "2025-11-18T..."
}
```

### Status Sets

- `contacts:pending` - Set of pending linkedinUrls
- `contacts:qualified` - Set of qualified linkedinUrls
- `contacts:disqualified` - Set of disqualified linkedinUrls

## Qualification Logic

Profiles are evaluated against these criteria:

- Job title seniority (VP, Director, C-level)
- Company type (tech/SaaS preferred)
- Company size (50-1000 employees ideal)
- No freelancer/consultant indicators

**LLM Request:**
```json
{
  "prompt": "Analyze this LinkedIn profile...",
  "llm": "claude",
  "context_source": "json",
  "context_config": {
    "data": {
      "criteria": "...",
      "profile": { /* profile summary */ }
    }
  }
}
```

**Expected LLM Response:**
```json
{
  "qualified": true,
  "score": 85,
  "reasoning": "Strong tech leader at target company size"
}
```

If `score >= QUALIFICATION_THRESHOLD` (default: 70), contact is qualified.

## Development

### Build TypeScript

```bash
npm run build
```

### Start in Development Mode

```bash
npm run dev:webhook
```

This rebuilds and restarts on changes.

### Test Webhook

```bash
curl -X POST http://localhost:3001/webhook/linkedin-helper \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "name": "Test User",
      "title": "CTO",
      "company": "SaaS Co",
      "linkedinUrl": "https://linkedin.com/in/test",
      "location": "Austin, TX",
      "about": "Tech leader"
    }
  }'
```

### Check Contacts

```bash
curl http://localhost:3001/contacts
curl http://localhost:3001/contacts/pending
curl http://localhost:3001/health
```

## Railway Deployment

### 1. Set Environment Variables

In Railway dashboard:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `LLM_ROUTER_URL`
- `PORT` (Railway provides this automatically)

### 2. Configure Build

Railway auto-detects `package.json` and runs:
- Build: `npm run build`
- Start: `npm run start:webhook`

### 3. Deploy

```bash
git push origin main
```

Railway auto-deploys on push.

## TypeScript Project Structure

```
src/webhook/
├── server.ts              # Main Express app
├── types.ts               # TypeScript interfaces
├── config.ts              # Environment config
├── redis-client.ts        # Upstash Redis client
├── routes/
│   ├── webhook.ts         # POST /webhook/linkedin-helper
│   ├── contacts.ts        # GET /contacts/*
│   └── health.ts          # GET /health
└── services/
    ├── contact-storage.ts # Redis CRUD operations
    ├── qualification.ts   # LLM Router integration
    └── processor.ts       # Async contact processing
```

## Error Handling

- **Invalid webhook data** → 400 Bad Request
- **LLM Router failure** → Contact marked as disqualified (score: 0)
- **Redis connection issues** → Health endpoint returns 503
- **Duplicate contacts** → Overwrites existing (by linkedinUrl)

All errors logged to console with timestamp.

## Logging

The server logs:
- ✓ Contact created
- ⏰ Processing queued
- 🔄 Processing started
- ✓ Qualification result
- 🎯 Qualified contacts (would send to Heyreach)
- ❌ Disqualified contacts
- ✗ Errors

## Future Enhancements

- [ ] Actual Heyreach integration (currently just logging)
- [ ] Batch webhook endpoint (process multiple profiles)
- [ ] Webhook authentication/API keys
- [ ] Rate limiting
- [ ] Retry logic for failed LLM calls
- [ ] Admin dashboard
- [ ] Export qualified contacts to CSV

## Troubleshooting

### "Missing required environment variable"

Make sure `.env` file exists with all required variables.

### "Redis connection failed"

Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct.

### "LLM Router error: 401"

Your LLM Router authentication expired. Update `LLM_ROUTER_URL` or credentials.

### TypeScript build errors

```bash
# Clean build
rm -rf dist/
npm run build
```

## License

MIT
