import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { ThemeApplier } from "./components/layout/ThemeApplier";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalShortcuts } from "./components/GlobalShortcuts";
import { SessionExpiryHandler } from "./components/SessionExpiryHandler";
import { Loader2 } from "lucide-react";
import { takeMcpLoginReturn } from "@/lib/api/mcp";

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ActivityFeed = lazy(() => import("./pages/ActivityFeed"));
const AIReport = lazy(() => import("./pages/AIReport"));
const MemberView = lazy(() => import("./pages/MemberView"));
const Timeline = lazy(() => import("./pages/Timeline"));
const TableView = lazy(() => import("./pages/TableView"));
const BoardView = lazy(() => import("./pages/BoardView"));
const Automations = lazy(() => import("./pages/Automations"));
const DashboardView = lazy(() => import("./pages/DashboardView"));
const WorkspaceCreate = lazy(() => import("./pages/WorkspaceCreate"));
const WorkspaceSettings = lazy(() => import("./pages/WorkspaceSettings"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Landing = lazy(() => import("./pages/marketing/Landing"));
const Pricing = lazy(() => import("./pages/marketing/Pricing"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const McpConsent = lazy(() => import("./pages/McpConsent"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isLoading: isWsLoading, needsWorkspace } = useWorkspace();

  if (isLoading || isWsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsWorkspace) {
    return <Navigate to="/workspace/new" replace />;
  }

  return <>{children}</>;
}

// "/" 는 비로그인 방문자에게는 제품 소개(랜딩), 로그인 사용자에게는 카드 보드다.
function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Landing />;
  return (
    <ProtectedRoute>
      <Index />
    </ProtectedRoute>
  );
}

// Resume only the scoped consent path saved before Google sign-in.
function McpLoginReturn() {
  const [hasCallbackToken] = useState(() => !!new URLSearchParams(window.location.search).get('token'));
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!hasCallbackToken || !isAuthenticated || isLoading || location.pathname !== '/') return;
    const path = takeMcpLoginReturn();
    if (path) navigate(path, { replace: true });
  }, [hasCallbackToken, isAuthenticated, isLoading, location.pathname, navigate]);
  return null;
}

const App = () => {
  // Get base URL from Vite config (matches VITE_BASE_URL)
  const basename = import.meta.env.BASE_URL;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <AuthProvider>
            <McpLoginReturn />
            <WorkspaceProvider>
              <ProjectProvider>
                <ThemeApplier>
                <GlobalShortcuts />
                <SessionExpiryHandler />
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/connect/mcp" element={<McpConsent />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/welcome" element={<Landing />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/workspace/new" element={<WorkspaceCreate />} />
                    <Route path="/workspace/settings" element={<ProtectedRoute><WorkspaceSettings /></ProtectedRoute>} />
                    <Route path="/invite/:token" element={<InviteAccept />} />
                    <Route path="/" element={<RootRoute />} />
                    <Route path="/activity" element={<ProtectedRoute><ActivityFeed /></ProtectedRoute>} />
                    <Route path="/report" element={<ProtectedRoute><AIReport /></ProtectedRoute>} />
                    <Route path="/members" element={<ProtectedRoute><MemberView /></ProtectedRoute>} />
                    <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
                    <Route path="/table" element={<ProtectedRoute><TableView /></ProtectedRoute>} />
                    <Route path="/board" element={<ProtectedRoute><BoardView /></ProtectedRoute>} />
                    <Route path="/automations" element={<ProtectedRoute><Automations /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
                </ThemeApplier>
              </ProjectProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
