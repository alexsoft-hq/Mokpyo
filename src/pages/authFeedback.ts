import { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n';

/** Local feedback stays a translation key; API messages retain their centralized formatting. */
export function useAuthFeedback(initialKey = '') {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState({ value: initialKey, local: true });
  const message = feedback.local ? t(feedback.value) : feedback.value;
  const setMessage = useCallback((value: string) => setFeedback({ value, local: false }), []);
  const setLocalMessage = useCallback((key: string) => setFeedback({ value: key, local: true }), []);
  return [message, setMessage, setLocalMessage] as const;
}
