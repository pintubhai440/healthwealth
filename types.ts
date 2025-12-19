export interface PatientProfile {
  full_name: string;
  title?: string;
  age: string;
  gender: string;
  height?: string;
  weight?: string;
  allergies?: string;
}
export enum FeatureView {
  HOME = 'HOME',
  TRIAGE = 'TRIAGE',
  MEDISCAN = 'MEDISCAN',
  DERMCHECK = 'DERMCHECK',
  RECOVERY = 'RECOVERY'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isThinking?: boolean;
}

export interface TriageState {
  step: number; // 0: Start, 1: Q1, 2: Q2, 3: Verdict
  history: ChatMessage[];
}

export interface AnalysisResult {
  title: string;
  verdict: 'Good' | 'Bad' | 'Very Bad' | 'Neutral' | 'Unknown';
  description: string;
  confidence?: string;
  actions?: string[];
  groundingUrls?: Array<{ title: string; uri: string }>;
}

export interface DietPlan {
  condition: string;
  meals: Array<{ name: string; items: string[] }>;
  youtubeQueries: string[];
}
