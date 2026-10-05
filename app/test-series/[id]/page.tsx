import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getTestSeries } from "../../services/test-series";
import { getQuestionsByIds } from "../../services/questions";
import { getOrganizationUsers } from "../../services/organizations";
import { getAllTeacherGroups } from "../../services/teacher-groups";
import { getStudentBatches } from "../../services/student-batches";
import TestSeriesEditor from "./test-series-editor";

export const metadata = {
    title: "Edit Test Series | Safalya",
    description: "Edit details and configure questions for your test series.",
};

type RouteParams = {
    id: string;
};

export default async function EditTestSeriesPage({
    params,
}: {
    params: Promise<RouteParams>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    const role = cookieStore.get("user_role")?.value;
    const organizationId = Number(cookieStore.get("organization_id")?.value) || 0;
    const userId = Number(cookieStore.get("user_id")?.value);

    if (!token) redirect("/login");
    if (!role || !["0", "1", "2"].includes(role)) redirect("/student/tests");

    const { id } = await params;
    const seriesId = Number(id);
    if (isNaN(seriesId)) notFound();

    // Fetch details
    const [series, orgUsers, teacherGroups, studentBatches] = await Promise.all([
        getTestSeries(seriesId).catch(() => null),
        organizationId ? getOrganizationUsers(organizationId).catch(() => []) : Promise.resolve([]),
        getAllTeacherGroups().catch(() => []),
        getStudentBatches().catch(() => []),
    ]);

    if (!series) notFound();

    // Permission enforcement:
    const canEdit =
        (role === "0" && series.org_id === 0) ||
        (role === "1" && series.org_id === organizationId) ||
        series.created_by === userId ||
        series.supervisor_id === userId ||
        Boolean(series.teacher_group_id);

    if (!canEdit) redirect("/test-series");

    const questionFilters = role === "0"
        ? { isGlobal: true }
        : role === "1"
            ? { isGlobal: false, organizationId }
            : { userId };
    const questions = await getQuestionsByIds(
        series.questions.map((question) => question.question_id),
        questionFilters,
    );

    return (
        <>
            <TestSeriesEditor
                series={series}
                availableQuestions={questions}
                organizationUsers={orgUsers}
                teacherGroups={teacherGroups}
                studentBatches={studentBatches}
                userId={userId}
                userRole={role}
                userOrgId={organizationId}
            />
        </>
    );
}
