import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrganizationUsers } from "../../services/organizations";
import type { User } from "../../services/users";
import TeacherGroupCreator from "./teacher-group-creator";

export const metadata = {
    title: "Create Teacher Group | Safalya",
    description: "Create a new teacher group and assign teachers.",
};

export default async function CreateTeacherGroupPage() {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");

    const role = cookieStore.get("user_role")?.value ?? "";
    if (role === "3") redirect("/student/tests");

    const organizationId = cookieStore.get("organization_id")?.value ?? "";
    const currentUserId = Number(cookieStore.get("user_id")?.value ?? 0);

    let users: User[] = [];
    try {
        const orgUsers = organizationId ? await getOrganizationUsers(Number(organizationId)) : [];
        users = orgUsers.filter((u) => u.role === 1 || u.role === 2);
    } catch (err) {
        console.error("Failed to load organization users:", err);
    }

    return (
        <main className="p-6">
            <TeacherGroupCreator 
                users={users} 
                currentUserId={currentUserId}
                userRole={role}
            />
        </main>
    );
}
