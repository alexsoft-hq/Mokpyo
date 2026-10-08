import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UNAUTHORIZED_EVENT } from '@/lib/api/http';

/**
 * 세션 만료(401) 이벤트를 받아 로그아웃하고 로그인 화면으로 보낸다. 돌아올 경로는 redirect 에 보존.
 * AuthContext 는 라우터에 의존하지 않도록 두고, 라우터 안에서 도는 이 컴포넌트가 이동을 맡는다.
 */
export function SessionExpiryHandler() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onUnauthorized = () => {
      if (!localStorage.getItem('auth_token')) return;
      logout();
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/login?expired=1&redirect=${encodeURIComponent(returnTo)}`, { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout, navigate, location.pathname, location.search]);

  return null;
}
