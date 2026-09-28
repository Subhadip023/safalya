import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllQuestions } from "../services/questions";
import { getAllTestSeries } from "../services/test-series";
import { getStudentBatches } from "../services/student-batches";
import { getAllTeacherGroups } from "../services/teacher-groups";
import { getAllUsers } from "../services/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, GraduationCap, HelpCircle, Layers, Users, PlusCircle, ArrowRight } from "lucide-react";

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
    if (roleValue === "3") redirect("/student/tests");

    const roleName = roleValue ? ROLE_NAMES[roleValue] ?? "User" : "User";
    const isAdmin = roleValue === "1";

    const [questionsRes, testSeriesRes, batchesRes, groupsRes, usersRes] = await Promise.allSettled([
        getAllQuestions(1, 1),
        getAllTestSeries(),
        getStudentBatches(),
        getAllTeacherGroups(),
        getAllUsers(),
    ]);

    const totalQuestions = questionsRes.status === "fulfilled" ? questionsRes.value.total : 0;
    const testSeriesList = testSeriesRes.status === "fulfilled" ? testSeriesRes.value : [];
    const batchesList = batchesRes.status === "fulfilled" ? batchesRes.value : [];
    const groupsList = groupsRes.status === "fulfilled" ? groupsRes.value : [];
    const usersList = usersRes.status === "fulfilled" ? usersRes.value : [];

    const totalTestSeries = testSeriesList.length;
    const totalBatches = batchesList.length;
    const totalTeacherGroups = groupsList.length;
    const totalUsers = usersList.length;

    // Get up to 5 recent test series
    const recentTestSeries = testSeriesList.slice(0, 5);

    return (
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardDescription>Dashboard</CardDescription>
                        <CardTitle className="text-3xl">Welcome, {roleName} {userName}</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<Link href="/questions/create" />}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Question
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href="/questions" />}>
                            View Questions
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="transition-colors hover:bg-accent/50">
                    <Link href="/questions">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Questions</CardTitle>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalQuestions}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total questions created</p>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="transition-colors hover:bg-accent/50">
                    <Link href="/test-series">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Test Series</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalTestSeries}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total test series</p>
                        </CardContent>
                    </Link>
                </Card>

                <Card className="transition-colors hover:bg-accent/50">
                    <Link href="/student-batches">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Student Batches</CardTitle>
                            <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalBatches}</div>
                            <p className="text-xs text-muted-foreground mt-1">Active student batches</p>
                        </CardContent>
                    </Link>
                </Card>

                {isAdmin ? (
                    <Card className="transition-colors hover:bg-accent/50">
                        <Link href="/users">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Users</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalUsers}</div>
                                <p className="text-xs text-muted-foreground mt-1">Total registered users</p>
                            </CardContent>
                        </Link>
                    </Card>
                ) : (
                    <Card className="transition-colors hover:bg-accent/50">
                        <Link href="/teacher-groups">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Teacher Groups</CardTitle>
                                <Layers className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalTeacherGroups}</div>
                                <p className="text-xs text-muted-foreground mt-1">Assigned teacher groups</p>
                            </CardContent>
                        </Link>
                    </Card>
                )}
            </div>

            {/* Recent Test Series section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Recent Test Series</CardTitle>
                        <CardDescription>Overview of recently configured assessment tests</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/test-series" />}>
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    {recentTestSeries.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">No test series available yet.</p>
                    ) : (
                        <div className="divide-y rounded-md border">
                            {recentTestSeries.map((ts) => (
                                <div key={ts.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-muted/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{ts.name}</span>
                                            <Badge variant={ts.is_active ? "default" : "secondary"} className="text-xs">
                                                {ts.is_active ? "Active" : "Inactive"}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs capitalize">
                                                {ts.access_type.replace("_", " ")}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                                            <span>Questions: {ts.questions?.length ?? 0}</span>
                                            <span>Duration: {Math.floor(ts.duration_seconds / 60)} mins</span>
                                            {ts.code && <span>Code: <code className="font-mono">{ts.code}</code></span>}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/test-series/${ts.id}`} />}>
                                        View Details
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
