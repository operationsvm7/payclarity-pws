import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Eye, EyeOff, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setPendingUser(false);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      return;
    }

    // Check profile status and role after successful login
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, role")
        .eq("id", user.id)
        .single();

      if (profile?.status === "rejected") {
        await supabase.auth.signOut();
        setServerError("Your account has been rejected. Contact your administrator.");
        return;
      }
      // Block if not fully approved (pending, no role, or any non-active status)
      if (!profile || profile.status !== "active" || !profile.role) {
        await supabase.auth.signOut();
        setPendingUser(true);
        return;
      }
    }

    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-primary shadow-elegant mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">PayClarity</h1>
          <p className="text-sm text-muted-foreground mt-1">Commission management platform</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          {pendingUser && (
            <div className="mb-5 flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <Clock className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Account pending approval</p>
                <p className="text-sm mt-0.5 text-amber-700">
                  Your account is waiting for an administrator to approve it. You will be notified once access is granted.
                </p>
              </div>
            </div>
          )}

          {serverError && !pendingUser && (
            <div className="mb-5 flex gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register("email")}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register("password")}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
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
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-6 bg-gradient-primary text-white shadow-elegant hover:opacity-90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-accent font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} PayClarity. All rights reserved.
        </p>
      </div>
    </div>
  );
}
