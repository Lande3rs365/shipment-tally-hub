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
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .single();
        if (error) {
          // PGRST116 = row not found — user genuinely has no profile yet
          if (error.code === "PGRST116") {
            setOnboardingCompleted(false);
          } else {
            // Transient error (network, timeout, etc.) — don't redirect to onboarding
            console.error("CompanyGate: profile query failed", error);
            setOnboardingCompleted(null);
          }
        } else {
          setOnboardingCompleted(data?.onboarding_completed ?? false);
        }
      } catch (err) {
        // Unexpected JS error — don't redirect to onboarding
        console.error("CompanyGate: unexpected error", err);
        setOnboardingCompleted(null);
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

  if (onboardingCompleted === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Failed to load your profile. Check your connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!onboardingCompleted || companies.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
