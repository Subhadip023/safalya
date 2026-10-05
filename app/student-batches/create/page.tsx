import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrganizationUsers } from "../../services/organizations";
import type { User } from "../../services/users";
import StudentBatchCreator from "./student-batch-creator";

export const metadata = {
    title: "Create Student Batch | Safalya",
    description: "Create a new student batch and assign students.",
};

export default async function CreateStudentBatchPage() {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");

    const role = cookieStore.get("user_role")?.value ?? "";
    if (role === "3") redirect("/student/tests");

    const organizationId = cookieStore.get("organization_id")?.value ?? "";
    const currentUserId = Number(cookieStore.get("user_id")?.value ?? 0);

    let users: User[] = [];
    try {
        const orgUsers = organizationId ? await getOrganizationUsers(Number(organizationId)) : [];
        users = orgUsers;
    } catch (err) {
        console.error("Failed to load organization users:", err);
    }

    return (
        <main className="p-6">
            <StudentBatchCreator 
                users={users} 
                organizationId={Number(organizationId)} 
                currentUserId={currentUserId}
                userRole={role}
            />
        </main>
    );
}
