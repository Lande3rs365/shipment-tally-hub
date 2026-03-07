import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const { setCurrentCompany } = useCompany();
  const [step, setStep] = useState<Step>("company");
  const [loading, setLoading] = useState(false);

  // Company form
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");

  // Locations — start with one primary location
  const [locations, setLocations] = useState<LocationEntry[]>([
    { name: "Primary Location", code: "LOC-01", isPrimary: true },
  ]);

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

      // 1. Create company
      const { error: companyError } = await db
        .from("companies")
        .insert({ id: companyId, name: companyName.trim(), code: companyCode.trim().toUpperCase() });

      if (companyError) throw companyError;

      // 2. Link user to company
      const { error: linkError } = await db
        .from("user_companies")
        .insert({ user_id: user.id, company_id: companyId, role: "owner" });

      if (linkError) throw linkError;

      // 3. Create enabled stock locations
      const enabledLocations = locations.filter(l => l.enabled);
      if (enabledLocations.length > 0) {
        const { error: locError } = await db
          .from("stock_locations")
          .insert(enabledLocations.map(l => ({
            company_id: companyId,
            name: l.name,
            code: l.code,
            location_type: l.location_type,
          })));

        if (locError) throw locError;
      }

      // 4. Set as current company in context
      setCurrentCompany({ id: companyId, name: companyName.trim(), code: companyCode.trim().toUpperCase(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      setStep("done");

      // 5. Redirect after a moment
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      console.error("Onboarding error:", err);
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
                These locations define where inventory can exist. Toggle off any you don't need, or add custom ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {locations.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleLocation(i)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-md border text-sm transition-colors ${
                      loc.enabled
                        ? "border-primary/50 bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        loc.enabled ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {loc.enabled && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{loc.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{loc.code} · {loc.location_type}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Add custom location */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add Custom Location</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Location name"
                    value={customLocName}
                    onChange={e => setCustomLocName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Code"
                    value={customLocCode}
                    onChange={e => setCustomLocCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    className="w-32"
                    maxLength={15}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomLocation}
                    disabled={!customLocName.trim() || !customLocCode.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("company")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={loading || locations.filter(l => l.enabled).length === 0}
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
                {locations.filter(l => l.enabled).length} stock locations. Redirecting to your dashboard…
              </CardDescription>
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
