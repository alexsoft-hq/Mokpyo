// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage, t } from '@/i18n';
import Landing from './Landing';
import Pricing from './Pricing';
import Privacy from '@/pages/legal/Privacy';
import Terms from '@/pages/legal/Terms';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});
afterEach(async () => {
  cleanup();
  await setLanguage('ko');
});

describe('page localization', () => {
  it('updates static marketing cards and FAQs when the language changes in place', async () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('팀의 목표를 한 화면에서.');
    await act(() => setLanguage('en'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Your team's goals in one place.");
    expect(screen.getByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByText('How is progress calculated?')).toBeInTheDocument();
    expect(screen.getByText(/Subgoal progress rolls up to its parent goal/)).toBeInTheDocument();
    await act(() => setLanguage('ko'));
    expect(screen.getByText('진행률은 어떻게 계산됩니까.')).toBeInTheDocument();
  });

  it.each([
    ['Pricing', Pricing, '도입과 지원'],
    ['Privacy', Privacy, '개인정보 처리 안내'],
    ['Terms', Terms, '라이선스·이용 안내'],
  ])('renders the complete %s page in English', async (_name, Page, title) => {
    await setLanguage('en');
    const { container } = render(<MemoryRouter><Page /></MemoryRouter>);
    expect(document.title).toContain(t(title));
    expect(container.textContent?.replace(/한국어/g, '')).not.toMatch(/[가-힣]/);
  });
});
