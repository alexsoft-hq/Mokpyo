import { Languages } from 'lucide-react';
import { setLanguage, useTranslation, type Language } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-xs text-foreground">
      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
      <select
        aria-label={t('언어')}
        className="max-w-20 cursor-pointer bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={i18n.resolvedLanguage ?? i18n.language}
        onChange={event => void setLanguage(event.target.value as Language)}
      >
        <option value="en" lang="en">English</option>
        <option value="ko" lang="ko">한국어</option>
      </select>
    </label>
  );
}
