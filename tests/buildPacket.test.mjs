import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPacket } from '../dist/openai/client.js';

const corpus = {
  style: {
    tone_words: ['supportive', 'hype'],
    do: ['encourage community'],
    dont: ['insult anyone'],
    emojis_allowed: true
  },
  constraints: {
    max_length_chars: 220,
    cta_policy: 'Always include a CTA',
    promo_rules: { allowPriceMentions: false }
  },
  few_shot_examples: [
    {
      scenario: 'Example scenario',
      hints: ['hint'],
      output_text: 'Example output text'
    }
  ],
  persona: {
    audience: 'Test audience',
    voice: 'Inspiring and grounded',
    taboo_topics: []
  }
};

test('buildPacket includes the person name when provided', () => {
  const packet = buildPacket({
    mode: 'comment_under_post',
    corpus,
    manualPrompt: 'Respond with encouragement.',
    personName: 'Jordan',
    screenshots: []
  });

  assert.ok(
    packet.user.includes("The name of this person I'm interacting with is Jordan"),
    'person name line should be propagated to the user prompt'
  );
});
