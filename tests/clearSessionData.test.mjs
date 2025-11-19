import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSessionData } from '../dist/popup/sessionUtils.js';

const baseSession = () => ({
  id: '1-1-1',
  windowId: 1,
  tabId: 1,
  mode: 'comment_under_post',
  screenshots: [
    { id: 'shot-1', dataURI: 'data:image/png;base64,abc', createdAt: Date.now() }
  ],
  manualPrompt: 'Something custom',
  personName: 'Jordan',
  model: 'gpt-5',
  corpusRef: 'corpora/comment_under_post.json',
  status: 'idle',
  activityLog: [],
  blurUsernames: false
});

test('clearSessionData wipes manual prompt, person name, and screenshots', () => {
  const session = baseSession();
  clearSessionData(session);
  assert.equal(session.manualPrompt, '', 'manual prompt should be cleared');
  assert.equal(session.personName, '', 'person name should be cleared');
  assert.equal(session.screenshots.length, 0, 'screenshots should be removed');
  assert.equal(session.mode, 'comment_under_post', 'other session fields stay unchanged');
});
