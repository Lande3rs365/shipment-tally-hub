import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Building2, MapPin, CheckCircle2, ArrowRight, Loader2, Plus, X } from "lucide-react";

const MAX_LOCATIONS = 5;

type Step = "company" | "locations" | "done";

interface LocationEntry {
  name: string;
  code: string;
  isPrimary: boolean;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companies, loading: companiesLoading, setCurrentCompany } = useCompany();
  const [step, setStep] = useState<Step>("company");
  const [loading, setLoading] = useState(false);

  // Company form
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  // Locations — start with one primary location
  const [locations, setLocations] = useState<LocationEntry[]>([
    { name: "Primary Location", code: "LOC-01", isPrimary: true },
  ]);

  useEffect(() => {
    if (!companiesLoading && companies.length > 0 && step !== "done") {
      navigate("/", { replace: true });
    }
  }, [companiesLoading, companies.length, navigate, step]);

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("locations");
  };

  const updateLocation = (index: number, field: "name" | "code", value: string) => {
    setLocations(prev =>
      prev.map((loc, i) =>
        i === index
          ? { ...loc, [field]: field === "code" ? value.toUpperCase().replace(/[^A-Z0-9-]/g, "") : value }
          : loc
      )
    );
  };

  const addLocation = () => {
    if (locations.length >= MAX_LOCATIONS) return;
    const nextNum = locations.length + 1;
    setLocations(prev => [
      ...prev,
      { name: "", code: `LOC-0${nextNum}`, isPrimary: false },
    ]);
  };

  const removeLocation = (index: number) => {
    if (locations[index].isPrimary) return;
    setLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const db = supabase as any;
      const companyId = crypto.randomUUID();

      // 1. Atomically create company + owner membership via secure function
      const { error: createError } = await db.rpc('create_company_with_owner', {
        _company_id: companyId,
        _company_name: companyName.trim(),
        _company_code: companyCode.trim().toUpperCase(),
      });

      if (createError) throw createError;

      // 3. Create stock locations
      const validLocations = locations.filter(l => l.name.trim() && l.code.trim());
      if (validLocations.length > 0) {
        const { error: locError } = await db
          .from("stock_locations")
          .insert(validLocations.map(l => ({
            company_id: companyId,
            name: l.name.trim(),
            code: l.code.trim(),
            location_type: "warehouse",
          })));

        if (locError) throw locError;
      }

      // 4. Set as current company in context
      setCurrentCompany({ id: companyId, name: companyName.trim(), code: companyCode.trim().toUpperCase(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setStep("done");

      // 5. Redirect after a moment
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("Onboarding error:", err);
      const message = err?.code === "23505"
        ? "That company code is already taken. Please go back and choose a different one."
        : err?.message || "Something went wrong. Please try again.";
      toast({ title: "Setup failed", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3">
          {[
            { key: "company", label: "Company", icon: Building2 },
            { key: "locations", label: "Locations", icon: MapPin },
            { key: "done", label: "Ready", icon: CheckCircle2 },
          ].map((s, i, arr) => {
            const stepOrder = ["company", "locations", "done"];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(s.key);
            const isActive = step === s.key;
            const isComplete = thisIdx < currentIdx;

            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" :
                    isComplete ? "bg-success/20 text-success" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`w-8 h-px ${isComplete ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step: Company */}
        {step === "company" && (
          <Card className="border-border bg-card">
            <CardHeader className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Package className="w-6 h-6 text-primary-foreground" />
              </div>
              <CardTitle className="text-xl text-foreground">Welcome to DistroHub</CardTitle>
              <CardDescription className="text-muted-foreground">
                Let's set up your company to get started with distribution operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. NutriWell Distribution"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCode">Short code</Label>
                  <Input
                    id="companyCode"
                    placeholder="e.g. NUTRIWELL"
                    value={companyCode}
                    onChange={e => setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    required
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier for this company. Letters, numbers, dashes only.</p>
                </div>
                <Button type="submit" className="w-full" disabled={!companyName.trim() || !companyCode.trim()}>
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
              <div className="mt-4 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground mb-2">Been invited to an existing company?</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/accept-invite")}
                  className="gap-2"
                >
                  Enter Invite Code
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Locations */}
        {step === "locations" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Stock Locations
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Define where your inventory lives. You can add up to {MAX_LOCATIONS} locations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {locations.map((loc, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-muted/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {loc.isPrimary ? "Primary Location" : `Location ${i + 1}`}
                      </span>
                      {!loc.isPrimary && (
                        <button
                          type="button"
                          onClick={() => removeLocation(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="e.g. Main Warehouse"
                          value={loc.name}
                          onChange={e => updateLocation(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs">Code</Label>
                        <Input
                          placeholder="LOC-01"
                          value={loc.code}
                          onChange={e => updateLocation(i, "code", e.target.value)}
                          maxLength={15}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {locations.length < MAX_LOCATIONS && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLocation}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4" /> Add Location
                </Button>
              )}

              {locations.length >= MAX_LOCATIONS && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum of {MAX_LOCATIONS} locations reached.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("company")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={loading || !locations.some(l => l.name.trim() && l.code.trim())}
                  className="flex-1"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <>Finish Setup <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card className="border-border bg-card">
            <CardHeader className="text-center space-y-4 py-10">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <CardTitle className="text-xl text-foreground">You're all set!</CardTitle>
              <CardDescription className="text-muted-foreground">
                <strong className="text-foreground">{companyName}</strong> has been created with{" "}
                {locations.filter(l => l.name.trim() && l.code.trim()).length} stock location{locations.filter(l => l.name.trim() && l.code.trim()).length !== 1 ? "s" : ""}. Redirecting to your dashboard…
              </CardDescription>
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
