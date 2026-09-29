"use client";

import { FormEvent, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  function handleClose() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }
  
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get("token") || searchParams.get("code") || "";
    const urlEmail = searchParams.get("email") || "";
    if (urlToken) setToken(urlToken);
    if (urlEmail) setEmail(urlEmail);
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, string> = {
        new_password: newPassword,
        password: newPassword,
        confirm_password: confirmPassword,
        confirm_new_password: confirmPassword,
      };

      if (email.trim()) payload.email = email.trim();
      if (token.trim()) payload.token = token.trim();
      if (oldPassword) {
        payload.old_password = oldPassword;
        payload.current_password = oldPassword;
      }

      const response = await fetch("/api/backend/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const formattedDetail = Array.isArray(result?.detail)
          ? result.detail
              .map((item: { msg: string; loc?: (string | number)[] }) => {
                const field = item.loc && item.loc.length > 0 ? item.loc[item.loc.length - 1] : "";
                return field ? `${field}: ${item.msg}` : item.msg;
              })
              .join("; ")
          : typeof result?.detail === "string"
          ? result.detail
          : null;

        const errorMsg =
          formattedDetail ||
          result?.message ||
          "Failed to reset password. Please check your credentials and try again.";
        throw new Error(errorMsg);
      }

      const msg = result?.message || "Password updated successfully!";
      setSuccess(msg);
      toast.success(msg);

      // Clear sensitive fields
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      window.location.replace("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reset Password</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Update your account password below to keep your account secure.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
          onClick={handleClose}
          aria-label="Close"
          title="Close reset password form"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500/50 text-green-700 dark:text-green-400 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2 inline" />
          <AlertDescription className="inline">{success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
        />
      </div>

      {token ? (
        <div className="space-y-2">
          <Label htmlFor="token">Reset Token</Label>
          <Input
            id="token"
            name="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Reset token"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="old_password">Current / Old Password</Label>
        <div className="relative">
          <Input
            id="old_password"
            name="old_password"
            type={showOldPassword ? "text" : "password"}
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Enter your current password (if required)"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowOldPassword(!showOldPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new_password">New Password</Label>
        <div className="relative">
          <Input
            id="new_password"
            name="new_password"
            type={showNewPassword ? "text" : "password"}
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm New Password</Label>
        <div className="relative">
          <Input
            id="confirm_password"
            name="confirm_password"
            type={showConfirmPassword ? "text" : "password"}
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isSubmitting}
          className="w-1/2"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-1/2 gap-2">
          {isSubmitting ? (
            "Updating Password..."
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              <span>Reset Password</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Loading form...</div>}>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
