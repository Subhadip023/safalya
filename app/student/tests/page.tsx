import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStudentTests } from "../../services/student";
import { getOrganization } from "../../services/organizations";
import StudentTests from "./student-tests";

export type AvailableTest = {
    id: number;
    name: string;
    org_id: number;
    valid_until: string;
    duration_seconds: number;
    question_count: number;
    total_marks?: number;
    has_negative_marks?: boolean;
    max_negative_mark?: number;
    topics?: string[];
    access_type?: string;
    is_private?: boolean;
};

export type PaginatedTests = {
    items: AvailableTest[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
};

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{
        q?: string;
        topic?: string;
        org_id?: string;
        sort_order?: string;
        access_type?: string;
        page?: string;
        limit?: string;
    }>;
}) {
    const s = await cookies();
    if (!s.has("access_token")) redirect("/login");
    if (s.get("user_role")?.value !== "3") redirect("/dashboard");

    const params = await searchParams;

    const paginatedTests = await getStudentTests(params).catch(
        () => ({ items: [], total: 0, page: 1, limit: 10, total_pages: 1 } as PaginatedTests),
    );

    const orgIds = [...new Set(paginatedTests.items.map((t) => t.org_id).filter((id) => id > 0))];
    const orgResults = await Promise.allSettled(orgIds.map((id) => getOrganization(id)));
    const organizations = Object.fromEntries(
        orgResults.flatMap((res) =>
            res.status === "fulfilled" ? [[res.value.id, res.value.name]] : [],
        )
    );

    return (
        <main className="p-6">
            <StudentTests
                paginatedTests={paginatedTests}
                organizations={organizations}
                initialParams={{
                    q: params.q ?? "",
                    topic: params.topic ?? "",
                    org_id: params.org_id ?? "",
                    sort_order: params.sort_order ?? "asc",
                    access_type: params.access_type ?? "",
                    page: Number(params.page ?? "1"),
                    limit: Number(params.limit ?? "10"),
                }}
            />
        </main>
    );
}
