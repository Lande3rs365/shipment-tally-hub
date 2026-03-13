import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useStockLocations } from "@/hooks/useSupabaseData";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, MapPin, Users, Save, Loader2, Plus, Trash2, Copy,
  Mail, UserPlus, X, Crown, Lock, Upload, FileText, Plug, Shield, User,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { useExtraSeats } from "@/hooks/useSupabaseData";
import { Coffee } from "lucide-react";
import type { StockLocation } from "@/types/database";
import { DataIntakeContent } from "@/pages/UploadsPage";
import { ExportsContent } from "@/pages/ExportsPage";
import { IntegrationsContent } from "@/pages/IntegrationsPage";

// ─── Company Details Tab ────────────────────────────────────────────
function CompanyDetailsTab() {
  const { currentCompany, setCurrentCompany } = useCompany();
  const [name, setName] = useState(currentCompany?.name || "");
  const [code, setCode] = useState(currentCompany?.code || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentCompany) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({ name: name.trim(), code: code.trim().toUpperCase() })
      .eq("id", currentCompany.id);
    setSaving(false);
    if (error) {
      const msg = error.code === "23505"
        ? "That company code is already taken."
        : "Something went wrong. Please try again.";
      console.error("[settings:save]", error);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } else {
      setCurrentCompany({
        ...currentCompany,
        name: name.trim(),
        code: code.trim().toUpperCase(),
      });
      toast({ title: "Company updated" });
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Company Details
        </CardTitle>
        <CardDescription>Update your company name and short code.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyCode">Short code</Label>
          <Input
            id="companyCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            maxLength={20}
            className="font-mono"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim() || !code.trim()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Stock Locations Tab ────────────────────────────────────────────
function LocationsTab() {
  const { currentCompany } = useCompany();
  const { data: locations = [], isLoading } = useStockLocations();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("warehouse");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!currentCompany || !newName.trim() || !newCode.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("stock_locations").insert({
      company_id: currentCompany.id,
      name: newName.trim(),
      code: newCode.trim().toUpperCase(),
      location_type: newType,
    });
    setAdding(false);
    if (error) {
      console.error("[settings:location-add]", error);
      toast({ title: "Error", description: "Failed to add location. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Location added" });
      setNewName("");
      setNewCode("");
      setNewType("warehouse");
      queryClient.invalidateQueries({ queryKey: ["stock_locations"] });
    }
  };

  const handleDeactivate = async (loc: StockLocation) => {
    const { error } = await supabase
      .from("stock_locations")
      .update({ is_active: false })
      .eq("id", loc.id);
    if (error) {
      console.error("[settings:location-deactivate]", error);
      toast({ title: "Error", description: "Failed to deactivate location. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Location deactivated" });
      queryClient.invalidateQueries({ queryKey: ["stock_locations"] });
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> Stock Locations
        </CardTitle>
        <CardDescription>Manage where your inventory is stored.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing locations */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active locations.</p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{loc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground">{loc.code}</span>
                    <Badge variant="secondary" className="text-[10px]">{loc.location_type}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeactivate(loc)}
                  title="Deactivate location"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new location */}
        <div className="border-t border-border pt-4 space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Location
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Returns Bay"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Code</Label>
              <Input
                placeholder="e.g. RET-01"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                maxLength={15}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                  <SelectItem value="returns">Returns</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding || !newName.trim() || !newCode.trim()} size="sm">
            {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Add Location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Team Members Tab ───────────────────────────────────────────────
interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
}

interface Invitation {
  id: string;
  invitee_email: string;
  role: string;
  invite_code: string;
  expires_at: string;
  accepted_at: string | null;
}

const ROLES = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

const FREE_MEMBER_LIMIT = 3;

function TeamTab() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const extraSeats = useExtraSeats();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  // Fetch members
  const { data: members = [] } = useQuery<TeamMember[]>({
    queryKey: ["team_members", currentCompany?.id],
    queryFn: async () => {
      // Fetch members
      const { data: uc, error: ucErr } = await supabase
        .from("user_companies")
        .select("id, user_id, role, created_at")
        .eq("company_id", currentCompany!.id);
      if (ucErr) throw ucErr;
      if (!uc || uc.length === 0) return [];

      // Fetch profiles for those user_ids
      const userIds = uc.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return uc.map((m) => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
      }));
    },
    enabled: !!currentCompany?.id,
  });

  // Determine if current user is owner
  const currentUserMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = currentUserMembership?.role === "owner";

  const handleRoleChange = async (membershipId: string, memberId: string, newRole: string) => {
    if (!currentCompany || memberId === user?.id) return;
    setChangingRole(membershipId);
    try {
      const { error } = await supabase
        .from("user_companies")
        .update({ role: newRole })
        .eq("id", membershipId);
      if (error) throw error;
      toast({ title: "Role updated", description: `Member role changed to ${newRole}.` });
      queryClient.invalidateQueries({ queryKey: ["team_members", currentCompany.id] });
    } catch (err: any) {
      console.error("[settings:role-change]", err);
      toast({ title: "Error", description: "Failed to update role. Only owners can change roles.", variant: "destructive" });
    } finally {
      setChangingRole(null);
    }
  };


  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ["invitations", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, invitee_email, role, invite_code, expires_at, accepted_at")
        .eq("company_id", currentCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("invitations").insert({
        company_id: currentCompany.id,
        invitee_email: email.trim().toLowerCase(),
        role,
        invited_by: user.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already invited", description: "This email has already been invited.", variant: "destructive" });
        } else throw error;
      } else {
        toast({ title: "Invitation created", description: `Invite sent to ${email.trim()}.` });
        setEmail("");
        setRole("member");
        queryClient.invalidateQueries({ queryKey: ["invitations", currentCompany.id] });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("invitations").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["invitations", currentCompany?.id] });
    toast({ title: "Invitation revoked" });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied" });
  };

  const pending = invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());
  const seatLimit = FREE_MEMBER_LIMIT + extraSeats;
  const totalSeats = members.length + pending.length;
  const atLimit = totalSeats >= seatLimit;

  return (
    <div className="space-y-6">
      {/* Free plan banner */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            <strong className="text-foreground">{totalSeats}</strong> / {seatLimit} seats used
          </span>
          <Badge variant="secondary" className="text-[10px]">Free Plan</Badge>
          {extraSeats > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Coffee className="w-3 h-3" /> +{extraSeats} extra
            </Badge>
          )}
        </div>
        {atLimit && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/billing")}>
              <Coffee className="w-3.5 h-3.5" /> Buy Seat — $5
            </Button>
            <Button size="sm" variant="default" className="gap-1.5" onClick={() => navigate("/billing")}>
              <Crown className="w-3.5 h-3.5" /> Upgrade
            </Button>
          </div>
        )}
      </div>

      {/* Current Members */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Team Members
          </CardTitle>
          <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const isCurrentUser = m.user_id === user?.id;
              const name = m.profile?.display_name || (isCurrentUser ? user?.email : "Team Member");
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/30"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    m.role === "owner" ? "bg-primary/15" : "bg-accent"
                  )}>
                    {m.role === "owner"
                      ? <Shield className="w-5 h-5 text-primary" />
                      : <User className="w-5 h-5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {name} {isCurrentUser && <span className="text-muted-foreground">(you)</span>}
                    </p>
                  </div>
                  {isOwner && !isCurrentUser ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={pendingRoles[m.id] ?? m.role}
                        onValueChange={(val) => setPendingRoles((prev) => ({ ...prev, [m.id]: val }))}
                        disabled={changingRole === m.id}
                      >
                        <SelectTrigger className="w-28 h-8 text-[11px]">
                          {changingRole === m.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {pendingRoles[m.id] && pendingRoles[m.id] !== m.role && (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1"
                          disabled={changingRole === m.id}
                          onClick={() => {
                            handleRoleChange(m.id, m.user_id, pendingRoles[m.id]);
                            setPendingRoles((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
                          }}
                        >
                          {changingRole === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Update
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant={m.role === "owner" ? "default" : "secondary"}
                      className="text-[10px] capitalize"
                    >
                      {m.role}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite */}
      {atLimit ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Team limit reached</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your plan supports up to {seatLimit} team members. Buy an extra seat or upgrade.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" onClick={() => navigate("/billing")} className="gap-1.5">
                <Coffee className="w-4 h-4" /> Buy Extra Seat — $5
              </Button>
              <Button onClick={() => navigate("/billing")} className="gap-1.5">
                <Crown className="w-4 h-4" /> Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Invite Member
            </CardTitle>
            <CardDescription>Send an invite code to a new team member.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={sending} className="gap-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Invite
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {pending.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.invitee_email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{inv.role}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Expires {format(new Date(inv.expires_at), "MMM d")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => copyCode(inv.invite_code)}
                      title="Copy invite code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRevoke(inv.id)}
                      title="Revoke"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Settings Page ──────────────────────────────────────────────────
export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "company";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6 h-auto p-1 flex flex-nowrap overflow-x-auto scrollbar-hide gap-1 justify-start w-full">
          <TabsTrigger value="company" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Company
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Locations
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="w-3.5 h-3.5" /> Team
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5">
            <Plug className="w-3.5 h-3.5" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="data-intake" className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Data Intake
          </TabsTrigger>
          <TabsTrigger value="exports" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Exports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <CompanyDetailsTab />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsContent embedded />
        </TabsContent>
        <TabsContent value="data-intake">
          <DataIntakeContent embedded />
        </TabsContent>
        <TabsContent value="exports">
          <ExportsContent embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
