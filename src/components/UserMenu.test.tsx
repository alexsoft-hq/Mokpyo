// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getAvatarInfo } from './UserMenu';

// Mock the sub-dialogs
vi.mock('./ProfileDialog', () => ({
  ProfileDialog: () => null,
}));
vi.mock('./ChangePasswordDialog', () => ({
  ChangePasswordDialog: () => null,
}));

// Dynamically import UserMenu after mocks
const { UserMenu } = await import('./UserMenu');

describe('UserMenu', () => {
  const user = {
    userId: '1',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'default:1',
  };
  const onLogout = vi.fn();
  const onUserUpdate = vi.fn();

  it('should render avatar button with default emoji', () => {
    render(<UserMenu user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />);
    expect(screen.getByText('😀')).toBeTruthy();
  });

  it('should render avatar with initials when no picture', () => {
    const noPicUser = { ...user, picture: undefined };
    render(<UserMenu user={noPicUser} onLogout={onLogout} onUserUpdate={onUserUpdate} />);
    expect(screen.getByText('TU')).toBeTruthy();
  });

  it('should render a button element', () => {
    render(<UserMenu user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});

describe('getAvatarInfo', () => {
  it('should return null for no picture', () => {
    expect(getAvatarInfo(null)).toBeNull();
    expect(getAvatarInfo(undefined)).toBeNull();
  });

  it('should parse default avatar', () => {
    const info = getAvatarInfo('default:1');
    expect(info?.type).toBe('default');
    expect(info).toHaveProperty('emoji', '😀');
  });

  it('should parse upload avatar', () => {
    const info = getAvatarInfo('upload:file.jpg');
    expect(info?.type).toBe('upload');
  });

  it('should parse URL avatar', () => {
    const info = getAvatarInfo('https://example.com/pic.jpg');
    expect(info?.type).toBe('url');
  });

  it('should return null for unknown picture format', () => {
    const info = getAvatarInfo('unknown-format');
    expect(info).toBeNull();
  });
});
