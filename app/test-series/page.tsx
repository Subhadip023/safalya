import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getApiUrl } from "../lib/api-url";
import { getAllTestSeries } from "../services/test-series";
import { getAllQuestionsList } from "../services/questions";
import { getAllTopics } from "../services/topics";
import { getOrganization } from "../services/organizations";
import TestSeriesManager from "./test-series-manager";

export const metadata = {
    title: "Test  | Safalya",
    description: "Create and manage test for your students.",
};

export default async function TestSeriesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    const role = cookieStore.get("user_role")?.value;

    if (!token) redirect("/login");
    if (!role || !["0", "1", "2"].includes(role)) redirect("/student/tests");

    async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T | []> {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error: any) {
                console.warn(`[Retry ${i + 1}/${retries}] Fetch failed:`, error?.message || error);
                if (i === retries - 1) return [];
                await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i)));
            }
        }
        return [];
    }

    const series = await fetchWithRetry(getAllTestSeries) as any[];
    const allQuestions = await fetchWithRetry(getAllQuestionsList) as any[];
    const topics = await fetchWithRetry(getAllTopics) as any[];


    const organizationId = Number(cookieStore.get("organization_id")?.value);
    const userId = Number(cookieStore.get("user_id")?.value);

    // Keep all test series returned by backend (backend already applies role and supervisor visibility)
    const teacherSeries = role === "2"
        ? series.filter((s) => s.created_by === userId || s.supervisor_id === userId || Boolean(s.teacher_group_id))
        : series;

    const orgIds = [...new Set(teacherSeries.map((s) => s.org_id).filter((id) => id > 0))];
    const orgResults = await Promise.allSettled(orgIds.map((id) => getOrganization(id)));
    const organizations = Object.fromEntries(
        orgResults.flatMap((res) =>
            res.status === "fulfilled" ? [[res.value.id, res.value.name]] : [],
        )
    );

    // Filter questions by role: superadmin sees globals, admin/teacher sees available questions
    const questions = allQuestions.filter((q) => {
        if (role === "0") return q.is_global;
        if (role === "1") return true;
        return q.user_id === userId || !q.is_global;
    });


    return (
        <main className="p-6">
            <TestSeriesManager
                initialSeries={teacherSeries}
                organizations={organizations}
                questions={questions}
                topics={topics}
                userId={userId}
                userRole={role}
                userOrgId={organizationId}
            />
        </main>
    );
}
