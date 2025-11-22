/**
 * TypeScript Type Definitions for LinkedIn Outreach Webhook Bot
 */

// LinkedHelper sends snake_case fields
export interface LinkedHelperPayload {
  id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_url?: string;
  headline?: string;
  summary?: string;
  about?: string;
  company?: string;
  current_company?: string;
  position?: string;
  current_title?: string;
  title?: string;
  location?: string;
  location_name?: string;
  industry?: string;
  skills?: string;
  connections?: number;
  connections_count?: number;
  followers?: number;
  email?: string;
  phone?: string;
  website?: string;
  // Job history fields (LinkedHelper sends position_1_*, position_2_*, etc.)
  [key: string]: any;
}

// Normalized internal profile format
export interface LinkedInProfile {
  name: string;
  linkedinUrl: string;
  headline?: string;
  summary?: string;
  currentCompany?: string;
  currentTitle?: string;
  location?: string;
  industry?: string;
  skills?: string;
  followers?: number;
  jobHistory?: JobHistoryEntry[];
  // Preserve raw data for debugging
  rawPayload?: LinkedHelperPayload;
}

export interface JobHistoryEntry {
  title: string;
  company: string;
  duration?: string;
  description?: string;
}

export interface Experience {
  title: string;
  company: string;
  duration?: string;
  description?: string;
}

export interface Education {
  school: string;
  degree?: string;
  field?: string;
}

// Qualification decision types
export type QualificationDecision = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'SKIP';

export type ContactStatus = 'pending' | 'qualified' | 'disqualified';

export interface Contact {
  rawData: LinkedInProfile;
  status: ContactStatus;
  tier: QualificationDecision | null;
  qualificationReason: string | null;
  roleDetected: string | null;
  clientTypeInferred: string | null;
  mindsetSignals: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface LLMQualificationRequest {
  prompt: string;
  llm?: 'claude' | 'gemini';
  context_source?: string;
  context_config?: {
    data?: any;
  };
}

export interface LLMQualificationResponse {
  response: string;
  llm_used: string;
  context_loaded?: boolean;
}

export interface QualificationResult {
  decision: QualificationDecision;
  reason: string;
  roleDetected: string;
  clientTypeInferred: string;
  mindsetSignals: string;
}

export interface WebhookRequest {
  // Support both formats
  profile?: LinkedInProfile;
  // LinkedHelper flat format - just use the payload directly
  [key: string]: any;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  linkedinUrl?: string;
}

export interface ContactsResponse {
  contacts: Contact[];
  total: number;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  redis: 'connected' | 'disconnected';
}

export interface Config {
  PORT: number;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  LLM_ROUTER_URL: string;
}
