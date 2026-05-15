// LLM output filter (§8.9). Two passes:
//   - isOnVoice:      strict, for one-shot stir/beg appearance lines (short).
//   - isReplyOnVoice: relaxed, for conversation replies (longer, more turns).
// Both reject obvious chatbot-mode drift but leave room for Dilenci's own
// "i am a remnant. i am okay with this." kind of phrasing.

// Specific chatbot phrases — NOT a blanket "i am" / "i'm" check, because
// Dilenci legitimately says "i am quieter now." and "i'm a draft."
const CHATBOT_PHRASES = [
  'as an ai', 'as a language model', 'as an assistant',
  'i am an ai', 'i am a language model', 'i am an assistant',
  "i'm an ai", "i'm a language model", "i'm here to help",
  'how can i help', 'how can i assist', 'happy to help',
  'i would be happy', 'feel free to', 'let me know if',
  'user:', 'assistant:', 'system:',
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

function passesCommon(text: string, minLen: number, maxLen: number, maxLines: number): boolean {
  const t = text.trim();
  if (t.length < minLen || t.length > maxLen) return false;
  if (t.includes('!')) return false;
  if (EMOJI_RE.test(t)) return false;
  if (t.split('\n').length > maxLines) return false;
  if (t.includes('```')) return false;
  const lc = t.toLowerCase();
  for (const bad of CHATBOT_PHRASES) {
    if (lc.includes(bad)) return false;
  }
  return true;
}

// One-shot appearance lines: terse, single utterance. 6-100 chars, ≤3 lines.
export function isOnVoice(raw: string): boolean {
  return passesCommon(raw, 6, 100, 3);
}

// Conversation replies: he can stretch a little. 6-200 chars, ≤4 lines.
export function isReplyOnVoice(raw: string): boolean {
  return passesCommon(raw, 6, 200, 4);
}
