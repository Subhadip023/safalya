import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getTeacherGroup } from "../../services/teacher-groups";
import { getOrganizationUsers } from "../../services/organizations";
import type { User } from "../../services/users";
import TeacherGroupEditor from "./teacher-group-editor";

export const metadata = {
    title: "Edit Teacher Group | Safalya",
    description: "Configure teacher group details and assigned teachers.",
};

type RouteParams = {
    id: string;
};

export default async function EditTeacherGroupPage({
    params,
}: {
    params: Promise<RouteParams>;
}) {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");

    const role = cookieStore.get("user_role")?.value ?? "";
    if (role === "3") redirect("/student/tests");

    const { id } = await params;
    const groupId = Number(id);
    if (isNaN(groupId)) notFound();

    const organizationId = cookieStore.get("organization_id")?.value ?? "";
    const currentUserId = Number(cookieStore.get("user_id")?.value ?? 0);

    const [group, orgUsers] = await Promise.all([
        getTeacherGroup(groupId).catch(() => null),
        organizationId
            ? getOrganizationUsers(Number(organizationId)).catch((): User[] => [])
            : Promise.resolve<User[]>([]),
    ]);

    if (!group) notFound();

    // If teacher, only the group supervisor is allowed to access and edit the group
    if (role === "2" && group.supervisor !== currentUserId) {
        redirect("/teacher-groups");
    }

    const users = orgUsers.filter((u) => u.role === 1 || u.role === 2);

    return (
        <main className="p-6">
            <TeacherGroupEditor
                group={group}
                users={users}
                userRole={role}
                currentUserId={currentUserId}
            />
        </main>
    );
}
