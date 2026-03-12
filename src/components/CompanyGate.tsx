import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function CompanyGate({ children }: { children: React.ReactNode }) {
  const { companies, loading } = useCompany();
  const { user } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || loading) return;
    const check = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .single();
        setOnboardingCompleted(data?.onboarding_completed ?? false);
      } catch {
        setOnboardingCompleted(false);
      } finally {
        setOnboardingChecked(true);
      }
    };
    check();
  }, [user, loading]);

  if (loading || !onboardingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!onboardingCompleted || companies.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
