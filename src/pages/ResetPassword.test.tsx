// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';

const mockValidateResetToken = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    validateResetToken: (token: string) => mockValidateResetToken(token),
    resetPassword: (token: string, password: string) => mockResetPassword(token, password),
  },
}));

function renderPage(search = '?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <ResetPassword />
    </MemoryRouter>
  );
}

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate the token on mount and show the form when it is valid', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: true });
    renderPage();

    await waitFor(() => {
      expect(mockValidateResetToken).toHaveBeenCalledWith('abc123');
    });
    await waitFor(() => {
      expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('새 비밀번호 확인')).toBeInTheDocument();
  });

  it('should show the invalid-link screen with a re-request link when the token is invalid', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: false });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('링크를 사용할 수 없습니다')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '다시 요청하기' })).toHaveAttribute('href', '/forgot-password');
  });

  it('should show the invalid-link screen when no token is given', async () => {
    renderPage('');

    await waitFor(() => {
      expect(screen.getByText('링크를 사용할 수 없습니다')).toBeInTheDocument();
    });
    expect(mockValidateResetToken).not.toHaveBeenCalled();
  });

  it('should show an error when the two passwords differ', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: true });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass124' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(() => {
      expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeInTheDocument();
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('should show an error when the password violates the policy', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: true });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'abc1234' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'abc1234' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(() => {
      expect(screen.getByText('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.')).toBeInTheDocument();
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('should submit the new password and show the login button on success', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: true });
    mockResetPassword.mockResolvedValue({ message: '비밀번호가 변경되었습니다.' });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('abc123', 'newpass123');
    });
    await waitFor(() => {
      expect(screen.getByText('비밀번호를 변경했습니다')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
  });

  it('should show the server error when the reset fails', async () => {
    mockValidateResetToken.mockResolvedValue({ valid: true });
    mockResetPassword.mockRejectedValue(new Error('링크가 만료되었거나 올바르지 않습니다.'));
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    await waitFor(() => {
      expect(screen.getByText('링크가 만료되었거나 올바르지 않습니다.')).toBeInTheDocument();
    });
  });
});
