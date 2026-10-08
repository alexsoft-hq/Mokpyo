// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserSettings } from './useUserSettings';

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('이름 변경 전 저장값을 복원하고 새 키로 이관한다', async () => {
    const legacySettings = {
      defaultViewMode: 'normal',
      autoRefreshInterval: 60,
      showCompletedByDefault: true,
      enableAutoRefresh: false,
      theme: 'dark',
    };
    vi.mocked(localStorage.getItem).mockImplementation((key) =>
      key === 'goalboard_user_settings' ? JSON.stringify(legacySettings) : null
    );

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toEqual(legacySettings);
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'mokpyo_user_settings',
        JSON.stringify(legacySettings)
      );
    });
  });

  it('새 키가 있으면 이름 변경 전 저장값보다 우선한다', () => {
    const currentSettings = {
      defaultViewMode: 'compact',
      autoRefreshInterval: 15,
      showCompletedByDefault: false,
      enableAutoRefresh: true,
      theme: 'light',
    };
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === 'mokpyo_user_settings') return JSON.stringify(currentSettings);
      if (key === 'goalboard_user_settings') return JSON.stringify({ theme: 'dark' });
      return null;
    });

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toEqual(currentSettings);
  });
});
