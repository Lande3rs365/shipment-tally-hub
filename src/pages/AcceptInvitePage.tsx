import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, TicketCheck } from "lucide-react";

const db = supabase as any;

interface InviteResult {
  success: boolean;
  message?: string;
  error?: string;
  company_id?: string;
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentCompany } = useCompany();
  
  const token = searchParams.get("token");
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  // Auto-accept if token is in URL
  useEffect(() => {
    if (token && user && !result) {
      acceptByToken(token);
    }
  }, [token, user]);

  const acceptByToken = async (t: string) => {
    setLoading(true);
    try {
      const { data, error } = await db.rpc("accept_invitation_by_token", { _token: t });
      if (error) throw error;
      handleResult(data);
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Failed to accept invitation." });
    } finally {
      setLoading(false);
    }
  };

  const acceptByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await db.rpc("accept_invitation_by_code", { _code: inviteCode.trim() });
      if (error) throw error;
      handleResult(data);
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Failed to accept invitation." });
    } finally {
      setLoading(false);
    }
  };

  const handleResult = (data: any) => {
    setResult(data);
    if (data.success && data.company_id) {
      toast({ title: "Welcome!", description: data.message });
      // Fetch the company and switch to it
      setTimeout(async () => {
        try {
          const { data: companyData, error } = await db
            .from("companies")
            .select("*")
            .eq("id", data.company_id)
            .maybeSingle();
          if (error) throw error;
          if (companyData) {
            setCurrentCompany(companyData);
          }
        } catch (err: any) {
          console.error("Failed to load company after invite:", err);
          toast({ title: "Could not load company", description: "You've joined, but please refresh the page.", variant: "destructive" });
        } finally {
          navigate("/", { replace: true });
        }
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <TicketCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>Join a company on DistroHub</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing invitation...</p>
            </div>
          )}

          {result && (
            <div className="flex flex-col items-center gap-3 py-6">
              {result.success ? (
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              ) : (
                <XCircle className="w-12 h-12 text-destructive" />
              )}
              <p className="text-sm text-center text-foreground">{result.message || result.error}</p>
              {!result.success && (
                <Button variant="outline" onClick={() => setResult(null)} className="mt-2">
                  Try Again
                </Button>
              )}
            </div>
          )}

          {!loading && !result && !token && (
            <form onSubmit={acceptByCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                  id="invite-code"
                  placeholder="Enter your invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  className="text-center font-mono tracking-widest text-lg"
                  maxLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Join Company
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
