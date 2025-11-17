-- LinkedIn Outreach API Database Schema
-- SQLite database for Railway deployment

-- Profiles: All LinkedIn profiles from CSV imports
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_url TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  location TEXT,
  headline TEXT,
  about TEXT,
  connections_count INTEGER,
  profile_data JSON,              -- Full CSV data and experience/education
  status TEXT DEFAULT 'new',      -- new|qualified|rejected|contacted
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Qualifications: AI qualification results
CREATE TABLE IF NOT EXISTS qualifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  qualified BOOLEAN NOT NULL,
  score INTEGER NOT NULL,
  reasoning TEXT,
  strengths JSON,                 -- Array of strength points
  concerns JSON,                  -- Array of concerns
  recommended_approach TEXT,
  criteria_used JSON,             -- What criteria produced this result
  llm_response JSON,              -- Full LLM response for debugging
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id)              -- One qualification per profile
);

-- Outreach Tracking: Heyreach campaign integration
CREATE TABLE IF NOT EXISTS outreach_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  heyreach_list_id TEXT,
  heyreach_lead_id TEXT,
  heyreach_campaign_id TEXT,
  message_text TEXT,
  sent_at DATETIME,
  status TEXT DEFAULT 'pending', -- pending|sent|delivered|accepted|replied|failed
  error_message TEXT,
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id)             -- One outreach record per profile
);

-- Connections: Accepted connections and follow-up tracking
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  heyreach_lead_id TEXT,
  connected_at DATETIME,
  follow_up_sent BOOLEAN DEFAULT FALSE,
  follow_up_message TEXT,
  follow_up_sent_at DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(profile_id)             -- One connection record per profile
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_linkedin_url ON profiles(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_profiles_imported_at ON profiles(imported_at);

CREATE INDEX IF NOT EXISTS idx_qualifications_profile_id ON qualifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_qualified ON qualifications(qualified);
CREATE INDEX IF NOT EXISTS idx_qualifications_score ON qualifications(score);

CREATE INDEX IF NOT EXISTS idx_outreach_profile_id ON outreach_tracking(profile_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_tracking(status);
CREATE INDEX IF NOT EXISTS idx_outreach_heyreach_lead_id ON outreach_tracking(heyreach_lead_id);

CREATE INDEX IF NOT EXISTS idx_connections_profile_id ON connections(profile_id);
CREATE INDEX IF NOT EXISTS idx_connections_follow_up_sent ON connections(follow_up_sent);
CREATE INDEX IF NOT EXISTS idx_connections_connected_at ON connections(connected_at);

-- Triggers to automatically update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_profiles_timestamp
AFTER UPDATE ON profiles
BEGIN
  UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_connections_timestamp
AFTER UPDATE ON connections
BEGIN
  UPDATE connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
