import { Candidate, CorpusFile, ModelId, Mode, PerTabSession } from '../types';

type ModelConfig = {
  id: ModelId;
  usesMaxCompletionTokens: boolean; // per spec: true for GPT-5 family
};

const MODEL_ORDER: ModelConfig[] = [
  { id: 'gpt-5', usesMaxCompletionTokens: true },
  { id: 'gpt-5-mini', usesMaxCompletionTokens: true },
  { id: 'gpt-4o', usesMaxCompletionTokens: false }
];

export interface BuildPacketParams {
  mode: Mode;
  corpus: CorpusFile;
  manualPrompt?: string;
  screenshots: { id: string; dataURI: string; note?: string }[];
}

export interface RequestPacket {
  system: string;
  developer: string;
  user: string;
  attachments: Array<{ id: string; type: 'image' | 'text'; data: string; label?: string }>;
}

export function buildPacket({ mode, corpus, manualPrompt, screenshots }: BuildPacketParams): RequestPacket {
  const system = `Brand: TITAN FORGE SF (TFSF)\nWhat: Trophy-inspired pendants & chains celebrating bodybuilding’s grind.\nAudience: Fitness athletes, serious gym-goers, bodybuilders, enthusiasts.\nVoice: Gym-buddy energy—supportive, inspiring, uplifting, energetic; sometimes funny, sometimes serious. Respectful; never bash competitors.\nValues: Work ethic, progress > perfection, community, self-respect.\nEmoji policy: Allowed by default.\nTypical CTAs: “Tap in if this speaks to you.” / “DM us if you’re chasing __.” / “Rock it on meet day.” / “Join the squad.”\nGlobal rules: Never quote price unless manual prompt explicitly asks.`;

  const developer = `Mode: ${mode}\nStyle: tone_words=${corpus.style.tone_words.join(', ')}; do=${corpus.style.do.join(', ')}; dont=${corpus.style.dont.join(', ')}; emojis_allowed=${corpus.style.emojis_allowed}\nConstraints: max_length_chars=${corpus.constraints.max_length_chars}; cta_policy=${corpus.constraints.cta_policy}; promo_rules.allowPriceMentions=${corpus.constraints.promo_rules.allowPriceMentions}\nPersona: audience=${corpus.persona.audience}; voice=${corpus.persona.voice}; taboo_topics=${corpus.persona.taboo_topics.join(', ')}\nFew-shot example (1): ${corpus.few_shot_examples[0]?.output_text ?? ''}\nOutput: Return exactly 3 distinct candidates.`;

  const userLines: string[] = [];
  if (manualPrompt && manualPrompt.trim()) {
    userLines.push(`Manual prompt: ${manualPrompt.trim()}`);
  }
  userLines.push(`Screenshots provided: ${screenshots.length}`);
  screenshots.forEach((s, idx) => userLines.push(`Screenshot ${idx + 1}${s.note ? ` (${s.note})` : ''}`));

  const attachments = screenshots.map(s => ({ id: s.id, type: 'image' as const, data: s.dataURI, label: s.note }));

  return { system, developer, user: userLines.join('\n'), attachments };
}

export interface SendParams {
  apiKey: string;
  preferredModel: ModelId;
  packet: RequestPacket;
  isDM: boolean; // for length constraint
}

export interface SendResult {
  modelUsed: ModelId;
  candidates: Candidate[];
  fallbackChain: ModelId[]; // models tried in order
}

async function callOpenAI(model: ModelId, apiKey: string, packet: RequestPacket): Promise<string[]> {
  // Note: This uses the Responses API. If needed, switch to Chat Completions per official docs.
  const url = 'https://api.openai.com/v1/responses';
  const input: any[] = [];
  input.push({ role: 'system', content: [{ type: 'input_text', text: packet.system }] });
  input.push({ role: 'developer', content: [{ type: 'input_text', text: packet.developer }] });
  const content: any[] = [{ type: 'input_text', text: packet.user }];
  for (const att of packet.attachments) {
    if (att.type === 'image') {
      const data = att.data;
      if (typeof data === 'string') {
        content.push({ type: 'input_image', image_url: data });
      }
    }
  }
  input.push({ role: 'user', content });

  const body: Record<string, any> = {
    model,
    input,
  };

  // Per spec: GPT-5 family must use max_completion_tokens and avoid temperature.
  if (model === 'gpt-5' || model === 'gpt-5-mini') {
    body.max_completion_tokens = 800; // generous upper bound; UI trims to constraints later
  } else {
    // For gpt-4o use standard tokens param if needed; omitted for safety.
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }

  const data = await res.json();
  // Very conservative parsing. We expect model to return a single text block with 3 candidates, or structured output.
  const outputs: string[] = [];
  try {
    // Try to read assistant content array
    const out = data.output?.[0]?.content || data.output || data.choices || [];
    if (Array.isArray(out)) {
      for (const item of out) {
        if (typeof item === 'string') outputs.push(item);
        else if (item?.type === 'output_text' && typeof item?.text === 'string') outputs.push(item.text);
        else if (item?.message?.content) {
          if (Array.isArray(item.message.content)) {
            const textParts = item.message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text);
            if (textParts.length) outputs.push(textParts.join('\n'));
          } else if (typeof item.message.content === 'string') outputs.push(item.message.content);
        }
      }
    }
  } catch {
    // ignore, fall through
  }
  if (outputs.length === 0 && typeof data === 'object') {
    const text = (data.output_text || data.text || '').toString();
    if (text) outputs.push(text);
  }
  return outputs.length > 0 ? outputs : [''];
}

function enforceLength(text: string, isDM: boolean): string {
  const limit = isDM ? 600 : 220;
  if (text.length <= limit) return text;
  return text.slice(0, limit);
}

function normalizeToThreeCandidates(texts: string[], isDM: boolean): Candidate[] {
  // Split large block into 3 if needed; otherwise take first 3.
  const cleaned = texts.flatMap(t => {
    const parts = t.split(/\n\s*---+\s*\n|\n\s*\d+[\).]\s*/).filter(Boolean);
    return parts.length ? parts : [t];
  }).filter(Boolean);

  const cands: string[] = [];
  for (const c of cleaned) {
    if (cands.length >= 3) break;
    cands.push(enforceLength(c.trim(), isDM));
  }
  while (cands.length < 3) cands.push('');
  return cands.slice(0, 3).map((text, i) => ({ id: `cand-${i + 1}`, text }));
}

export async function sendWithFallback({ apiKey, preferredModel, packet, isDM }: SendParams): Promise<SendResult> {
  const order = MODEL_ORDER;
  const startIdx = order.findIndex(m => m.id === preferredModel);
  const sequence = startIdx >= 0 ? order.slice(startIdx) : order;
  const tried: ModelId[] = [];
  let lastError: unknown;

  for (const m of sequence) {
    tried.push(m.id);
    try {
      console.log("packet being: " + JSON.stringify(packet));
      const outputs = await callOpenAI(m.id, apiKey, packet);
      console.log("outputs being: " + JSON.stringify(outputs));
      const candidates = normalizeToThreeCandidates(outputs, isDM);
      return { modelUsed: m.id, candidates, fallbackChain: tried };
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError ?? new Error('All model attempts failed');
}
