import { useState, useEffect } from "react";
import { Shield, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { useT } from "@/lib/i18n";

interface AdminGateProps {
  open: boolean;
  onClose: () => void;
}

export function AdminGate({ open, onClose }: AdminGateProps) {
  const t = useT();
  const { profile } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setPassword("");
      setError(null);
      setShowPass(false);
    }
  }, [open]);

  async function verify() {
    if (!profile?.email || !password) return;
    setVerifying(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    setVerifying(false);
    if (authError) {
      setError(t("ag_wrong"));
      setPassword("");
      return;
    }
    setUnlocked(true);
    setPassword("");
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <SheetTitle className="text-lg">{t("ag_title")}</SheetTitle>
            {unlocked && (
              <button
                onClick={() => { setUnlocked(false); setPassword(""); }}
                className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                {t("ag_lock")}
              </button>
            )}
          </div>
        </SheetHeader>

        {!unlocked ? (
          <div className="flex flex-col items-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("ag_restricted")}</h3>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-xs">
              {t("ag_desc")}
            </p>

            {error && (
              <div className="mb-4 flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm w-full max-w-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="space-y-3 w-full max-w-xs">
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">{t("ag_password")}</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPass ? "text" : "password"}
                    placeholder={t("ag_password_placeholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verify()}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                className="w-full bg-gradient-primary text-white shadow-elegant hover:opacity-90"
                onClick={verify}
                disabled={verifying || !password}
              >
                {verifying ? t("ag_verifying") : t("ag_enter")}
              </Button>
            </div>
          </div>
        ) : (
          <UserManagementPanel />
        )}
      </SheetContent>
    </Sheet>
  );
}
