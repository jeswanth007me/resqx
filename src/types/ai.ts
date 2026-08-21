/**
 * ResQX Shared Types — AI Contracts
 *
 * Types for AI recommendation system integration.
 * The AI/Backend Engineer will implement the logic;
 * these are the data contracts the frontend consumes.
 */

export interface AIRecommendation {
  id: string;
  recommendation: string;
  reason: string;
  confidence: number; // 0–100
  targetSignal?: string;
  action?: 'EXECUTE_OVERRIDE' | 'ADJUST_TIMING' | 'REROUTE' | 'DISMISS';
  timestamp: number;
}
