"use client";

import { useState, useEffect, useId, FormEvent } from "react";
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
  Code2,
  Server,
  Info,
  ArrowLeft,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { QuillIssueEditor, isQuillEmpty } from "@/components/quill-issue-editor";

type ReportIssueFormProps = {
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

export default function ReportIssueForm({
  userRole,
  userName,
  organizationName,
}: ReportIssueFormProps) {
  const isSuperAdmin = userRole === "0";
  const pathname = usePathname();
  const repoSelectId = useId();
  const typeSelectId = useId();
  const titleInputId = useId();
  const descInputId = useId();

  const [repository, setRepository] = useState<"frontend" | "backend">("frontend");
  const [issueType, setIssueType] = useState<"bug" | "enhancement" | "question">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CreatedIssue | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepoConfigStatus | null>(null);

  useEffect(() => {
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
  }, [isSuperAdmin]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/dashboard" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GithubIcon className="w-7 h-7 text-primary" />
            Report an Issue to GitHub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create bug reports, feature requests, or tasks directly in the team&apos;s GitHub repository.
          </p>
        </div>
      </div>

      {createdIssue ? (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-8 pb-8 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Issue Published!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Your issue has been created as{" "}
                <span className="font-semibold text-foreground">#{createdIssue.number}</span>
                {isSuperAdmin && (
                  <>
                    {" "}in{" "}
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {createdIssue.repository}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card text-left shadow-xs">
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                Issue Title
              </div>
              <div className="font-medium text-foreground">{createdIssue.title}</div>
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
                className="w-full sm:w-auto"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreateAnother}
                className="w-full sm:w-auto"
              >
                Create Another Issue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Issue Details</CardTitle>
            <CardDescription>
              Select the affected repository and describe the problem or request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Target Repository Selection - Only visible to Super Admin */}
              {isSuperAdmin && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={repoSelectId} className="text-sm font-semibold">
                      Target Repository <span className="text-destructive">*</span>
                    </Label>
                    <Link
                      href="/super-admin/issues"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Manage All Issues →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRepository("frontend")}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        repository === "frontend"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          repository === "frontend"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          Frontend Repository
                          {repository === "frontend" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          UI, React components, client pages, state
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground/80 mt-1 truncate">
                          {repoConfig?.repositories.frontend || "GITHUB_FRONTEND_REPO"}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRepository("backend")}
                      className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                        repository === "backend"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          repository === "backend"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Server className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          Backend Repository
                          {repository === "backend" && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          FastAPI routes, controllers, database models
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground/80 mt-1 truncate">
                          {repoConfig?.repositories.backend || "GITHUB_BACKEND_REPO"}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Issue Type */}
              <div className="space-y-2">
                <Label htmlFor={typeSelectId} className="text-sm font-semibold">
                  Issue Classification
                </Label>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIssueType("bug")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      issueType === "bug"
                        ? "bg-destructive/10 text-destructive border-destructive/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Bug className="w-4 h-4" />
                    Bug Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("enhancement")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      issueType === "enhancement"
                        ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" />
                    Feature Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setIssueType("question")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      issueType === "question"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Question / Inquiry
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor={titleInputId} className="text-sm font-semibold">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={titleInputId}
                  required
                  placeholder={
                    issueType === "bug"
                      ? "Short summary of the bug (e.g. Test series results table not updating)"
                      : issueType === "enhancement"
                      ? "Short summary of the requested feature"
                      : "What question do you have?"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor={descInputId} className="text-sm font-semibold">
                  Detailed Description <span className="text-destructive">*</span>
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
                  minHeight="200px"
                  maxHeight="380px"
                />
              </div>

              {/* Diagnostics Checkbox */}
              <div className="flex items-center gap-3 select-none border rounded-xl p-3.5 bg-muted/20">
                <input
                  type="checkbox"
                  checked
                  disabled
                  readOnly
                  aria-label="Include system diagnostics"
                  className="h-4 w-4 rounded accent-primary cursor-not-allowed opacity-90"
                />
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-2 mb-0.5">
                    Include System Diagnostics
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground">
                      Always included
                    </Badge>
                  </span>
                  Automatically attaches your user role ({userRole || "User"}), current URL, and client metadata to the GitHub issue to help developers debug faster.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Issue...
                    </>
                  ) : (
                    <>
                      <GithubIcon className="w-4 h-4 mr-2" />
                      Create GitHub Issue
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
