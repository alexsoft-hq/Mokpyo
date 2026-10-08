import { useState, useEffect } from 'react';

// 'list'(목록보기)는 /table 뷰와 중복되어 제거됨 — 과거 저장값은 'normal' 로 마이그레이션(아래)
export type ViewMode = 'normal' | 'compact';
export type Theme = 'light' | 'dark' | 'system';

export interface UserSettings {
  defaultViewMode: ViewMode;
  autoRefreshInterval: number; // seconds, 0 = disabled
  showCompletedByDefault: boolean;
  enableAutoRefresh: boolean;
  theme: Theme;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultViewMode: 'compact',
  autoRefreshInterval: 30,
  showCompletedByDefault: false,
  enableAutoRefresh: true,
  theme: 'system',
};

const STORAGE_KEY = 'mokpyo_user_settings';
const LEGACY_STORAGE_KEY = 'goalboard_user_settings';

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      // 프로젝트 이름 변경 전 저장값도 한 번 읽어 새 키로 자연스럽게 이관한다.
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_USER_SETTINGS, ...parsed };
        // 제거된 'list' 뷰모드 마이그레이션 → 'normal'
        if ((merged.defaultViewMode as string) === 'list') merged.defaultViewMode = 'normal';
        return merged;
      }
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
    return DEFAULT_USER_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  }, [settings]);

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_USER_SETTINGS);
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
};
