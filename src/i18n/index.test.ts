import { describe, expect, it } from 'vitest';
import i18n, { englishMessages, getLocale, normalizeLanguage, setLanguage, t } from './index';
import { goalsToCsv } from '@/lib/exportCsv';
import { formatRelativeTime } from '@/types/activity';
import { localizeApiError } from '@/lib/api/http';

describe('localization', () => {
  it('selects Korean for Korean regional locales and English for other locales', () => {
    expect(normalizeLanguage('ko-KR')).toBe('ko');
    expect(normalizeLanguage('en-GB')).toBe('en');
    expect(normalizeLanguage('fr-FR')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('en');
  });

  it('keeps interpolation variables consistent across every translation', () => {
    const variables = (value: string) => [...value.matchAll(/\{\{\s*([^},]+).*?\}\}/g)].map(match => match[1]).sort();
    for (const [source, english] of Object.entries(englishMessages)) {
      expect(english.trim(), source).not.toBe('');
      expect(variables(english), source).toEqual(variables(source));
    }
  });

  it('changes UI labels and export headings while retaining user-authored data', async () => {
    await setLanguage('en');
    expect(getLocale()).toBe('en-US');
    expect(t('언어')).toBe('Language');
    expect(t('사용자가 작성한 목표')).toBe('사용자가 작성한 목표');
    expect(goalsToCsv([])).toContain('Title,Status,Assignee,Progress');
    await setLanguage('ko');
    expect(goalsToCsv([])).toContain('제목,상태,담당자,진행률');
    expect(i18n.language).toBe('ko');
  });

  it('formats singular English relative time and localizes API fallbacks', async () => {
    await setLanguage('en');
    expect(formatRelativeTime(new Date(Date.now() - 65_000).toISOString())).toBe('1 minute ago');
    expect(localizeApiError('서버에서 아직 번역하지 않은 오류', '로그인에 실패했습니다.')).toBe('Could not sign in.');
    await setLanguage('ko');
    expect(localizeApiError('서버에서 아직 번역하지 않은 오류', '로그인에 실패했습니다.')).toBe('서버에서 아직 번역하지 않은 오류');
  });
});
