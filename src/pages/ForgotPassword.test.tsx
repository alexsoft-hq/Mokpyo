// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const mockForgotPassword = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    forgotPassword: (email: string) => mockForgotPassword(email),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPassword />
    </MemoryRouter>
  );
}

describe('ForgotPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the email input and the submit button', () => {
    renderPage();

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재설정 링크 받기' })).toBeInTheDocument();
  });

  it('should call the API and show the sent screen on submit', async () => {
    mockForgotPassword.mockResolvedValue({ message: '가입된 이메일이라면 재설정 링크를 보냈습니다.' });
    renderPage();

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    });
    await waitFor(() => {
      expect(screen.getByText('메일을 확인해주세요')).toBeInTheDocument();
    });
    expect(screen.getByText(/스팸함/)).toBeInTheDocument();
  });

  it('should let the user go back and request with another address', async () => {
    mockForgotPassword.mockResolvedValue({ message: 'ok' });
    renderPage();

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '다른 주소로 다시 요청' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '다른 주소로 다시 요청' }));

    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
  });

  it('should show an error when the request fails', async () => {
    mockForgotPassword.mockRejectedValue(new Error('요청이 너무 많습니다. 15분 후 다시 시도해주세요.'));
    renderPage();

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }));

    await waitFor(() => {
      expect(screen.getByText('요청이 너무 많습니다. 15분 후 다시 시도해주세요.')).toBeInTheDocument();
    });
  });
});
