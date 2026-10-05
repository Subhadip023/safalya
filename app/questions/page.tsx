import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAllQuestions } from "../services/questions";
import { getOrganization } from "../services/organizations";
import { getUser } from "../services/users";
import { Button } from "@/components/ui/button";
import QuestionsTable from "./questions-table";

export const metadata = { title: "All Questions | Safalya" };

export default async function QuestionsPage() {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");
    if (cookieStore.get("user_role")?.value === "3") redirect("/student/tests");

    const paginated = await getAllQuestions(1, 10);

    // Resolve user/org names only for the first page
    const nonGlobalQuestions = paginated.items.filter((q) => !q.is_global);
    const userIds = [...new Set(nonGlobalQuestions.map((q) => q.user_id))];
    const organizationIds = [...new Set(nonGlobalQuestions.map((q) => q.organization_id))];

    const [userResults, organizationResults] = await Promise.all([
        Promise.allSettled(userIds.map((id) => getUser(id))),
        Promise.allSettled(organizationIds.map((id) => getOrganization(id))),
    ]);

    const users = Object.fromEntries(
        userResults.flatMap((r) => (r.status === "fulfilled" ? [[r.value.id, r.value.name]] : []))
    );
    const organizations = Object.fromEntries(
        organizationResults.flatMap((r) => (r.status === "fulfilled" ? [[r.value.id, r.value.name]] : []))
    );

    return (
        <main className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">All questions</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        View, search, and manage questions in your database.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" nativeButton={false} render={<Link href="/questions/bulk" />}>
                        Bulk upload
                    </Button>
                    <Button nativeButton={false} render={<Link href="/questions/create" />}>
                        Create question
                    </Button>
                </div>
            </div>

            <QuestionsTable
                initialData={paginated}
                initialUsers={users}
                initialOrganizations={organizations}
                userRole={cookieStore.get("user_role")?.value ?? ""}
            />
        </main>
    );
}
