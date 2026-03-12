import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeRedirectPath } from "@/lib/sanitizeRedirect";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    // Preserve the attempted path so LoginPage can redirect back after auth.
    // sanitizeRedirectPath guards against javascript: / open-redirect payloads
    // (CVE GHSA-2w69-qvjg-hvjx) if the path ever originates from user input.
    const from = sanitizeRedirectPath(location.pathname, "/");
    return <Navigate to="/login" state={{ from }} replace />;
  }

  return <>{children}</>;
}
