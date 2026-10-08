// @vitest-environment jsdom
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

interface HarnessProps {
  paletteOpen?: boolean;
  onPaletteOpenChange?: (open: boolean) => void;
  onOpenHelp?: () => void;
  enabled?: boolean;
}

function Harness({ paletteOpen = false, onPaletteOpenChange = () => {}, onOpenHelp = () => {}, enabled }: HarnessProps) {
  useKeyboardShortcuts({ paletteOpen, onPaletteOpenChange, onOpenHelp, enabled });
  const location = useLocation();
  return (
    <div>
      <div data-testid="loc">{`${location.pathname}${location.search}`}</div>
      <input data-testid="field" />
    </div>
  );
}

function renderHarness(props: HarnessProps = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Harness {...props} />
    </MemoryRouter>
  );
}

const location = () => screen.getByTestId('loc').textContent;

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove());
  });

  it('g 다음 t 를 누르면 테이블로 이동한다', () => {
    renderHarness();
    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 't' });
    expect(location()).toBe('/table');
  });

  it('g 다음 c/b/l/d 도 각 뷰로 이동한다', () => {
    const cases: [string, string][] = [
      ['c', '/'],
      ['b', '/board'],
      ['l', '/timeline'],
      ['d', '/dashboard'],
    ];
    for (const [key, path] of cases) {
      const view = renderHarness();
      fireEvent.keyDown(document.body, { key: 'g' });
      fireEvent.keyDown(document.body, { key });
      expect(location()).toBe(path);
      view.unmount();
    }
  });

  it('g 를 누르고 1초가 지나면 시퀀스가 풀린다', () => {
    renderHarness();
    fireEvent.keyDown(document.body, { key: 'g' });
    vi.advanceTimersByTime(1500);
    fireEvent.keyDown(document.body, { key: 't' });
    expect(location()).toBe('/dashboard');
  });

  it('n 은 새 목표 화면으로 보낸다', () => {
    renderHarness();
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(location()).toBe('/?new=1');
  });

  it('? 는 도움말을 연다', () => {
    const onOpenHelp = vi.fn();
    renderHarness({ onOpenHelp });
    fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('Cmd/Ctrl+K 는 팔레트를 연다', () => {
    const onPaletteOpenChange = vi.fn();
    renderHarness({ onPaletteOpenChange });
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    expect(onPaletteOpenChange).toHaveBeenCalledWith(true);
  });

  it('팔레트가 열려 있으면 Cmd+K 는 닫는다', () => {
    const onPaletteOpenChange = vi.fn();
    renderHarness({ paletteOpen: true, onPaletteOpenChange });
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(onPaletteOpenChange).toHaveBeenCalledWith(false);
  });

  it('입력 중에는 단축키를 잡지 않는다', () => {
    renderHarness();
    const field = screen.getByTestId('field');
    fireEvent.keyDown(field, { key: 'g' });
    fireEvent.keyDown(field, { key: 't' });
    expect(location()).toBe('/dashboard');
  });

  it('다이얼로그가 열려 있으면 단축키도 팔레트도 열리지 않는다', () => {
    const onPaletteOpenChange = vi.fn();
    renderHarness({ onPaletteOpenChange });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    fireEvent.keyDown(document.body, { key: 'n' });
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });

    expect(location()).toBe('/dashboard');
    expect(onPaletteOpenChange).not.toHaveBeenCalled();
  });

  it('enabled=false 면 아무 것도 하지 않는다', () => {
    renderHarness({ enabled: false });
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(location()).toBe('/dashboard');
  });
});
