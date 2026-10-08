import { useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const previous = document.title;
    document.title = '페이지를 찾을 수 없습니다 · Mokpyo';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 md:px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <LogoMark size={40} />
        </div>

        <p className="mt-6 text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          주소가 바뀌었거나 삭제된 페이지입니다. 주소를 다시 확인하거나 홈에서 다시 찾아 주세요.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Button asChild>
            <Link to="/">
              <Home aria-hidden="true" />
              홈으로
            </Link>
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" />
            이전으로
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
