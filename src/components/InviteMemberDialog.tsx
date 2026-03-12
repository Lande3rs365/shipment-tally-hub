import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Copy, Loader2, Mail, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const ROLES = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

interface Invitation {
  id: string;
  invitee_email: string;
  role: string;
  invite_code: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export default function InviteMemberDialog() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [sending, setSending] = useState(false);

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["invitations", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && open,
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setSending(true);
    try {
      const { error } = await supabase.from("invitations").insert({
        company_id: currentCompany.id,
        invitee_email: trimmedEmail,
        role,
        invited_by: user.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already invited", description: "This email has already been invited to this company.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Invitation created", description: `Invite sent to ${trimmedEmail}. Share the invite code with them.` });
        setEmail("");
        setRole("member");
        queryClient.invalidateQueries({ queryKey: ["invitations", currentCompany.id] });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create invitation.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await supabase.from("invitations").delete().eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["invitations", currentCompany?.id] });
      toast({ title: "Invitation revoked" });
    } catch {
      toast({ title: "Error", description: "Failed to revoke invitation.", variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied", description: "Invite code copied to clipboard." });
  };

  const pending = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date());
  const expired = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) <= new Date());
  const accepted = invitations.filter(i => !!i.accepted_at);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Team Members</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={sending} className="w-full gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invitation
          </Button>
        </form>

        {/* Pending invitations */}
        {pending.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground">Pending Invitations</h4>
            {pending.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{inv.invitee_email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">{inv.role}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Expires {format(new Date(inv.expires_at), "MMM d")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
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
        )}

        {/* Accepted */}
        {accepted.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground">Accepted</h4>
            {accepted.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <p className="text-sm truncate flex-1 text-foreground">{inv.invitee_email}</p>
                <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">Accepted</Badge>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
