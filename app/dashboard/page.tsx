import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllQuestions } from "../services/questions";
import { getAllTestSeries } from "../services/test-series";
import { getStudentBatches } from "../services/student-batches";
import { getAllTeacherGroups } from "../services/teacher-groups";
import { getOrganizationUsers } from "../services/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    FileText, 
    GraduationCap, 
    HelpCircle, 
    Layers, 
    Users, 
    PlusCircle, 
    ArrowRight, 
    Sparkles, 
    Clock, 
    Hash, 
    BookOpen, 
    CheckCircle2, 
    Zap,
    ExternalLink
} from "lucide-react";

import { getStudentTests, getAttemptHistory } from "../services/student";
import { StudentDashboard } from "./student-dashboard";

const ROLE_NAMES: Record<string, string> = {
    0: "Super Admin",
    1: "Admin",
    2: "Teacher",
    3: "Student",
};

export const metadata = {
    title: "Dashboard | Safalya",
};

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) redirect("/login");

    const userName = cookieStore.get("user_name")?.value ?? "User";
    const roleValue = cookieStore.get("user_role")?.value;
    if (roleValue === "0") redirect("/super-admin");

    if (roleValue === "3") {
        const [testsRes, historyRes] = await Promise.allSettled([
            getStudentTests({ limit: "5" }),
            getAttemptHistory(),
        ]);
        const availableTestsData =
            testsRes.status === "fulfilled"
                ? testsRes.value
                : { items: [], total: 0, page: 1, limit: 5, total_pages: 1 };
        const historyData = historyRes.status === "fulfilled" ? historyRes.value : [];

        return (
            <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
                <StudentDashboard
                    userName={userName}
                    availableTests={availableTestsData.items}
                    totalAvailableTests={availableTestsData.total}
                    history={historyData}
                />
            </main>
        );
    }

    const roleName = roleValue ? ROLE_NAMES[roleValue] ?? "User" : "User";
    const isAdmin = roleValue === "1";
    const isTeacher = roleValue === "2";
    const organizationId = Number(cookieStore.get("organization_id")?.value) || 0;
    const userId = Number(cookieStore.get("user_id")?.value) || 0;

    const questionFilters = isAdmin && organizationId
        ? { organizationId }
        : isTeacher && userId
        ? { userId }
        : {};

    const [questionsRes, testSeriesRes, batchesRes, groupsRes, usersRes] = await Promise.allSettled([
        getAllQuestions(1, 1, undefined, questionFilters),
        getAllTestSeries(),
        getStudentBatches(),
        getAllTeacherGroups(),
        isAdmin && organizationId ? getOrganizationUsers(organizationId) : Promise.resolve([]),
    ]);

    const totalQuestions = questionsRes.status === "fulfilled" ? questionsRes.value.total : 0;
    const rawTestSeriesList = testSeriesRes.status === "fulfilled" ? testSeriesRes.value : [];
    const batchesList = batchesRes.status === "fulfilled" ? batchesRes.value : [];
    const groupsList = groupsRes.status === "fulfilled" ? groupsRes.value : [];
    const usersList = usersRes.status === "fulfilled" ? usersRes.value : [];

    // Filter teacher groups by organization
    const visibleTeacherGroups = organizationId
        ? groupsList.filter((g) => !g.org_id || g.org_id === organizationId)
        : groupsList;
    const totalTeacherGroups = visibleTeacherGroups.length;

    // Filter test series accurately based on user role and permissions
    const userGroupIds = new Set(visibleTeacherGroups.map((g) => g.id));
    const testSeriesList = rawTestSeriesList.filter((s) => {
        if (organizationId && s.org_id && s.org_id !== organizationId) return false;
        if (isAdmin) return true;
        if (isTeacher) {
            if (s.created_by === userId || s.supervisor_id === userId) return true;
            if (s.teacher_group_id && userGroupIds.has(s.teacher_group_id)) return true;
            return false;
        }
        return true;
    });

    const totalTestSeries = testSeriesList.length;

    // Filter student batches by organization
    const visibleBatches = organizationId
        ? batchesList.filter((b) => !b.org_id || b.org_id === organizationId)
        : batchesList;
    const totalBatches = visibleBatches.length;

    const totalUsers = usersList.length;

    // Get up to 5 recent test series (newest first / LIFO)
    const sortedTestSeriesList = [...testSeriesList].sort((a, b) => b.id - a.id);
    const recentTestSeries = sortedTestSeriesList.slice(0, 5);

    return (
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8 animate-in fade-in-50 duration-200">
            {/* ── 1. Colorful Minimalist Hero Banner ── */}
            <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background shadow-xs relative overflow-hidden">
                {/* Ambient Soft Glows */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />

                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 text-xs font-semibold gap-1.5 py-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {roleName} Portal
                            </Badge>
                        </div>
                        <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                            Welcome back, {userName}
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                            Manage questions, assessments, student batches, and learning progress.
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            nativeButton={false}
                            render={<Link href="/questions/bulk?mode=ai" />}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-medium gap-1.5 h-9 text-xs sm:text-sm"
                        >
                            <Sparkles className="h-4 w-4" />
                            AI Upload
                        </Button>
                        <Button
                            variant="outline"
                            nativeButton={false}
                            render={<Link href="/questions/create" />}
                            className="gap-1.5 font-medium border-border/80 hover:bg-muted/60 h-9 text-xs sm:text-sm"
                        >
                            <PlusCircle className="h-4 w-4 text-primary" />
                            Create Question
                        </Button>
                        <Button
                            variant="ghost"
                            nativeButton={false}
                            render={<Link href="/questions" />}
                            className="text-xs sm:text-sm h-9 text-muted-foreground hover:text-foreground"
                        >
                            View Questions →
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* ── 2. Minimalist KPI Metric Cards (Color Accents) ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Questions KPI (Indigo) */}
                <Card className="transition-all hover:shadow-md hover:border-indigo-500/40 border-border/70 group">
                    <Link href="/questions" className="block p-5">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Questions
                            </span>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                                <HelpCircle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                            {totalQuestions}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs text-muted-foreground">
                                {isAdmin ? "Organization repository" : "Created questions"}
                            </p>
                            <ArrowRight className="h-3 w-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Link>
                </Card>

                {/* Test Series KPI (Emerald) */}
                <Card className="transition-all hover:shadow-md hover:border-emerald-500/40 border-border/70 group">
                    <Link href="/test-series" className="block p-5">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Test Series
                            </span>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                            {totalTestSeries}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs text-muted-foreground">
                                Configured assessments
                            </p>
                            <ArrowRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Link>
                </Card>

                {/* Student Batches KPI (Amber) */}
                <Card className="transition-all hover:shadow-md hover:border-amber-500/40 border-border/70 group">
                    <Link href="/student-batches" className="block p-5">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Student Batches
                            </span>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                                <GraduationCap className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                            {totalBatches}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs text-muted-foreground">
                                Active student batches
                            </p>
                            <ArrowRight className="h-3 w-3 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Link>
                </Card>

                {/* Users / Teacher Groups KPI (Sky Blue) */}
                {isAdmin ? (
                    <Card className="transition-all hover:shadow-md hover:border-sky-500/40 border-border/70 group">
                        <Link href="/users" className="block p-5">
                            <div className="flex items-center justify-between pb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Users
                                </span>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                                    <Users className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {totalUsers}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <p className="text-xs text-muted-foreground">
                                    Registered members
                                </p>
                                <ArrowRight className="h-3 w-3 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    </Card>
                ) : (
                    <Card className="transition-all hover:shadow-md hover:border-sky-500/40 border-border/70 group">
                        <Link href="/teacher-groups" className="block p-5">
                            <div className="flex items-center justify-between pb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Teacher Groups
                                </span>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                                    <Layers className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {totalTeacherGroups}
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <p className="text-xs text-muted-foreground">
                                    Assigned groups
                                </p>
                                <ArrowRight className="h-3 w-3 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    </Card>
                )}
            </div>

            {/* ── 3. Quick Action Shortcut Pills ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                    href="/questions/bulk?mode=ai"
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 text-xs font-semibold text-foreground transition-all hover:border-indigo-500/40 group"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate">AI Question Upload</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <Link
                    href="/questions/bulk?mode=builder"
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-xs font-semibold text-foreground transition-all hover:border-blue-500/40 group"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <BookOpen className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate">Interactive Builder</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <Link
                    href="/test-series"
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-xs font-semibold text-foreground transition-all hover:border-emerald-500/40 group"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Zap className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate">New Test Series</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <Link
                    href="/student-batches"
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-xs font-semibold text-foreground transition-all hover:border-amber-500/40 group"
                >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <GraduationCap className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate">Student Batches</span>
                    <ArrowRight className="h-3 w-3 ml-auto text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
            </div>

            {/* ── 4. Recent Test Series Section ── */}
            <Card className="border-border/70 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold">Recent Test Series</CardTitle>
                            <CardDescription className="text-xs">Overview of recently configured assessments</CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/test-series" />} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                        View all <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                </CardHeader>
                <CardContent className="pt-4">
                    {recentTestSeries.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                            <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
                            <p className="font-medium">No test series available yet.</p>
                            <p className="text-xs">Create your first test series to start assessments.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
                            {recentTestSeries.map((ts) => (
                                <div key={ts.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/40 transition-colors">
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-sm text-foreground truncate max-w-md">
                                                {ts.name}
                                            </span>
                                            {ts.is_active ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-medium py-0">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[11px] font-medium py-0">
                                                    Inactive
                                                </Badge>
                                            )}
                                            {ts.access_type === "public" ? (
                                                <Badge variant="outline" className="text-[11px] border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-500/10 font-medium py-0">
                                                    Public
                                                </Badge>
                                            ) : ts.access_type === "invite_only" ? (
                                                <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10 font-medium py-0">
                                                    Invite Only
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[11px] border-border text-muted-foreground font-medium py-0">
                                                    Private
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                                            <span className="inline-flex items-center gap-1">
                                                <HelpCircle className="h-3 w-3 text-indigo-500/80" />
                                                {ts.questions?.length ?? 0} Questions
                                            </span>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="h-3 w-3 text-amber-500/80" />
                                                {Math.floor(ts.duration_seconds / 60)} mins
                                            </span>
                                            {ts.code && (
                                                <>
                                                    <span>•</span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Hash className="h-3 w-3 text-sky-500/80" />
                                                        <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-semibold">
                                                            {ts.code}
                                                        </code>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        nativeButton={false}
                                        render={<Link href={`/test-series/${ts.id}`} />}
                                        className="shrink-0 text-xs gap-1 hover:border-primary/40 hover:bg-primary/5 font-medium group/btn"
                                    >
                                        <span>View Details</span>
                                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
