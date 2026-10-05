import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getStudentBatch, getBatchStudents } from "../../services/student-batches";
import { getOrganizationUsers } from "../../services/organizations";
import type { User } from "../../services/users";
import StudentBatchEditor from "./student-batch-editor";

export const metadata = {
    title: "Edit Student Batch | Safalya",
    description: "Configure student batch details and assigned students.",
};

type RouteParams = {
    id: string;
};

export default async function EditStudentBatchPage({
    params,
}: {
    params: Promise<RouteParams>;
}) {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");

    const role = cookieStore.get("user_role")?.value ?? "";
    if (role === "3") redirect("/student/tests");

    const { id } = await params;
    const batchId = Number(id);
    if (isNaN(batchId)) notFound();

    const organizationId = cookieStore.get("organization_id")?.value ?? "";
    const currentUserId = Number(cookieStore.get("user_id")?.value ?? 0);

    const [batch, orgUsers, batchStudents] = await Promise.all([
        getStudentBatch(batchId).catch(() => null),
        organizationId
            ? getOrganizationUsers(Number(organizationId)).catch((): User[] => [])
            : Promise.resolve<User[]>([]),
        getBatchStudents(batchId).catch(() => []),
    ]);

    if (!batch) notFound();

    // If teacher, they can only view/edit their own batch
    if (role === "2" && batch.supervisor !== currentUserId) {
        redirect("/student-batches");
    }

    return (
        <main className="p-6">
            <StudentBatchEditor 
                batch={batch} 
                users={orgUsers} 
                initialStudents={batchStudents} 
                organizationId={Number(organizationId)} 
                userRole={role}
                currentUserId={currentUserId}
            />
        </main>
    );
}
