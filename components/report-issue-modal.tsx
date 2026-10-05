"use client";

import { useState, useEffect, useId, FormEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bug,
  Lightbulb,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Code2,
  Server,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QuillIssueEditor, isQuillEmpty } from "@/components/quill-issue-editor";

export type ReportIssueModalProps = {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
  organizationName?: string;
};

type CreatedIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  repository: string;
};

type RepoConfigStatus = {
  hasToken: boolean;
  repositories: {
    frontend: string | null;
    backend: string | null;
  };
  configured: boolean;
};

export default function ReportIssueModal({
  isOpen,
  onClose,
  userRole,
  userName,
  organizationName,
}: ReportIssueModalProps) {
  const pathname = usePathname();
  const titleInputId = useId();
  const descInputId = useId();

  const isSuperAdmin = userRole === "0";
  const [mounted, setMounted] = useState(false);
  const [repository, setRepository] = useState<"frontend" | "backend">("frontend");
  const [issueType, setIssueType] = useState<"bug" | "enhancement" | "question">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CreatedIssue | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepoConfigStatus | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch configured repos status
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      fetch("/api/issues")
        .then((res) => res.json())
        .then((data: RepoConfigStatus) => {
          setRepoConfig(data);
          if (!isSuperAdmin) {
            setRepository("frontend");
          } else if (!data.repositories.frontend && data.repositories.backend) {
            setRepository("backend");
          }
        })
        .catch(() => null);
    }
  }, [isOpen, isSuperAdmin]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleResetAndClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting]);

  function handleResetAndClose() {
    setTitle("");
    setDescription("");
    setErrorMessage(null);
    setCreatedIssue(null);
    onClose();
  }

  function handleCreateAnother() {
    setTitle("");
    setDescription("");
    setErrorMessage(null);
    setCreatedIssue(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter an issue title.");
      return;
    }
    if (isQuillEmpty(description)) {
      toast.error("Please enter an issue description.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const roleName =
      userRole === "0"
        ? "Super Admin"
        : userRole === "1"
        ? "Admin"
        : userRole === "2"
        ? "Teacher"
        : userRole === "3"
        ? "Student"
        : "Guest/User";

    const payload = {
      repository,
      issueType,
      title: title.trim(),
      description: description.trim(),
      diagnostics: {
        pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
        role: roleName,
        userName: userName || "Anonymous",
        organizationName: organizationName || "Default",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        screen:
          typeof window !== "undefined"
            ? `${window.innerWidth}x${window.innerHeight}`
            : undefined,
      },
    };

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create issue.");
      }

      setCreatedIssue(data.issue);
      toast.success(`GitHub issue #${data.issue.number} created successfully!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred while creating issue.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleResetAndClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-card text-card-foreground border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
              <GithubIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="issue-modal-title" className="text-lg font-bold tracking-tight text-foreground">
                  Report GitHub Issue
                </h2>
                <Badge variant="outline" className="text-[11px] font-medium hidden sm:inline-flex">
                  Direct Integration
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Submit bugs, feedback, or tasks directly to your GitHub repository.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            disabled={isSubmitting}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {createdIssue ? (
            /* Success State */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center ring-8 ring-emerald-500/5 shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">Issue Published!</h3>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                  Your issue has been recorded on GitHub as{" "}
                  <span className="font-semibold text-foreground">#{createdIssue.number}</span>
                  {isSuperAdmin && (
                    <>
                      {" "}in{" "}
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">
                        {createdIssue.repository}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-muted/30 text-left shadow-xs">
                <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Issue Title
                </div>
                <div className="font-medium text-sm text-foreground">
                  {createdIssue.title}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  render={
                    <a
                      href={createdIssue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    />
                  }
                  nativeButton={false}
                  className="w-full sm:w-auto shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open on GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateAnother}
                  className="w-full sm:w-auto"
                >
                  Create Another Issue
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetAndClose}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* Issue Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-start gap-3 animate-in fade-in-50">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs sm:text-sm leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Target Repository Selection - Only visible to Super Admin */}
              {isSuperAdmin && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      Target Repository
                      <span className="text-destructive">*</span>
                    </Label>
                    <Link
                      href="/super-admin/issues"
                      onClick={handleResetAndClose}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Manage All Issues
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRepository("frontend")}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        repository === "frontend"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border/80 hover:bg-muted/40 hover:border-border"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                          repository === "frontend"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground flex items-center justify-between">
                          <span>Frontend Repo</span>
                          {repository === "frontend" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          UI, React components & pages
                        </p>
                        <div className="text-[11px] font-mono text-muted-foreground/80 truncate mt-1">
                          {repoConfig?.repositories.frontend || "GITHUB_FRONTEND_REPO"}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRepository("backend")}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        repository === "backend"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border/80 hover:bg-muted/40 hover:border-border"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                          repository === "backend"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground flex items-center justify-between">
                          <span>Backend Repo</span>
                          {repository === "backend" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                              Selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          FastAPI routes, controllers & database
                        </p>
                        <div className="text-[11px] font-mono text-muted-foreground/80 truncate mt-1">
                          {repoConfig?.repositories.backend || "GITHUB_BACKEND_REPO"}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Issue Type */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Issue Type
                </Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueType("bug")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      issueType === "bug"
                        ? "bg-destructive/10 text-destructive border-destructive/40 font-semibold shadow-xs"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    Bug Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("enhancement")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      issueType === "enhancement"
                        ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-xs"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    Feature Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("question")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      issueType === "question"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold shadow-xs"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/70"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Question / Inquiry
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor={titleInputId} className="text-sm font-semibold text-foreground">
                  Issue Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={titleInputId}
                  required
                  autoFocus
                  placeholder={
                    issueType === "bug"
                      ? "e.g. Error when saving student batches"
                      : issueType === "enhancement"
                      ? "e.g. Add export to PDF button for test results"
                      : "e.g. Question about test series scheduling"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor={descInputId} className="text-sm font-semibold text-foreground">
                  Description <span className="text-destructive">*</span>
                </Label>
                <QuillIssueEditor
                  value={description}
                  onChange={setDescription}
                  placeholder={
                    issueType === "bug"
                      ? "Describe what happened, steps to reproduce, or paste/upload screenshots..."
                      : "Describe the proposed feature and why it is useful..."
                  }
                  disabled={isSubmitting}
                  repository={repository}
                  minHeight="140px"
                  maxHeight="220px"
                />
              </div>

              {/* Diagnostics Notice */}
              <div className="flex items-center gap-2.5 select-none pt-1">
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  aria-label="System diagnostics automatically included"
                  className="h-4 w-4 rounded accent-primary cursor-not-allowed opacity-90"
                />
                <span className="text-xs text-muted-foreground">
                  System diagnostics (page:{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">
                    {pathname}
                  </code>
                  , user role, and browser info) are automatically included.
                </span>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetAndClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[140px] shadow-sm">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <GithubIcon className="w-4 h-4 mr-2" />
                      Submit to GitHub
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
