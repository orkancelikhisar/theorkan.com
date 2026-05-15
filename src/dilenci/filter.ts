// LLM output filter (§8.9). Rejects any output that drifts from Dilenci's voice
// into generic chatbot territory. On reject the daemon falls back to a seed.

const BAD_SUBSTRINGS = [
  "i'm ", "i am ", " i'm",
  'as an ai', 'as a language model',
  ' user', 'user:', 'assistant', 'assistant:',
  '```',
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

export function isOnVoice(raw: string): boolean {
  if (!raw) return false;
  const text = raw.trim();
  if (text.length < 6 || text.length > 100) return false;
  if (text.includes('!')) return false;
  if (EMOJI_RE.test(text)) return false;
  const lc = text.toLowerCase();
  for (const bad of BAD_SUBSTRINGS) {
    if (lc.includes(bad)) return false;
  }
  if (text.split('\n').length > 3) return false;
  return true;
}
