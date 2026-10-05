import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TopicManager from "./topic-manager";

export default async function TopicsPage() {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");
    
    const role = cookieStore.get("user_role")?.value ?? "";
    if (role === "3") redirect("/student/tests");

    return <TopicManager userRole={role} />;
}
