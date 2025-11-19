import { PerTabSession } from '../types.js';

export function clearSessionData(session: PerTabSession): void {
  session.manualPrompt = '';
  session.personName = '';
  session.screenshots = [];
}
