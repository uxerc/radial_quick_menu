import type { CaptureSignals } from '../wheel/types';

export interface FilingRule {
  field: 'app' | 'title';
  contains: string;
  folder: string;
}

export const SCREENSHOTS_FOLDER = 'Screenshots';
export const INBOX_FOLDER = 'Screenshots/Inbox';
export const SUGGEST_AFTER = 3;

const RULE_LINE = /^\s*(app|title)\s*:\s*(.+?)\s*->\s*(.+?)\s*$/i;

/** One rule per line: `app: Chrome -> Screenshots/Browser` or `title: Jira -> Screenshots/Jira`. */
export function parseRules(text: string): { rules: FilingRule[]; invalid: string[] } {
  const rules: FilingRule[] = [];
  const invalid: string[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const match = RULE_LINE.exec(line);
    if (match) rules.push({ field: match[1].toLowerCase() as FilingRule['field'], contains: match[2], folder: match[3] });
    else invalid.push(line.trim());
  }
  return { rules, invalid };
}

export function formatRule(rule: FilingRule): string {
  return `${rule.field}: ${rule.contains} -> ${rule.folder}`;
}

export function matchRule(rules: FilingRule[], signals: CaptureSignals): FilingRule | null {
  return (
    rules.find((rule) => signals[rule.field].toLowerCase().includes(rule.contains.toLowerCase())) ?? null
  );
}

/** Windows titles end in " - App" (e.g. "PROJ-12 - Jira - Google Chrome"). */
export function appFromTitle(title: string): string {
  const parts = title.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : title.trim();
}

export function correctionKey(signals: CaptureSignals, folder: string): string {
  return `${signals.app.toLowerCase()}→${folder}`;
}
