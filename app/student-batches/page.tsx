import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StudentBatchManager from "./student-batch-manager";
import { getStudentBatches, getBatchStudents, type StudentBatch, type BatchStudent } from "../services/student-batches";
import { getOrganizationUsers } from "../services/organizations";
import type { User } from "../services/users";

export const metadata = {
  title: "Batches | Safalya",
  description: "Organize and manage student batches and enrollments.",
};

export default async function StudentBatchesPage() {
  const cookieStore = await cookies();
  if (!cookieStore.has("access_token")) redirect("/login");

  const role = cookieStore.get("user_role")?.value ?? "";
  if (role === "3") redirect("/student/tests");

  const organizationId = cookieStore.get("organization_id")?.value ?? "";

  let batches: StudentBatch[] = [];
  let users: User[] = [];
  const batchStudentsMap: Record<number, BatchStudent[]> = {};

  try {
    batches = await getStudentBatches();
    
    // Fetch students for all batches concurrently
    await Promise.all(
      batches.map(async (batch) => {
        try {
          const students = await getBatchStudents(batch.id);
          batchStudentsMap[batch.id] = students;
        } catch (e) {
          console.error(`Failed to fetch students for batch ${batch.id}:`, e);
          batchStudentsMap[batch.id] = [];
        }
      })
    );

    if (organizationId) {
      users = await getOrganizationUsers(Number(organizationId));
    }
  } catch (error) {
    console.error("Failed to fetch student batches or users:", error);
  }

  return <StudentBatchManager initialBatches={batches} users={users} initialBatchStudents={batchStudentsMap} />;
}



