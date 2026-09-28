import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdvancedBulkUpload from "@/components/advanced-bulk-upload";
import { Button } from "@/components/ui/button";
import { getAllTopics } from "../../services/topics";
import { getAllTestSeries } from "../../services/test-series";

export const metadata = {
    title: "Bulk Upload Questions | Safalya",
    description: "Upload multiple questions at once using JSON or the interactive builder.",
};

export default async function BulkUploadPage() {
    const cookieStore = await cookies();
    if (!cookieStore.has("access_token")) redirect("/login");
    const role = cookieStore.get("user_role")?.value;
    if (!role || !["0", "1", "2"].includes(role)) redirect("/student/tests");

    const [topics, testSeries] = await Promise.all([
        getAllTopics().catch(() => []),
        getAllTestSeries().catch(() => []),
    ]);

    return (
        <main className="mx-auto w-full max-w-4xl p-6">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" nativeButton={false} render={<Link href="/questions" />}>
                    ← Back to questions
                </Button>
            </div>
            <AdvancedBulkUpload topics={topics} testSeries={testSeries} />
        </main>
    );
}
