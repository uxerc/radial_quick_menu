import { basename } from '../fs/paths';
import type { Workspace } from '../fs/workspace';
import { toast } from '../ui/toast';
import type { CaptureSignals, RecentSave } from '../wheel/types';
import type { RecentSaves } from './recent';
import { INBOX_FOLDER, SUGGEST_AFTER, correctionKey, formatRule, matchRule, parseRules } from './rules';
import type { FilingRule } from './rules';

const RULES_KEY = 'radial-file-wheel.rules';
const CORRECTIONS_KEY = 'radial-file-wheel.corrections';

/** High confidence (a rule matched) files silently with a toast; anything else lands in the Inbox. */
export class Filing {
  private listeners = new Set<(text: string) => void>();

  constructor(
    private readonly workspace: Workspace,
    private readonly recent: RecentSaves,
  ) {}

  get rulesText(): string {
    return localStorage.getItem(RULES_KEY) ?? '';
  }

  set rulesText(text: string) {
    localStorage.setItem(RULES_KEY, text);
    for (const listener of this.listeners) listener(text);
  }

  onRulesChanged(listener: (text: string) => void): void {
    this.listeners.add(listener);
  }

  get rules(): FilingRule[] {
    return parseRules(this.rulesText).rules;
  }

  async file(blob: Blob, name: string, signals: CaptureSignals): Promise<RecentSave> {
    const rule = matchRule(this.rules, signals);
    const folder = rule?.folder ?? INBOX_FOLDER;
    const path = await this.workspace.write(folder, name, blob);
    const save = this.recent.add(path, { kind: 'created' }, signals);
    toast(rule ? `Filed to ${folder} (${rule.field}: ${rule.contains})` : `No rule matched “${signals.title}”, filed to Inbox`);
    return save;
  }

  /** After the same app is moved to the same folder SUGGEST_AFTER times, offer to make it a rule. */
  recordCorrection(save: RecentSave, folder: string): void {
    if (!save.signals) return;
    const key = correctionKey(save.signals, folder);
    const counts = loadCounts();
    counts[key] = (counts[key] ?? 0) + 1;
    localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(counts));
    if (counts[key] !== SUGGEST_AFTER) return;

    const rule: FilingRule = { field: 'app', contains: save.signals.app, folder };
    toast(`You moved ${save.signals.app} screenshots to ${basename(folder)} ${SUGGEST_AFTER} times.`, {
      label: 'Create rule',
      run: () => {
        this.rulesText = [this.rulesText.trim(), formatRule(rule)].filter(Boolean).join('\n');
        toast(`Rule added: ${formatRule(rule)}`);
      },
    });
  }
}

function loadCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CORRECTIONS_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
