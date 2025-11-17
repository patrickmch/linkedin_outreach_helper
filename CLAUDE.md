# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn Outreach Automation API is an end-to-end prospecting system deployed on Railway. It combines AI-powered lead qualification (via LLM Router API) with automated connection request sending (via Heyreach API). The system qualifies LinkedIn prospects using AI, generates personalized outreach messages, and automatically sends connection requests through Heyreach.

**Architecture:** Node.js/Express REST API + SQLite database + LLM Router integration + Heyreach API integration

## Core Architecture

### REST API Server (src/server.js)

Express.js API server with the following routes:

**Profiles** (`/api/profiles`)
- `POST /import` - Upload and parse LinkedIn CSV
- `GET /` - List profiles with query filters (?status=new&limit=5)
- `GET /:id` - Get single profile
- `PATCH /:id` - Update profile metadata
- `DELETE /:id` - Remove bad imports

**Qualifications** (`/api/qualifications`)
- `POST /` - Qualify profile via LLM Router
- `POST /batch` - Qualify multiple profiles
- `GET /` - List qualifications
- `GET /:id` - Get qualification details

**Outreach** (`/api/outreach`)
- `POST /send` - Send to Heyreach campaign
- `GET /status` - Campaign statistics

**Connections** (`/api/connections`)
- `POST /sync` - Sync accepted connections from Heyreach
- `GET /pending` - Get connections needing follow-up
- `GET /:id` - Get connection details
- `POST /:id/message` - Save follow-up message
- `PATCH /:id` - Update connection metadata

**Stats** (`/api/stats`)
- `GET /` - Dashboard statistics
- `GET /funnel` - Conversion funnel analysis

**Health** (`/health`)
- Health check endpoint for monitoring

### Database Schema (SQLite)

**src/database/schema.sql** defines four main tables:

1. **profiles** - LinkedIn profile data from CSV imports
   - Core fields: linkedin_url, name, title, company, location
   - JSON field: profile_data (experience, education, skills)
   - Status tracking: new, qualified, rejected, contacted
   - Indexed on: status, linkedin_url, imported_at

2. **qualifications** - AI qualification results
   - Fields: qualified, score, reasoning, strengths, concerns
   - Tracking: criteria_used, llm_response, recommended_approach
   - One qualification per profile (UNIQUE constraint)
   - Indexed on: profile_id, qualified, score

3. **outreach_tracking** - Heyreach integration tracking
   - Fields: heyreach_list_id, heyreach_lead_id, heyreach_campaign_id
   - Status: pending, sent, delivered, accepted, replied, failed
   - Error tracking: error_message
   - Indexed on: profile_id, status, heyreach_lead_id

4. **connections** - Accepted connections and follow-up
   - Fields: connected_at, follow_up_sent, follow_up_message
   - Tracking: heyreach_lead_id, notes
   - Indexed on: profile_id, follow_up_sent, connected_at

**Features:**
- Foreign key constraints with CASCADE delete
- Automatic updated_at timestamps (triggers)
- Comprehensive indexing for performance
- JSON field storage for complex data

### Data Flow

```
1. CSV Upload → POST /api/profiles/import
   ↓ Parses LinkedIn Sales Navigator CSV
   ↓ Stores in profiles table with status='new'

2. AI Qualification → POST /api/qualifications
   ↓ Sends profile + criteria to LLM Router API
   ↓ LLM Router calls Claude/Gemini
   ↓ Stores result in qualifications table
   ↓ Updates profile.status to 'qualified' or 'rejected'

3. Heyreach Send → POST /api/outreach/send
   ↓ Sends qualified profiles to Heyreach API
   ↓ Tracks in outreach_tracking table
   ↓ Updates profile.status to 'contacted'

4. Connection Sync → POST /api/connections/sync
   ↓ Polls Heyreach for accepted connections
   ↓ Creates records in connections table
   ↓ Updates outreach_tracking.status to 'accepted'

5. Follow-up Messages → POST /api/connections/:id/message
   ↓ Saves post-connection message
   ↓ Marks follow_up_sent = true
   ↓ Manual send via LinkedIn/Heyreach UI (API limitation)
```

### Module Structure

**src/server.js** - Main Express server with routing
**src/database/db.js** - SQLite initialization and utilities
**src/database/schema.sql** - Database schema with indexes
**src/routes/profiles.js** - Profile import and management
**src/routes/qualifications.js** - LLM Router integration for AI qualification
**src/routes/outreach.js** - Heyreach campaign integration
**src/routes/connections.js** - Connection tracking and follow-up
**src/routes/stats.js** - Statistics and analytics
**src/config.js** - Configuration loader (env vars + config.json)
**batch-qualify.js** - Reusable batch qualification module
**check-acceptances.js** - Standalone script to check accepted connections
**batch-send.js** - Standalone script to retry failed sends

### LLM Router Integration

The `/api/qualifications` endpoint integrates with an external LLM Router API:

**Endpoint:** `POST ${LLM_ROUTER_URL}/api/query`

**Request:**
```javascript
{
  "prompt": "Analyze this LinkedIn profile...",
  "llm": "claude",  // or "gemini"
  "context_source": "json",
  "context_config": {
    "data": { /* qualification criteria */ }
  }
}
```

**Response:**
```javascript
{
  "response": "{ \"qualified\": true, \"score\": 85, ... }",
  "llm_used": "claude",
  "context_loaded": true,
  "context_summary": "..."
}
```

The qualification endpoint:
1. Builds a prompt with profile details
2. Sends criteria as JSON context to LLM Router
3. Parses JSON from LLM response
4. Stores full LLM response for debugging
5. Saves criteria_used for audit trail

### Heyreach Integration

**Adding prospects to campaign:**

Endpoint: `POST ${HEYREACH_BASE_URL}/list/AddLeadsToListV2`

Headers: `X-API-KEY: ${HEYREACH_API_KEY}`

Body:
```javascript
{
  leads: [{
    firstName: "John",
    lastName: "Doe",
    location: "Denver, CO",
    summary: "CEO",
    companyName: "Acme Corp",
    position: "CEO",
    about: "...",
    emailAddress: "",
    profileUrl: "https://linkedin.com/in/johndoe"
  }],
  listId: parseInt(HEYREACH_LIST_ID)
}
```

**Checking connection acceptances:**

Endpoint: `POST ${HEYREACH_BASE_URL}/campaign/GetCampaignLeads`

Body:
```javascript
{
  campaignId: parseInt(HEYREACH_CAMPAIGN_ID),
  page: 1,
  pageSize: 100
}
```

Filters for `leadConnectionStatus === "ConnectionAccepted"` and updates database.

### Configuration System

Configuration supports both environment variables (Railway) and config.json (local):

**Environment Variables (Railway):**
```bash
PORT=3000
DATABASE_PATH=/app/data/linkedin-outreach.db
LLM_ROUTER_URL=https://your-llm-router.railway.app
HEYREACH_API_KEY=your_api_key
HEYREACH_LIST_ID=406467
HEYREACH_BASE_URL=https://api.heyreach.io/api/public
HEYREACH_CAMPAIGN_ID=your_campaign_id
MIN_SCORE=60
```

**config.json (Local):**
```json
{
  "minScore": 60,
  "heyreach": {
    "apiKey": "...",
    "listId": "406467",
    "baseUrl": "https://api.heyreach.io/api/public",
    "campaignId": "..."
  }
}
```

Config loader (src/config.js) tries env vars first, falls back to config.json.

## CSV Import Format

LinkedIn Sales Navigator CSV export format:
- **Identity**: full_name, headline, location_name, profile_url
- **Experience**: position_1_title...position_10_title, position_1_company, etc.
- **Education**: school_1_name...school_3_name, school_1_degree, etc.
- **Skills**: skills (comma-separated with counts)
- **Connections**: connections_count

Parser handles:
- Up to 10 positions
- Up to 3 schools
- ON CONFLICT updates for re-imports
- Error tracking for failed imports

## Complete Workflow

### Phase 1: Import & Qualify

```bash
# 1. Upload CSV
curl -X POST http://localhost:3000/api/profiles/import \
  -F "csv=@linkedin_export.csv"

# 2. Get unqualified profiles
curl "http://localhost:3000/api/profiles?status=new&limit=5"

# 3. Qualify profile
curl -X POST http://localhost:3000/api/qualifications \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": 1,
    "criteria": {
      "role": "CEO or Partner",
      "company_size": "Mid-market",
      "location": "Denver metro area"
    },
    "llm": "claude"
  }'

# 4. View stats
curl http://localhost:3000/api/stats
```

### Phase 2: Send to Heyreach

```bash
# Send qualified profiles to campaign
curl -X POST http://localhost:3000/api/outreach/send \
  -H "Content-Type: application/json" \
  -d '{
    "profile_ids": [1, 2, 3]
  }'

# Check outreach status
curl http://localhost:3000/api/outreach/status
```

### Phase 3: Sync Connections

```bash
# Sync accepted connections from Heyreach
curl -X POST http://localhost:3000/api/connections/sync \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": 12345
  }'

# Get pending follow-ups
curl "http://localhost:3000/api/connections/pending"
```

### Phase 4: Follow-up Messages

```bash
# Get connection details
curl http://localhost:3000/api/connections/1

# Save follow-up message
curl -X POST http://localhost:3000/api/connections/1/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi John, thanks for connecting! I wanted to...",
    "send_now": false
  }'
```

**Note:** Follow-up messages must be sent manually via LinkedIn or Heyreach UI due to API limitations (new connections don't have conversationId).

## Directory Structure

```
linkedin-outreach-helper/
├── src/
│   ├── server.js                  # Main Express API server
│   ├── config.js                  # Configuration loader (env + config.json)
│   ├── database/
│   │   ├── db.js                  # SQLite initialization
│   │   └── schema.sql             # Database schema
│   ├── routes/
│   │   ├── profiles.js            # Profile management
│   │   ├── qualifications.js      # LLM Router integration
│   │   ├── outreach.js            # Heyreach campaign integration
│   │   ├── connections.js         # Connection tracking
│   │   └── stats.js               # Statistics & analytics
│   ├── csv-loader.js              # CSV parsing utilities (legacy)
│   ├── heyreach-client.js         # Heyreach API client (legacy)
│   └── acceptance-tracker.js      # Connection tracking (legacy)
├── batch-qualify.js               # Batch qualification module
├── check-acceptances.js           # Script to check accepted connections
├── batch-send.js                  # Script to retry failed sends
├── data/                          # SQLite database (gitignored)
├── config.json                    # Local configuration (gitignored)
├── .env.example                   # Environment variable template
├── railway.json                   # Railway deployment config
├── RAILWAY.md                     # Deployment guide
└── package.json                   # Dependencies
```

## Key Implementation Details

### Query Parameter Filtering

Profiles and qualifications support flexible filtering:

```bash
# Unqualified profiles
GET /api/profiles?status=new&limit=5

# Qualified profiles
GET /api/profiles?status=qualified&offset=10

# All qualifications with score filter (if implemented)
GET /api/qualifications?qualified=true
```

Uses dynamic WHERE clause building with parameterized queries for security.

### Criteria Storage & Audit Trail

All qualifications store:
- **criteria_used**: JSON of criteria that produced the result
- **llm_response**: Full LLM response for debugging
- **recommended_approach**: How to approach the prospect

This enables:
- Reproducing qualification logic
- Debugging LLM decisions
- Improving criteria over time

### Error Handling

API uses centralized error middleware:
```javascript
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

Database operations wrapped in try/catch, passed to next(error).

### Connection Acceptance Sync

Pagination-aware sync:
```javascript
let page = 1;
while (hasMore) {
  const response = await fetchHeyreachLeads(campaignId, page);
  // Process leads...
  if (leads.length < 100) hasMore = false;
  else page++;
}
```

Matches by LinkedIn URL, creates/updates connection records.

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Create .env from template
cp .env.example .env

# Edit .env with your API keys
nano .env

# Start server
npm start

# Or with auto-reload
npm run dev
```

### Testing

```bash
# Health check
curl http://localhost:3000/health

# View API endpoints
curl http://localhost:3000/

# Import test CSV
curl -X POST http://localhost:3000/api/profiles/import \
  -F "csv=@test.csv"

# Check stats
curl http://localhost:3000/api/stats
```

## Railway Deployment

See **RAILWAY.md** for comprehensive deployment guide.

Quick deploy:
```bash
railway init
railway up
```

Set environment variables in Railway dashboard:
- PORT, DATABASE_PATH, LLM_ROUTER_URL
- HEYREACH_API_KEY, HEYREACH_LIST_ID, HEYREACH_CAMPAIGN_ID

Add volume mount at `/app/data` for database persistence.

## Common Issues

### LLM Router Connection

**Problem:** "LLM Router error: 500"

**Solutions:**
1. Verify LLM_ROUTER_URL is correct
2. Test: `curl ${LLM_ROUTER_URL}/health`
3. Check LLM Router logs for errors
4. Verify criteria JSON is valid

### Heyreach API Failures

**Problem:** "Heyreach API error (401)"

**Solutions:**
1. Verify HEYREACH_API_KEY in env
2. Test: `curl --location 'https://api.heyreach.io/api/public/auth/CheckApiKey' --header 'X-API-KEY: your-key'`
3. Check list ID exists: `HEYREACH_LIST_ID`
4. Verify campaign ID: `HEYREACH_CAMPAIGN_ID`

### Database Locked

**Problem:** "database is locked"

**Solutions:**
1. Ensure only one server instance running
2. Check for zombie processes: `ps aux | grep node`
3. Delete .db-shm and .db-wal files
4. Restart server

### CSV Import Failures

**Problem:** "Missing required fields"

**Solutions:**
1. Verify CSV is from LinkedIn Sales Navigator (not regular LinkedIn)
2. Check CSV has profile_url and full_name columns
3. Try re-exporting from LinkedIn
4. Check import errors in response JSON

## Migration from MCP Version

If migrating from the previous MCP-based version:

1. **Backup data:** Copy `data/qualified/` and `data/disqualified/` directories
2. **Convert to API:** Use batch import script (to be created) or import CSVs
3. **Update integrations:** Point any automation to new REST API endpoints
4. **Remove MCP:** Uninstall from Claude Desktop if no longer needed

Legacy MCP tools are preserved in `src/mcp-server.js` for reference.

## Future Enhancements

Potential additions:
- API key authentication middleware
- Rate limiting for production
- PostgreSQL migration for larger scale
- Automated connection acceptance polling (cron job)
- Bulk message generation endpoint
- Response rate tracking and A/B testing
- Chrome extension for LinkedIn message sending
- Webhook support for real-time Heyreach updates

## License

MIT
