import { Navigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";

export default function CompanyGate({ children }: { children: React.ReactNode }) {
  const { companies, loading } = useCompany();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (companies.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
