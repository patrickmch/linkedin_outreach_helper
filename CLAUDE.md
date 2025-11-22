# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

LinkedIn Outreach Webhook Bot - A TypeScript webhook server that receives LinkedIn profiles, qualifies them using AI, and prepares them for outreach campaigns.

**Architecture:** TypeScript/Express.js + Upstash Redis + LLM Router API

## Core Architecture

### Webhook Server (src/webhook/server.ts)

Express.js TypeScript server with these routes:

**Webhook** (`/webhook`)
- `POST /linkedin-helper` - Receive LinkedIn profile data

**Contacts** (`/contacts`)
- `GET /` - List all contacts
- `GET /pending` - Contacts awaiting qualification
- `GET /qualified` - Qualified contacts
- `GET /stats` - Statistics

**Health** (`/health`)
- `GET /` - Health check with Redis status

### Data Flow

```
1. POST /webhook/linkedin-helper
   ↓ Store in Redis with status='pending'
   ↓ Return 200 OK immediately

2. Async Processing (background)
   ↓ Call LLM Router with profile + criteria
   ↓ Parse qualification result
   ↓ Update Redis with score & status

3. Status: 'qualified' or 'disqualified'
   ↓ If score >= threshold: ready for Heyreach
```

### Redis Data Structure

**Contact Hash** - `contact:{linkedinUrl}`
```json
{
  "rawData": { /* LinkedIn profile */ },
  "status": "pending|qualified|disqualified|sent_to_heyreach",
  "qualificationScore": 85,
  "qualificationReason": "Strong tech leader...",
  "processedAt": "2025-11-18T...",
  "createdAt": "2025-11-18T..."
}
```

**Status Sets**
- `contacts:pending` - Set of pending linkedinUrls
- `contacts:qualified` - Set of qualified linkedinUrls
- `contacts:disqualified` - Set of disqualified linkedinUrls

### Module Structure

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

### LLM Router Integration

**Endpoint:** `POST ${LLM_ROUTER_URL}/api/query`

**Request:**
```javascript
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

**Expected Response:**
```javascript
{
  "qualified": true,
  "score": 85,
  "reasoning": "Strong tech leader at target company size"
}
```

## Configuration

### Environment Variables

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

## Development

### Build & Run

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode (rebuild + watch)
npm run dev
```

### Test Webhook

```bash
# Send test profile
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

# Check contacts
curl http://localhost:3001/contacts
curl http://localhost:3001/contacts/pending
curl http://localhost:3001/contacts/qualified
curl http://localhost:3001/health
```

## Railway Deployment

### Environment Variables (Railway Dashboard)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `LLM_ROUTER_URL`
- `PORT` (Railway provides automatically)
- `QUALIFICATION_THRESHOLD`

### Deploy
```bash
git push origin main
```

Railway auto-deploys on push with:
- Build: `npm run build`
- Start: `npm start`

## Webhook Payload Format

### Expected Input (LinkedHelper integration)

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

### Response

```json
{
  "success": true,
  "message": "Contact received and queued for processing",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

## Qualification Criteria

Default criteria (configurable in qualification.ts):
- Job title seniority (VP, Director, C-level)
- Company type (tech/SaaS preferred)
- Company size (50-1000 employees ideal)
- No freelancer/consultant indicators

## Error Handling

- **Invalid webhook data** → 400 Bad Request
- **LLM Router failure** → Contact marked as disqualified (score: 0)
- **Redis connection issues** → Health endpoint returns 503
- **Duplicate contacts** → Overwrites existing (by linkedinUrl)

## License

MIT
