import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ReportIssueForm from "./issue-form";

export const metadata = {
  title: "Report an Issue | Safalya",
  description: "Submit issues and bug reports directly to GitHub repositories.",
};

export default async function ReportIssuePage() {
  const cookieStore = await cookies();
  if (!cookieStore.has("access_token")) {
    redirect("/login");
  }

  const role = cookieStore.get("user_role")?.value ?? "";
  const userName = cookieStore.get("user_name")?.value ?? "User";
  const organizationName = cookieStore.get("organization_name")?.value ?? "";

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <ReportIssueForm
        userRole={role}
        userName={userName}
        organizationName={organizationName}
      />
    </main>
  );
}
