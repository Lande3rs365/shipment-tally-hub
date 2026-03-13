import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useStockLocations } from "@/hooks/useSupabaseData";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, MapPin, Users, Save, Loader2, Plus, Trash2, Copy,
  Mail, UserPlus, X, Crown, Lock, Upload, FileText, Plug, Shield, User,
  Bot, Sparkles, MessageSquare, Bell, Search, Zap, Clock, CheckCircle2,
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
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch extra fields on mount
  useState(() => {
    if (!currentCompany || loaded) return;
    supabase
      .from("companies")
      .select("email, phone, address")
      .eq("id", currentCompany.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setCompanyEmail(data.email || "");
          setCompanyPhone(data.phone || "");
          setCompanyAddress(data.address || "");
        }
        setLoaded(true);
      });
  });

  const handleSave = async () => {
    if (!currentCompany) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        email: companyEmail.trim() || null,
        phone: companyPhone.trim() || null,
        address: companyAddress.trim() || null,
      })
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
        <CardDescription>Update your company information.</CardDescription>
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
        <div className="space-y-2">
          <Label htmlFor="companyEmail">Email</Label>
          <Input
            id="companyEmail"
            type="email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            placeholder="info@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyPhone">Phone number</Label>
          <Input
            id="companyPhone"
            type="tel"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            placeholder="e.g. +61 2 1234 5678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyAddress">Address</Label>
          <Textarea
            id="companyAddress"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="Street address, city, state, postcode"
            rows={3}
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
const LOCATION_TYPES = [
  { value: "warehouse", label: "Warehouse" },
  { value: "head_office", label: "Head Office" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "dealership", label: "Dealership" },
  { value: "3rd_party", label: "3rd Party" },
  { value: "other", label: "Other" },
];

function LocationsTab() {
  const { currentCompany } = useCompany();
  const { data: locations = [], isLoading } = useStockLocations();
  const queryClient = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("warehouse");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = async () => {
    if (!currentCompany || !newName.trim() || !newCode.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("stock_locations").insert({
      company_id: currentCompany.id,
      name: newName.trim(),
      code: newCode.trim().toUpperCase(),
      location_type: newType,
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      address: newAddress.trim() || null,
    });
    setAdding(false);
    if (error) {
      console.error("[settings:location-add]", error);
      toast({ title: "Error", description: "Failed to add location. Please try again.", variant: "destructive" });
    } else {
      toast({ title: "Location added" });
      setNewName(""); setNewCode(""); setNewType("warehouse");
      setNewEmail(""); setNewPhone(""); setNewAddress("");
      queryClient.invalidateQueries({ queryKey: ["stock_locations"] });
    }
  };

  const startEdit = async (loc: StockLocation) => {
    // Fetch full details including new fields
    const { data } = await supabase
      .from("stock_locations")
      .select("name, code, location_type, email, phone, address")
      .eq("id", loc.id)
      .single();
    setEditFields(data || { name: loc.name, code: loc.code, location_type: loc.location_type });
    setEditingId(loc.id);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("stock_locations")
      .update({
        name: editFields.name?.trim(),
        code: editFields.code?.trim().toUpperCase(),
        location_type: editFields.location_type,
        email: editFields.email?.trim() || null,
        phone: editFields.phone?.trim() || null,
        address: editFields.address?.trim() || null,
      })
      .eq("id", editingId);
    setSavingEdit(false);
    if (error) {
      console.error("[settings:location-edit]", error);
      toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
    } else {
      toast({ title: "Location updated" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["stock_locations"] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("stock_locations")
      .delete()
      .eq("id", id);
    if (error) {
      // If referenced, fall back to deactivate
      const { error: deactivateErr } = await supabase
        .from("stock_locations")
        .update({ is_active: false })
        .eq("id", id);
      if (deactivateErr) {
        toast({ title: "Error", description: "Failed to remove location.", variant: "destructive" });
      } else {
        toast({ title: "Location deactivated", description: "Location is in use and was deactivated instead of deleted." });
      }
    } else {
      toast({ title: "Location removed" });
    }
    setDeleteConfirm(null);
    queryClient.invalidateQueries({ queryKey: ["stock_locations"] });
  };

  return (
    <>
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
                <div key={loc.id}>
                  {editingId === loc.id ? (
                    <div className="p-4 rounded-lg border border-primary/30 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input value={editFields.name || ""} onChange={(e) => setEditFields({ ...editFields, name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Code</Label>
                          <Input value={editFields.code || ""} onChange={(e) => setEditFields({ ...editFields, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} maxLength={15} className="font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={editFields.location_type || "warehouse"} onValueChange={(v) => setEditFields({ ...editFields, location_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LOCATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Email</Label>
                          <Input type="email" value={editFields.email || ""} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} placeholder="location@company.com" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Phone</Label>
                          <Input type="tel" value={editFields.phone || ""} onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })} placeholder="+61 400 000 000" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Textarea value={editFields.address || ""} onChange={(e) => setEditFields({ ...editFields, address: e.target.value })} placeholder="Street, city, state, postcode" rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEdit(loc)}>
                        <p className="text-sm font-medium text-foreground">{loc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">{loc.code}</span>
                          <Badge variant="secondary" className="text-[10px]">{loc.location_type}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => startEdit(loc)} title="Edit location">
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteConfirm({ id: loc.id, name: loc.name })} title="Remove location">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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
                <Input placeholder="e.g. Main Warehouse" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input placeholder="e.g. WH-01" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} maxLength={15} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" placeholder="location@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input type="tel" placeholder="+61 400 000 000" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Address</Label>
              <Textarea placeholder="Street, city, state, postcode" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newName.trim() || !newCode.trim()} size="sm">
              {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Add Location
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteConfirm?.name}</strong>? If the location has inventory records it will be deactivated instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  const [ownerConfirm, setOwnerConfirm] = useState<{ membershipId: string; userId: string; name: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ membershipId: string; name: string } | null>(null);

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


  const handleRemoveMember = async (membershipId: string) => {
    if (!currentCompany) return;
    try {
      const { error } = await supabase
        .from("user_companies")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["team_members", currentCompany.id] });
    } catch (err: any) {
      console.error("[settings:remove-member]", err);
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    }
    setRemoveConfirm(null);
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
                            const newRole = pendingRoles[m.id];
                            if (newRole === "owner") {
                              setOwnerConfirm({ membershipId: m.id, userId: m.user_id, name: name as string });
                            } else {
                              handleRoleChange(m.id, m.user_id, newRole);
                              setPendingRoles((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
                            }
                          }}
                        >
                          {changingRole === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Update
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setRemoveConfirm({ membershipId: m.id, name: name as string })}
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

      {/* Owner promotion confirmation */}
      <AlertDialog open={!!ownerConfirm} onOpenChange={(open) => !open && setOwnerConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Owner?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to grant <strong>{ownerConfirm?.name}</strong> full Owner access. Owners have unrestricted administrative control including the ability to manage all team members, settings, and integrations. This action can only be reversed by another owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (ownerConfirm) {
                  handleRoleChange(ownerConfirm.membershipId, ownerConfirm.userId, "owner");
                  setPendingRoles((prev) => { const n = { ...prev }; delete n[ownerConfirm.membershipId]; return n; });
                }
                setOwnerConfirm(null);
              }}
            >
              Confirm Promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeConfirm?.name}</strong> from this company? They will lose all access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeConfirm && handleRemoveMember(removeConfirm.membershipId)}>
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── AI Agent Coming Soon ───────────────────────────────────────────
function AIAgentComingSoon() {
  const coreFeatures = [
    { icon: Bell, title: "Auto Customer Updates", desc: "Proactive dispatch & delivery notifications — customers stop asking 'where's my order?'" },
    { icon: Search, title: "Tracking Chase", desc: "Automatically chases missing tracking numbers from carriers and distributors until resolved" },
    { icon: MessageSquare, title: "Inbox Monitoring", desc: "Monitors dedicated distribution & customer support emails, plus Tawk.to & Zendesk — reads, classifies, and routes automatically" },
    { icon: Zap, title: "Order Matching", desc: "Matches incoming responses to the right orders and updates records instantly — zero manual work" },
    { icon: Clock, title: "EOD Team Briefings", desc: "End-of-day summaries straight to WhatsApp — orders shipped, exceptions raised, stock alerts" },
    { icon: CheckCircle2, title: "Full Audit Trail", desc: "Every action logged, every message traceable — complete operational visibility" },
  ];

  const PHASES = [
    {
      phase: "Phase 1",
      label: "Zero Manual Order Chasing",
      hook: "I need this today",
      status: "Building Now",
      items: [
        { name: "Shopify + WooCommerce Sync", desc: "All your sales channels feeding orders into one place — no more copy-pasting between platforms" },
        { name: "EasyPost Unified Tracking", desc: "Live tracking webhooks for 100+ carriers — you'll never manually chase a tracking number again" },
        { name: "Auto Customer Notifications", desc: "Dispatch & delivery emails sent automatically — kill 'where is my order?' forever" },
        { name: "Low Stock Alerts", desc: "Get warned before you run out — not after orders start failing" },
      ],
    },
    {
      phase: "Phase 2",
      label: "Everything in One Place",
      hook: "This saves me a day a week",
      status: "Next Up",
      items: [
        { name: "eBay + Amazon + TikTok Shop", desc: "Consolidate marketplace orders with automatic fulfilment sync" },
        { name: "Carrier Tracking Chase", desc: "Agent follows up with carriers on missing tracking — persistent, polite, relentless" },
        { name: "Customer Chase Automation", desc: "Auto-follow-up on unresolved queries, returns, and payment issues" },
        { name: "WhatsApp COB Summary", desc: "Daily team briefing — what shipped, what's stuck, what needs attention tomorrow" },
      ],
    },
    {
      phase: "Phase 3",
      label: "The Back Office Sorts Itself",
      hook: "I'm running a proper business now",
      status: "Planned",
      items: [
        { name: "Xero / QuickBooks / MYOB", desc: "Invoices, payments, and reconciliation sync automatically — your numbers finally match" },
        { name: "Klaviyo / Mailchimp", desc: "Trigger marketing flows from dispatch & delivery events" },
        { name: "Tawk.to / Zendesk Matching", desc: "Support tickets auto-matched to orders, responses logged" },
        { name: "Shipping@ Inbox Monitoring", desc: "Dedicated email account monitoring — distribution and support, organised and actioned" },
      ],
    },
    {
      phase: "Phase 4",
      label: "AI Does the Thinking",
      hook: "I'm ready to scale",
      status: "Planned",
      items: [
        { name: "Full AI Agent", desc: "Chasing, drafting, summarising — Claude-powered operations assistant" },
        { name: "Google Drive Auto-Import", desc: "Drop files in a folder, agent imports via existing pipeline — no manual upload" },
        { name: "PayPal / Afterpay Reconciliation", desc: "Payment status matched against orders automatically" },
        { name: "Etsy + Emerging Channels", desc: "New sales channels plugged in as you grow" },
        { name: "Slack / Telegram / Trello", desc: "Exception cards, urgent alerts, and team channel summaries" },
      ],
    },
  ];

  const phaseColors: Record<string, string> = {
    "Building Now": "bg-primary/15 text-primary border-primary/25",
    "Next Up": "bg-accent/50 text-accent-foreground border-accent/30",
    "Planned": "bg-muted text-muted-foreground border-border",
  };

  const phaseEmoji: Record<string, string> = {
    "Building Now": "🔥",
    "Next Up": "⚡",
    "Planned": "🗺️",
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-8 sm:p-12">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/20 gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3 h-3" /> Coming Soon
            </Badge>
          </div>

          <div className="space-y-4 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              FulfillMate AI Agent
            </h2>
            <p className="text-base sm:text-lg text-primary font-semibold leading-snug">
              Connects all your sales channels, automatically updates customers with tracking, and chases the ones you'd forget — so you stop living in your inbox.
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-foreground">
                <span className="font-semibold">On average, beta users cut customer service emails by 60%</span>
                <span className="text-muted-foreground"> in the first week.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Core feature grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Core Capabilities</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((f) => (
            <Card key={f.title} className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors group">
              <CardHeader className="pb-2">
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Roadmap phases */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Integration Roadmap</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHASES.map((phase) => (
            <Card key={phase.phase} className="bg-card border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{phase.phase}</p>
                    <CardTitle className="text-sm font-semibold mt-0.5">{phase.label}</CardTitle>
                    <p className="text-xs text-muted-foreground italic mt-0.5">"{phase.hook}"</p>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold", phaseColors[phase.status])}>
                    {phaseEmoji[phase.status]} {phase.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2.5">
                  {phase.items.map((item) => (
                    <div key={item.name} className="flex gap-2.5">
                      <div className="w-1 rounded-full bg-primary/20 shrink-0 mt-1" style={{ minHeight: 24 }} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <Card className="border-dashed border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-foreground">Want early access?</p>
            <p className="text-xs text-muted-foreground">We'll notify you as soon as the AI Agent is ready for your account.</p>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Notify Me
          </Button>
        </CardContent>
      </Card>
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
          <TabsTrigger value="ai-agent" className="gap-1.5 relative">
            <Bot className="w-3.5 h-3.5" /> AI Agent
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
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
        <TabsContent value="ai-agent">
          <AIAgentComingSoon />
        </TabsContent>
      </Tabs>
    </div>
  );
}
