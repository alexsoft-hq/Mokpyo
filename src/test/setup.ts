import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';
import i18n from '../i18n';

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

// 브라우저 환경에서만 mock 설정 (jsdom 사용 시)
if (typeof window !== 'undefined') {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
