import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ResetPasswordForm from "./reset-password-form";

export const metadata = {
  title: "Reset Password | Safalya",
  description: "Reset your Safalya account password.",
};

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    redirect("/login");
  }

  return (
    <main className="mx-auto mt-8 max-w-md px-4 sm:px-6">
      <Card className="shadow-lg border border-border/60">
        <CardContent className="pt-6">
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
