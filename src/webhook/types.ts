/**
 * TypeScript Type Definitions for LinkedIn Outreach Webhook Bot
 */

export interface LinkedInProfile {
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
  location?: string;
  about?: string;
  headline?: string;
  connections_count?: number;
  experience?: Experience[];
  education?: Education[];
  skills?: string;
  [key: string]: any; // Allow additional fields
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

export type ContactStatus = 'pending' | 'qualified' | 'disqualified' | 'sent_to_heyreach';

export interface Contact {
  rawData: LinkedInProfile;
  status: ContactStatus;
  qualificationScore: number | null;
  qualificationReason: string | null;
  processedAt: string | null;
  sentToHeyreachAt: string | null;
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
  qualified: boolean;
  score: number;
  reasoning: string;
}

export interface WebhookRequest {
  profile: LinkedInProfile;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  linkedinUrl: string;
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
  QUALIFICATION_THRESHOLD: number;
}
