import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllUsers } from "../services/users";
import { getAllOrganizations } from "../services/organizations";
import OrganizationManager from "./organization-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { HelpCircle, Building2, Mail, Users, ArrowRight, ShieldCheck, LogOut } from "lucide-react";

const ROLE_NAMES: Record<number, string> = {
    0: "Super Admin",
    1: "Admin",
    2: "Teacher",
    3: "Student",
};

export const metadata = {
    title: "Super Admin | Safalya",
};

export default async function SuperAdminPage() {
    const cookieStore = await cookies();

    if (!cookieStore.has("access_token")) redirect("/login");
    if (cookieStore.get("user_role")?.value !== "0") redirect("/dashboard");

    const userName = cookieStore.get("user_name")?.value ?? "Super Admin";
    const [users, organizations] = await Promise.all([getAllUsers(), getAllOrganizations()]);

    return (
        <main className="px-6 py-8 animate-in fade-in-50 duration-200">
            <div className="mx-auto max-w-5xl space-y-6">
                {/* ── 1. Hero Header Banner ── */}
                <Card className="border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-background shadow-xs relative overflow-hidden">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
                    <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-purple-500/30 text-purple-700 dark:text-purple-300 bg-purple-500/10 text-xs font-semibold gap-1.5 py-0.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    Super Admin Control
                                </Badge>
                            </div>
                            <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                                Welcome, {userName}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                                Master oversight of organizations, users, and platform settings.
                            </CardDescription>
                        </div>

                        <form action="/api/auth/logout" method="post">
                            <Button type="submit" variant="outline" size="sm" className="gap-1.5 text-xs font-medium border-border/80 hover:bg-muted/60">
                                <LogOut className="h-3.5 w-3.5" />
                                Log out
                            </Button>
                        </form>
                    </CardHeader>
                </Card>

                {/* ── 2. Metric & Quick Action Cards ── */}
                <section className="grid gap-4 sm:grid-cols-4">
                    {/* Questions Card (Indigo) */}
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
                            <div className="text-base font-bold text-foreground">
                                Question Bank
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">
                                    View & create questions
                                </p>
                                <ArrowRight className="h-3 w-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    </Card>

                    {/* Organizations Card (Emerald) */}
                    <Card className="transition-all hover:shadow-md hover:border-emerald-500/40 border-border/70 group">
                        <Link href="/organizations/create" className="block p-5">
                            <div className="flex items-center justify-between pb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Organizations
                                </span>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                                    <Building2 className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-base font-bold text-foreground">
                                Add Organization
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">
                                    Register new institute
                                </p>
                                <ArrowRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    </Card>

                    {/* Send Mail Card (Sky) */}
                    <Card className="transition-all hover:shadow-md hover:border-sky-500/40 border-border/70 group">
                        <Link href="/super-admin/send-mail" className="block p-5">
                            <div className="flex items-center justify-between pb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Broadcast
                                </span>
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                                    <Mail className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="text-base font-bold text-foreground">
                                Send Email
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-muted-foreground">
                                    Compose platform emails
                                </p>
                                <ArrowRight className="h-3 w-3 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Link>
                    </Card>

                    {/* Users KPI Card (Amber) */}
                    <Card className="border-border/70 p-5">
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Users
                            </span>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-foreground">
                            {users.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Registered platform users
                        </p>
                    </Card>
                </section>

                {/* ── 3. Organizations Card ── */}
                <Card className="border-border/70 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-bold">Organizations</CardTitle>
                                <CardDescription className="text-xs">
                                    {organizations.length} registered {organizations.length === 1 ? "organization" : "organizations"}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-xs">
                            {organizations.length} Active
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <OrganizationManager initialOrganizations={organizations} />
                    </CardContent>
                </Card>

                {/* ── 4. All Users Table ── */}
                <Card className="border-border/70 shadow-xs">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <Users className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-bold">All Platform Users</CardTitle>
                                <CardDescription className="text-xs">
                                    Browse registered accounts across all roles
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-xs">
                            {users.length} Total
                        </Badge>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {users.length === 0 ? (
                            <p className="text-muted-foreground px-6 py-10 text-center text-sm">No users found.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-border/60">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="text-xs font-semibold">Name</TableHead>
                                            <TableHead className="text-xs font-semibold">Email</TableHead>
                                            <TableHead className="text-xs font-semibold">Role</TableHead>
                                            <TableHead className="text-xs font-semibold">Joined</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-semibold text-xs sm:text-sm text-foreground">{user.name}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {user.email}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[11px] font-medium ${
                                                            user.role === 0
                                                                ? "border-purple-500/30 text-purple-700 dark:text-purple-300 bg-purple-500/10"
                                                                : user.role === 1
                                                                ? "border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10"
                                                                : user.role === 2
                                                                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                                                : "border-sky-500/30 text-sky-700 dark:text-sky-300 bg-sky-500/10"
                                                        }`}
                                                    >
                                                        {ROLE_NAMES[user.role] ?? `Role ${user.role}`}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Intl.DateTimeFormat("en", {
                                                        dateStyle: "medium",
                                                    }).format(new Date(user.created_at))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
