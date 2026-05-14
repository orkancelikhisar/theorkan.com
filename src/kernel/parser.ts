export function tokenize(input: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (i >= input.length) break;
    let tok = '';
    while (i < input.length && !/\s/.test(input[i])) {
      const c = input[i];
      if (c === "'" || c === '"') {
        const quote = c; i++;
        while (i < input.length && input[i] !== quote) { tok += input[i]; i++; }
        if (i < input.length) i++;
      } else {
        tok += c; i++;
      }
    }
    if (tok.length > 0) out.push(tok);
  }
  return out;
}

export function expandGlobs(pattern: string, candidates: string[]): string[] {
  if (!pattern.includes('*') && !pattern.includes('?')) return [pattern];
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') +
      '$',
  );
  const matched = candidates.filter((c) => re.test(c));
  return matched.length > 0 ? matched : [pattern];
}
