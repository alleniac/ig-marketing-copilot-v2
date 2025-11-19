export type Mode = 'comment_under_post' | 'dm_sales_pitch' | 'dm_influencer_pitch' | 'dm_response';
export type ModelId = 'gpt-5' | 'gpt-5-mini' | 'gpt-4o';

export interface ScreenshotItem {
  id: string;
  dataURI: string; // PNG base64
  createdAt: number;
  note?: string;
}

export interface Candidate {
  id: string;
  text: string;
}

export type SessionStatus = 'idle' | 'sending' | 'success' | 'error';

export interface ActivityLogItem {
  ts: number;
  event: string;
  meta?: Record<string, unknown>;
}

export interface PerTabSession {
  id: string; // ${windowId}-${tabId}-${sessionInc}
  windowId: number;
  tabId: number;
  mode: Mode;
  screenshots: ScreenshotItem[];
  manualPrompt: string;
  personName?: string;
  model: ModelId;
  corpusRef: string | object;
  status: SessionStatus;
  requestId?: string;
  candidates?: Candidate[]; // always 3
  compiledResponse?: string;
  activityLog: ActivityLogItem[];
  blurUsernames?: boolean;
}

export interface CorpusFile {
  style: {
    tone_words: string[];
    do: string[];
    dont: string[];
    emojis_allowed: boolean;
  };
  constraints: {
    max_length_chars: number;
    cta_policy: string;
    promo_rules: { allowPriceMentions: boolean };
  };
  sign_offs?: string[];
  few_shot_examples: Array<{
    scenario: string;
    hints: string[];
    output_text: string;
  }>;
  persona: {
    audience: string;
    voice: string;
    taboo_topics: string[];
  };
}

export interface OpenAIResponseCandidate {
  text: string;
}
