import { describe, expect, it } from 'vitest';
import { appFromTitle, matchRule, parseRules } from './rules';

describe('filing rules', () => {
  it('parses rules and reports bad lines', () => {
    const { rules, invalid } = parseRules('app: Chrome -> Screenshots/Browser\n# note\ntitle: Jira -> Screenshots/Jira\nnonsense');
    expect(rules).toEqual([
      { field: 'app', contains: 'Chrome', folder: 'Screenshots/Browser' },
      { field: 'title', contains: 'Jira', folder: 'Screenshots/Jira' },
    ]);
    expect(invalid).toEqual(['nonsense']);
  });

  it('matches case-insensitively, first rule wins', () => {
    const { rules } = parseRules('title: jira -> J\napp: chrome -> C');
    expect(matchRule(rules, { title: 'PROJ-1 - Jira - Google Chrome', app: 'Google Chrome' })?.folder).toBe('J');
    expect(matchRule(rules, { title: 'Docs - Google Chrome', app: 'Google Chrome' })?.folder).toBe('C');
    expect(matchRule(rules, { title: 'Untitled - Notepad', app: 'Notepad' })).toBeNull();
  });

  it('derives the app from a window title', () => {
    expect(appFromTitle('PROJ-12 - Jira - Google Chrome')).toBe('Google Chrome');
    expect(appFromTitle('Screen 1')).toBe('Screen 1');
  });
});
