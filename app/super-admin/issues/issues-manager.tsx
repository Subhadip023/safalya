"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bug,
  Search,
  RefreshCw,
  ExternalLink,
  Code2,
  Server,
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  CheckCircle,
  AlertCircle,
  Plus,
  Loader2,
  X,
  Filter,
  Layers,
  MessageSquare,
  Clock,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReportIssueModal from "@/components/report-issue-modal";

export type IssueItem = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments_count: number;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  repositoryType: "frontend" | "backend";
  repositoryName: string;
};

type RepositoriesConfig = {
  frontend: string | null;
  backend: string | null;
};

export type SuperAdminIssuesManagerProps = {
  userRole: string;
  userName: string;
  organizationName?: string;
};

export default function SuperAdminIssuesManager({
  userRole,
  userName,
  organizationName,
}: SuperAdminIssuesManagerProps) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [repositories, setRepositories] = useState<RepositoriesConfig>({
    frontend: null,
    backend: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [repoFilter, setRepoFilter] = useState<"all" | "frontend" | "backend">("all");
  const [stateFilter, setStateFilter] = useState<"all" | "open" | "closed">("all");

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Transfer modal state
  const [transferringIssue, setTransferringIssue] = useState<IssueItem | null>(null);
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const [expandedIssueIds, setExpandedIssueIds] = useState<Record<number, boolean>>({});

  function toggleExpand(id: number) {
    setExpandedIssueIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function loadIssues(isRefresh = false) {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/issues?list=true");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load issues.");
      }

      setIssues(data.issues || []);
      if (data.repositories) {
        setRepositories(data.repositories);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to fetch issues from GitHub.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    loadIssues();
  }, []);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Repo filter
      if (repoFilter !== "all" && issue.repositoryType !== repoFilter) {
        return false;
      }
      // State filter
      if (stateFilter !== "all" && issue.state !== stateFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = `#${issue.number}`.includes(q);
        const titleMatch = issue.title.toLowerCase().includes(q);
        const userMatch = issue.user.login.toLowerCase().includes(q);
        const labelMatch = issue.labels.some((l) => l.name.toLowerCase().includes(q));
        return numMatch || titleMatch || userMatch || labelMatch;
      }
      return true;
    });
  }, [issues, repoFilter, stateFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter((i) => i.state === "open").length;
    const frontendCount = issues.filter((i) => i.repositoryType === "frontend").length;
    const backendCount = issues.filter((i) => i.repositoryType === "backend").length;
    return { total, open, frontendCount, backendCount };
  }, [issues]);

  async function handleTransferConfirm() {
    if (!transferringIssue) return;

    const toRepo = transferringIssue.repositoryType === "frontend" ? "backend" : "frontend";

    setIsTransferSubmitting(true);
    try {
      const res = await fetch("/api/issues/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueNumber: transferringIssue.number,
          fromRepo: transferringIssue.repositoryType,
          toRepo,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to transfer issue.");
      }

      toast.success(
        `Issue #${transferringIssue.number} successfully transferred to ${toRepo}!`
      );

      setTransferringIssue(null);
      // Reload list to get fresh states
      loadIssues(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer issue.";
      toast.error(msg);
    } finally {
      setIsTransferSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GithubIcon className="w-8 h-8 text-primary" />
            GitHub Issue Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Super Admin dashboard: view all reported issues and change/transfer issues between repositories.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadIssues(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Issue
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Issues
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">{stats.total}</div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Open Issues
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.open}
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Code2 className="w-3.5 h-3.5 text-blue-500" />
            Frontend Repo
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {stats.frontendCount}
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-purple-500" />
            Backend Repo
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {stats.backendCount}
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-card border border-border/80 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by #number, title, label or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Repo Filter */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setRepoFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                repoFilter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Repos
            </button>
            <button
              type="button"
              onClick={() => setRepoFilter("frontend")}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                repoFilter === "frontend"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="w-3 h-3 text-blue-500" />
              Frontend
            </button>
            <button
              type="button"
              onClick={() => setRepoFilter("backend")}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                repoFilter === "backend"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Server className="w-3 h-3 text-purple-500" />
              Backend
            </button>
          </div>

          {/* State Filter */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStateFilter("all")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stateFilter === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStateFilter("open")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stateFilter === "open"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setStateFilter("closed")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stateFilter === "closed"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            {error}
            <div className="mt-1 text-xs text-muted-foreground">
              Make sure <code className="bg-muted px-1 py-0.5 rounded font-mono">GITHUB_PAT</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded font-mono">GITHUB_FRONTEND_REPO</code>, and{" "}
              <code className="bg-muted px-1 py-0.5 rounded font-mono">GITHUB_BACKEND_REPO</code> are configured in{" "}
              <code className="bg-muted px-1 py-0.5 rounded font-mono">.env.local</code>.
            </div>
          </div>
        </div>
      )}

      {/* Issues List */}
      {isLoading ? (
        <div className="p-16 border rounded-2xl border-dashed bg-card/50 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Fetching issues from GitHub...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-16 border rounded-2xl border-dashed bg-card/50 text-center space-y-3">
          <GithubIcon className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">No Issues Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {searchQuery || repoFilter !== "all" || stateFilter !== "all"
              ? "No issues match your current filters. Try resetting the search or filter pills."
              : "No issues have been filed yet. You can create the first issue using the button above."}
          </p>
          {(searchQuery || repoFilter !== "all" || stateFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setRepoFilter("all");
                setStateFilter("all");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const isFrontend = issue.repositoryType === "frontend";
            const targetOpposite = isFrontend ? "Backend" : "Frontend";

            return (
              <Card
                key={`${issue.repositoryType}-${issue.id}`}
                className="transition-all duration-150 hover:shadow-md border-border/80"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Issue Details */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* State Badge */}
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            issue.state === "open"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30"
                          }`}
                        >
                          {issue.state === "open" ? (
                            <>
                              <CircleDot className="w-3 h-3" />
                              Open
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Closed
                            </>
                          )}
                        </span>

                        {/* Repository Type Badge */}
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium flex items-center gap-1 ${
                            isFrontend
                              ? "border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/5"
                              : "border-purple-500/40 text-purple-700 dark:text-purple-300 bg-purple-500/5"
                          }`}
                        >
                          {isFrontend ? (
                            <Code2 className="w-3 h-3" />
                          ) : (
                            <Server className="w-3 h-3" />
                          )}
                          {isFrontend ? "Frontend Repo" : "Backend Repo"}
                        </Badge>

                        {/* Issue Number */}
                        <span className="text-xs font-mono text-muted-foreground">
                          #{issue.number}
                        </span>

                        {/* Labels */}
                        {issue.labels.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: `#${l.color}15`,
                              borderColor: `#${l.color}40`,
                              color: `#${l.color}`,
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>

                      {/* Issue Title with External Link */}
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group"
                      >
                        <span className="line-clamp-1">{issue.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                      </a>

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" />
                          {issue.user.login}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Opened {new Date(issue.created_at).toLocaleDateString()}
                        </span>
                        {issue.comments_count > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {issue.comments_count} comment
                            {issue.comments_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Expand / View Details Button */}
                      {issue.body && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(issue.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium pt-1 select-none cursor-pointer"
                        >
                          {expandedIssueIds[issue.id] ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              <span>Hide description & attachments</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              <span>
                                View description {issue.body.includes("http") ? "& attachments" : ""}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Right: Actions / Change Repo */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTransferringIssue(issue)}
                        className="flex items-center gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary/5 hover:border-primary"
                        title={`Move this issue to the ${targetOpposite} repository`}
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                        <span>Move to {targetOpposite}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        render={
                          <a
                            href={issue.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          />
                        }
                        nativeButton={false}
                      >
                        GitHub ↗
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Issue Body with Image Attachments */}
                  {expandedIssueIds[issue.id] && issue.body && (
                    <div className="mt-3.5 pt-3.5 border-t border-border/60 bg-muted/20 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 sm:p-5 rounded-b-xl space-y-3 text-xs leading-relaxed animate-in fade-in duration-150">
                      <IssueBodyViewer body={issue.body} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transfer Confirmation Modal */}
      {transferringIssue && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in-0 duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card text-card-foreground border border-border shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setTransferringIssue(null)}
                disabled={isTransferSubmitting}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">
                Change Repository
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Move issue{" "}
                <span className="font-semibold text-foreground">
                  #{transferringIssue.number}
                </span>{" "}
                to the other repository.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2 text-xs">
              <div>
                <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider block mb-0.5">
                  Issue Title
                </span>
                <span className="font-medium text-foreground line-clamp-2">
                  {transferringIssue.title}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">From: </span>
                  <span className="font-semibold text-foreground capitalize">
                    {transferringIssue.repositoryType} Repo
                  </span>
                </div>
                <div>➔</div>
                <div>
                  <span className="text-muted-foreground">To: </span>
                  <span className="font-semibold text-primary capitalize">
                    {transferringIssue.repositoryType === "frontend" ? "Backend" : "Frontend"} Repo
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This will migrate the issue details, labels, and metadata to the destination repository and link the source issue.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferringIssue(null)}
                disabled={isTransferSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleTransferConfirm}
                disabled={isTransferSubmitting}
                className="min-w-[130px]"
              >
                {isTransferSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Moving...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Confirm Move
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Issue Modal for Super Admin */}
      <ReportIssueModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          loadIssues(true);
        }}
        userRole={userRole}
        userName={userName}
        organizationName={organizationName}
      />
    </div>
  );
}

function IssueBodyViewer({ body }: { body: string }) {
  // Extract images from body: ![alt](url) or <img src="url" />
  const imageUrls: string[] = [];
  const mdImgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdImgRegex.exec(body)) !== null) {
    if (!imageUrls.includes(match[2])) imageUrls.push(match[2]);
  }
  const htmlImgRegex = /<img\s+[^>]*src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  while ((match = htmlImgRegex.exec(body)) !== null) {
    if (!imageUrls.includes(match[1])) imageUrls.push(match[1]);
  }

  // Remove system diagnostics section from main description display for cleaner reading
  const parts = body.split("---");
  const mainDesc = parts[0] || body;
  const diagnosticsSection = parts.slice(1).join("---").trim();

  // Clean text from images for the text preview
  const textWithoutImages = mainDesc
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, "")
    .replace(/<img\s+[^>]*src=["'][^"']+["'][^>]*>/gi, "")
    .replace(/^### Description\s*/i, "")
    .replace(/<[^>]+>/g, " ")
    .trim();

  return (
    <div className="space-y-3">
      {textWithoutImages && (
        <div className="text-foreground/90 whitespace-pre-wrap font-sans text-xs bg-background p-3 rounded-lg border border-border/60">
          {textWithoutImages}
        </div>
      )}

      {/* Render Images if any exist */}
      {imageUrls.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-primary" />
            Attached Screenshots & Images ({imageUrls.length})
          </span>
          <div className="flex flex-wrap gap-3">
            {imageUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block rounded-xl overflow-hidden border border-border bg-background shadow-xs hover:shadow-md transition-all max-w-md"
              >
                <img
                  src={url}
                  alt={`Attachment ${idx + 1}`}
                  className="max-h-64 max-w-full object-contain rounded-xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> View original
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {diagnosticsSection && (
        <details className="text-[11px] text-muted-foreground pt-1">
          <summary className="cursor-pointer font-medium hover:text-foreground select-none">
            📋 View Diagnostic & System Details
          </summary>
          <pre className="mt-2 p-2.5 rounded-lg bg-background border border-border/60 font-mono text-[10px] whitespace-pre-wrap break-all text-muted-foreground">
            {diagnosticsSection}
          </pre>
        </details>
      )}
    </div>
  );
}

