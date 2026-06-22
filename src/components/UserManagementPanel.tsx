import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, Shield, UserRound, Users2, RefreshCw, KeyRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ProfileRow = Profile & { id: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  rejected: "Rejected",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  rep: "Sales Rep",
  accountant: "Accountant",
};

export function UserManagementPanel() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  async function loadData() {
    setLoading(true);
    const [{ data: profiles }, { data: config }] = await Promise.all([
      supabase.from("profiles").select("*")
        .eq("company_id", myProfile?.company_id ?? "")
        .eq("is_superadmin", false)
        .order("created_at", { ascending: true }),
      supabase.from("company_config").select("invite_code").single(),
    ]);
    setUsers((profiles as ProfileRow[]) ?? []);
    setInviteCode(config?.invite_code ?? "");
    setNewCode(config?.invite_code ?? "");
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function approve(userId: string, role: string) {
    if (!role) { toast.error("Select a role first"); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active", role: role as any })
      .eq("id", userId);
    if (error) { toast.error("Failed to approve user"); return; }
    toast.success("User approved");
    loadData();
  }

  async function reject(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" })
      .eq("id", userId);
    if (error) { toast.error("Failed to reject user"); return; }
    toast.success("User rejected");
    loadData();
  }

  async function changeRole(userId: string, role: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: role as any })
      .eq("id", userId);
    if (error) { toast.error("Failed to update role"); return; }
    toast.success("Role updated");
    loadData();
  }

  async function saveInviteCode() {
    if (!newCode.trim()) { toast.error("Code cannot be empty"); return; }
    setSavingCode(true);
    const { error } = await supabase
      .from("company_config")
      .update({ invite_code: newCode.trim().toUpperCase() })
      .eq("id", 1);
    setSavingCode(false);
    if (error) { toast.error("Failed to update invite code"); return; }
    setInviteCode(newCode.trim().toUpperCase());
    setNewCode(newCode.trim().toUpperCase());
    toast.success("Invite code updated");
  }

  const pending = users.filter((u) => u.status === "pending");
  const active = users.filter((u) => u.status === "active");
  const rejected = users.filter((u) => u.status === "rejected");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Code */}
      <Card className="p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Company Registration Code</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Share this code with people who need to create an account. You can change it at any time.
        </p>
        <div className="flex gap-2">
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            className="uppercase tracking-widest font-mono max-w-[220px]"
            placeholder="COMPANY2024"
          />
          <Button onClick={saveInviteCode} disabled={savingCode || newCode === inviteCode} size="sm">
            {savingCode ? "Saving…" : "Save code"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Current code: <span className="font-mono font-semibold">{inviteCode}</span>
        </p>
      </Card>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm">Pending Approval ({pending.length})</h3>
          </div>
          <div className="space-y-3">
            {pending.map((u) => (
              <PendingUserRow key={u.id} user={u} myId={myProfile?.id ?? ""} onApprove={approve} onReject={reject} />
            ))}
          </div>
        </div>
      )}

      {/* Active users */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users2 className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Active Users ({active.length})</h3>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active users yet.</p>
        ) : (
          <div className="space-y-2">
            {active.map((u) => (
              <ActiveUserRow key={u.id} user={u} myId={myProfile?.id ?? ""} onRoleChange={changeRole} />
            ))}
          </div>
        )}
      </div>

      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold text-sm">Rejected ({rejected.length})</h3>
          </div>
          <div className="space-y-2">
            {rejected.map((u) => (
              <Card key={u.id} className="p-4 border border-border opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{u.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => approve(u.id, "rep")}>
                    Re-activate as Rep
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingUserRow({
  user, myId, onApprove, onReject,
}: { user: ProfileRow; myId: string; onApprove: (id: string, role: string) => void; onReject: (id: string) => void }) {
  const [role, setRole] = useState<string>("");
  const joinedAt = new Date(user.created_at).toLocaleDateString();

  return (
    <Card className="p-4 border border-amber-200 bg-amber-50/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium">{user.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{user.email} · Registered {joinedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Assign role…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="rep">Sales Rep</SelectItem>
              <SelectItem value="accountant">Accountant</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="bg-success text-success-foreground hover:bg-success/90 gap-1"
            onClick={() => onApprove(user.id, role)}
            disabled={!role}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            onClick={() => onReject(user.id)}
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ActiveUserRow({
  user, myId, onRoleChange,
}: { user: ProfileRow; myId: string; onRoleChange: (id: string, role: string) => void }) {
  const isMe = user.id === myId;
  const roleIcon = user.role === "admin"
    ? <Shield className="w-3.5 h-3.5 text-accent" />
    : <UserRound className="w-3.5 h-3.5 text-muted-foreground" />;

  return (
    <Card className="p-3.5 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            {roleIcon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{user.full_name ?? "—"}</p>
              {isMe && <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded font-medium">You</span>}
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize text-xs">
            {ROLE_LABELS[user.role ?? ""] ?? user.role ?? "No role"}
          </Badge>
          {!isMe && (
            <Select value={user.role ?? ""} onValueChange={(v) => onRoleChange(user.id, v)}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Change role…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="rep">Sales Rep</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    </Card>
  );
}
