import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SuperAdminIssuesManager from "./issues-manager";

export const metadata = {
  title: "GitHub Issues Management | Safalya Super Admin",
  description: "View and transfer issues across frontend and backend repositories.",
};

export default async function SuperAdminIssuesPage() {
  const cookieStore = await cookies();
  if (!cookieStore.has("access_token")) {
    redirect("/login");
  }

  const role = cookieStore.get("user_role")?.value ?? "";
  if (role !== "0") {
    redirect("/dashboard");
  }

  const userName = cookieStore.get("user_name")?.value ?? "Super Admin";
  const organizationName = cookieStore.get("organization_name")?.value ?? "";

  return (
    <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <SuperAdminIssuesManager
        userRole={role}
        userName={userName}
        organizationName={organizationName}
      />
    </main>
  );
}
