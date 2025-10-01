import { CorpusFile, Mode } from '../types';

const DEFAULT_PATHS: Record<Mode, string> = {
  comment_under_post: 'corpus/comment_under_post.json',
  dm_sales_pitch: 'corpus/dm_sales_pitch.json',
  dm_influencer_pitch: 'corpus/dm_influencer_pitch.json',
  dm_response: 'corpus/dm_response.json'
};

export function defaultCorpusPathForMode(mode: Mode): string {
  return DEFAULT_PATHS[mode];
}

export async function loadCorpus(path: string): Promise<CorpusFile> {
  const url = chrome.runtime.getURL(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load corpus ${path}`);
  const json = (await res.json()) as CorpusFile;
  validateCorpus(json);
  return json;
}

export function validateCorpus(c: CorpusFile): void {
  if (!c.style || !c.constraints || !c.few_shot_examples || !c.persona) {
    throw new Error('Corpus missing required top-level fields');
  }
  if (!Array.isArray(c.style.tone_words)) throw new Error('tone_words must be array');
  if (!Array.isArray(c.style.do)) throw new Error('do must be array');
  if (!Array.isArray(c.style.dont)) throw new Error('dont must be array');
  if (typeof c.style.emojis_allowed !== 'boolean') throw new Error('emojis_allowed must be boolean');
  if (typeof c.constraints.max_length_chars !== 'number') throw new Error('max_length_chars must be number');
  if (!c.constraints.promo_rules || typeof c.constraints.promo_rules.allowPriceMentions !== 'boolean') {
    throw new Error('promo_rules.allowPriceMentions must be boolean');
  }
  if (!Array.isArray(c.few_shot_examples)) throw new Error('few_shot_examples must be array');
}
