import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, Building2, Users, ShoppingCart, Factory,
  Target, User, CheckCircle2, Loader2,
} from "lucide-react";
import OnboardingStepCard from "@/components/onboarding/OnboardingStepCard";
import ChoiceGrid from "@/components/onboarding/ChoiceGrid";

const TOTAL_STEPS = 7;

const BUSINESS_TYPE_OPTIONS = [
  { value: "business", label: "Business", icon: <Building2 className="w-5 h-5" /> },
  { value: "freelancer", label: "Freelancer", icon: <User className="w-5 h-5" /> },
  { value: "personal", label: "Personal", icon: <Package className="w-5 h-5" /> },
];

const TEAM_SIZE_OPTIONS = [
  { value: "just_me", label: "Just me" },
  { value: "2-5", label: "2–5" },
  { value: "6-20", label: "6–20" },
  { value: "20+", label: "20+" },
];

const ECOMMERCE_OPTIONS = [
  { value: "shopify", label: "Shopify", icon: <ShoppingCart className="w-5 h-5" /> },
  { value: "woocommerce", label: "WooCommerce", icon: <ShoppingCart className="w-5 h-5" /> },
  { value: "amazon", label: "Amazon", icon: <ShoppingCart className="w-5 h-5" /> },
  { value: "other", label: "Other", icon: <ShoppingCart className="w-5 h-5" /> },
  { value: "none", label: "None yet", icon: <Package className="w-5 h-5" /> },
];

const INDUSTRY_OPTIONS = [
  { value: "fmcg", label: "FMCG", icon: <Factory className="w-5 h-5" /> },
  { value: "health_beauty", label: "Health & Beauty", icon: <Factory className="w-5 h-5" /> },
  { value: "food_bev", label: "Food & Bev", icon: <Factory className="w-5 h-5" /> },
  { value: "other", label: "Other", icon: <Factory className="w-5 h-5" /> },
];

const GOALS_OPTIONS = [
  { value: "stock_accuracy", label: "Stock accuracy", icon: <Target className="w-5 h-5" /> },
  { value: "fulfillment", label: "Order fulfillment", icon: <Target className="w-5 h-5" /> },
  { value: "returns", label: "Returns", icon: <Target className="w-5 h-5" /> },
  { value: "visibility", label: "Visibility", icon: <Target className="w-5 h-5" /> },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies, loading: companiesLoading, setCurrentCompany } = useCompany();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Answers
  const [businessType, setBusinessType] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [ecommercePlatform, setEcommercePlatform] = useState("");
  const [industry, setIndustry] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  // Profile
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || ""
  );
  const [jobTitle, setJobTitle] = useState("");

  // Company
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  // Check if user already completed onboarding
  useEffect(() => {
    if (!companiesLoading && companies.length > 0) {
      // Check if onboarding is completed
      const checkOnboarding = async () => {
        if (!user) return;
        const { data } = await (supabase as any)
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .single();
        if (data?.onboarding_completed) {
          navigate("/", { replace: true });
        }
      };
      checkOnboarding();
    }
  }, [companiesLoading, companies.length, navigate, user]);

  // Auto-generate company code from name
  useEffect(() => {
    if (companyName.trim()) {
      const code = companyName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      setCompanyCode(code);
    }
  }, [companyName]);

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const db = supabase as any;
      const companyId = crypto.randomUUID();

      // 1. Create company + owner
      const { error: createError } = await db.rpc("create_company_with_owner", {
        _company_id: companyId,
        _company_name: companyName.trim(),
        _company_code: companyCode.trim().toUpperCase(),
      });
      if (createError) throw createError;

      // 2. Create a default stock location
      const { error: locError } = await db.from("stock_locations").insert({
        company_id: companyId,
        name: "Primary Warehouse",
        code: "WH-01",
        location_type: "warehouse",
      });
      if (locError) throw locError;

      // 3. Update profile with onboarding data
      const { error: profileError } = await db
        .from("profiles")
        .update({
          display_name: displayName.trim() || user.email,
          job_title: jobTitle.trim() || null,
          onboarding_answers: {
            business_type: businessType,
            team_size: teamSize,
            ecommerce_platform: ecommercePlatform,
            industry,
            goals,
          },
          onboarding_completed: true,
        })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      // 4. Set current company
      setCurrentCompany({
        id: companyId,
        name: companyName.trim(),
        code: companyCode.trim().toUpperCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 5. Show done and redirect
      setStep(TOTAL_STEPS); // done state
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (err: any) {
      console.error("Onboarding error:", err);
      const message = err?.code === "23505"
        ? "That company code is already taken. Please choose a different one."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Setup failed", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  // Done state
  if (step === TOTAL_STEPS) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-lg border-border bg-card">
          <CardHeader className="text-center space-y-4 py-10">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">You're all set!</CardTitle>
            <CardDescription className="text-muted-foreground">
              <strong className="text-foreground">{companyName}</strong> is ready. Redirecting to your dashboard…
            </CardDescription>
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <AnimatePresence mode="wait">
      {/* Step 0: Business Type */}
      {step === 0 && (
        <OnboardingStepCard
          stepIndex={0}
          totalSteps={TOTAL_STEPS}
          title="Welcome! Tell us about yourself"
          description="This helps us tailor DistroHub to your needs."
          icon={<Package className="w-6 h-6 text-primary-foreground" />}
          onNext={() => setStep(1)}
          nextDisabled={!businessType}
        >
          <ChoiceGrid
            options={BUSINESS_TYPE_OPTIONS}
            value={businessType}
            onChange={(v) => setBusinessType(v as string)}
            columns={3}
          />
        </OnboardingStepCard>
      )}

      {/* Step 1: Team Size */}
      {step === 1 && (
        <OnboardingStepCard
          stepIndex={1}
          totalSteps={TOTAL_STEPS}
          title="How big is your team?"
          icon={<Users className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          nextDisabled={!teamSize}
        >
          <ChoiceGrid
            options={TEAM_SIZE_OPTIONS}
            value={teamSize}
            onChange={(v) => setTeamSize(v as string)}
          />
        </OnboardingStepCard>
      )}

      {/* Step 2: E-commerce Platform */}
      {step === 2 && (
        <OnboardingStepCard
          stepIndex={2}
          totalSteps={TOTAL_STEPS}
          title="What e-commerce platform do you use?"
          icon={<ShoppingCart className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!ecommercePlatform}
        >
          <ChoiceGrid
            options={ECOMMERCE_OPTIONS}
            value={ecommercePlatform}
            onChange={(v) => setEcommercePlatform(v as string)}
            columns={3}
          />
        </OnboardingStepCard>
      )}

      {/* Step 3: Industry */}
      {step === 3 && (
        <OnboardingStepCard
          stepIndex={3}
          totalSteps={TOTAL_STEPS}
          title="What industry are you in?"
          icon={<Factory className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextDisabled={!industry}
        >
          <ChoiceGrid
            options={INDUSTRY_OPTIONS}
            value={industry}
            onChange={(v) => setIndustry(v as string)}
          />
        </OnboardingStepCard>
      )}

      {/* Step 4: Goals (multi-select) */}
      {step === 4 && (
        <OnboardingStepCard
          stepIndex={4}
          totalSteps={TOTAL_STEPS}
          title="What are you looking to improve?"
          description="Select all that apply."
          icon={<Target className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
          nextDisabled={goals.length === 0}
        >
          <ChoiceGrid
            options={GOALS_OPTIONS}
            value={goals}
            onChange={(v) => setGoals(v as string[])}
            multiSelect
          />
        </OnboardingStepCard>
      )}

      {/* Step 5: Profile */}
      {step === 5 && (
        <OnboardingStepCard
          stepIndex={5}
          totalSteps={TOTAL_STEPS}
          title="Your profile"
          description="How should we display you in the app?"
          icon={<User className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(4)}
          onNext={() => setStep(6)}
          nextDisabled={!displayName.trim()}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                placeholder="Jane Smith"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job title <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="jobTitle"
                placeholder="e.g. Operations Manager"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>
        </OnboardingStepCard>
      )}

      {/* Step 6: Company Setup */}
      {step === 6 && (
        <OnboardingStepCard
          stepIndex={6}
          totalSteps={TOTAL_STEPS}
          title="Set up your company"
          description="We'll create your workspace with a default warehouse location."
          icon={<Building2 className="w-6 h-6 text-primary-foreground" />}
          onBack={() => setStep(5)}
          onNext={handleFinish}
          nextLabel="Finish Setup"
          nextDisabled={!companyName.trim() || !companyCode.trim()}
          loading={loading}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                placeholder="e.g. NutriWell Distribution"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCode">Short code</Label>
              <Input
                id="companyCode"
                placeholder="e.g. NUTRIWELL"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                required
                maxLength={20}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Auto-generated from company name. You can edit it.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border text-center">
            <p className="text-xs text-muted-foreground mb-2">Been invited to an existing company?</p>
            <button
              type="button"
              onClick={() => navigate("/accept-invite")}
              className="text-xs text-primary hover:underline"
            >
              Enter Invite Code Instead
            </button>
          </div>
        </OnboardingStepCard>
      )}
    </div>
  );
}
