export interface CompletionOpts {
  discoveredOnly: boolean;
  baseline?: string[];
  discovered?: string[];
}
export interface CompletionResult {
  candidates: string[];
  commonPrefix: string;
}

export function complete(prefix: string, allCommands: string[], opts: CompletionOpts): CompletionResult {
  let pool = allCommands;
  if (opts.discoveredOnly) {
    const allow = new Set([...(opts.baseline || []), ...(opts.discovered || [])]);
    pool = allCommands.filter((c) => allow.has(c));
  }
  const candidates = pool.filter((c) => c.startsWith(prefix));
  let commonPrefix = candidates[0] || '';
  for (const c of candidates) {
    let i = 0;
    while (i < commonPrefix.length && i < c.length && commonPrefix[i] === c[i]) i++;
    commonPrefix = commonPrefix.slice(0, i);
  }
  return { candidates, commonPrefix };
}
