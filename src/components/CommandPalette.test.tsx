// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Goal } from '@/types/goal';

// cmdk 는 ResizeObserver·scrollIntoView 를 쓰는데 jsdom 에는 없다.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = () => {};

const setCurrentProject = vi.fn();

const goals: Goal[] = [
  {
    id: 'goal-1',
    title: '결제 모듈 개편',
    owner: '김철수',
    owners: ['김철수'],
    categories: ['SERVICE'],
    progress: 30,
    size: 'medium',
  },
  {
    id: 'goal-2',
    title: '고객 온보딩 개선',
    owner: '이영희',
    owners: ['이영희'],
    categories: ['AI'],
    progress: 10,
    size: 'small',
  },
];

vi.mock('@/hooks/useGoalsQuery', () => ({
  useGoalsQuery: () => ({ data: goals, isLoading: false }),
}));

vi.mock('@/contexts/ProjectContext', () => ({
  useProject: () => ({
    projects: [
      { id: 'p1', name: '2026 로드맵' },
      { id: 'p2', name: '플랫폼 리팩터링' },
    ],
    currentProject: { id: 'p1', name: '2026 로드맵' },
    setCurrentProject,
  }),
}));

import { CommandPalette } from './CommandPalette';

function Harness() {
  const location = useLocation();
  return (
    <>
      <div data-testid="loc">{`${location.pathname}${location.search}`}</div>
      <CommandPalette open onOpenChange={() => {}} onOpenHelp={() => {}} />
    </>
  );
}

function renderPalette() {
  return render(
    <MemoryRouter initialEntries={['/table']}>
      <Harness />
    </MemoryRouter>
  );
}

const input = () => screen.getByPlaceholderText('이동할 화면, 프로젝트, 목표를 검색하세요');

describe('CommandPalette', () => {
  it('이동·프로젝트·목표·작업 그룹을 보여준다', () => {
    renderPalette();
    expect(screen.getByText('이동')).toBeInTheDocument();
    expect(screen.getByText('테이블')).toBeInTheDocument();
    expect(screen.getByText('프로젝트 전환')).toBeInTheDocument();
    expect(screen.getByText('플랫폼 리팩터링')).toBeInTheDocument();
    expect(screen.getByText('결제 모듈 개편')).toBeInTheDocument();
    expect(screen.getByText('새 목표')).toBeInTheDocument();
  });

  it('현재 프로젝트는 전환 목록에 나오지 않는다', () => {
    renderPalette();
    expect(screen.queryByText('2026 로드맵')).not.toBeInTheDocument();
  });

  it('검색어로 목표를 걸러낸다', () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: '결제' } });
    expect(screen.getByText('결제 모듈 개편')).toBeInTheDocument();
    expect(screen.queryByText('고객 온보딩 개선')).not.toBeInTheDocument();
    // 이동·프로젝트 그룹도 함께 걸러진다
    expect(screen.queryByText('테이블')).not.toBeInTheDocument();
  });

  it('담당자 이름으로도 목표를 찾는다', () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: '이영희' } });
    expect(screen.getByText('고객 온보딩 개선')).toBeInTheDocument();
  });

  it('결과가 없으면 안내 문구를 보여준다', () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: '존재하지않는검색어' } });
    expect(screen.getByText('검색 결과가 없습니다.')).toBeInTheDocument();
  });

  it('목표를 고르면 현재 뷰에서 ?item= 으로 연다', () => {
    renderPalette();
    fireEvent.click(screen.getByText('결제 모듈 개편'));
    expect(screen.getByTestId('loc').textContent).toBe('/table?item=goal-1');
  });

  it('이동 항목을 고르면 해당 경로로 간다', () => {
    renderPalette();
    fireEvent.click(screen.getByText('보드'));
    expect(screen.getByTestId('loc').textContent).toBe('/board');
  });

  it('프로젝트를 고르면 현재 프로젝트를 바꾼다', () => {
    setCurrentProject.mockClear();
    renderPalette();
    fireEvent.click(screen.getByText('플랫폼 리팩터링'));
    expect(setCurrentProject).toHaveBeenCalledWith({ id: 'p2', name: '플랫폼 리팩터링' });
  });

  it('item 파라미터를 읽지 않는 뷰에서는 카드(/)로 보낸다', () => {
    render(
      <MemoryRouter initialEntries={['/members']}>
        <Harness />
      </MemoryRouter>
    );
    const dialogs = screen.getAllByRole('dialog');
    fireEvent.click(within(dialogs[dialogs.length - 1]).getByText('결제 모듈 개편'));
    expect(screen.getAllByTestId('loc').pop()?.textContent).toBe('/?item=goal-1');
  });
});
