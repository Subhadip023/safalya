import { createApiClient } from "../lib/api-client";
import { Topic } from "./topics";

export type QuestionOption = {
    id?: number;
    q_id?: number;
    ans: string;
    is_correct: boolean;
    diagram_id?: number | null;
    diagram_path?: string | null;
};

export type DiagramItem = {
    id: number;
    type: number;
    ref_id: number;
    org_id: number;
    user_id: number;
    path: string;
};

export type Question = {
    id: number;
    question: string;
    title?: string;
    organization_id: number;
    user_id: number;
    is_global: boolean;
    marks: string;
    is_active: boolean;
    topic_id?: number | null;
    topic?: Topic | null;
    options?: QuestionOption[];
    diagram_id?: number | null;
    diagram_path?: string | null;
    diagrams?: DiagramItem[];
};

export type CreateQuestionInput = {
    question: string;
    marks: string;
    is_active: boolean;
    topic_id?: number | null;
};

export type UpdateQuestionInput = Partial<CreateQuestionInput> & {
    options?: Array<Pick<QuestionOption, "ans" | "is_correct">>;
};

export type PaginatedQuestionResponse = {
    items: Question[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

type QuestionFilters = {
    search?: string;
    questionIds?: number[];
    isGlobal?: boolean;
    organizationId?: number;
    userId?: number;
};

export async function getAllQuestions(
    page = 1,
    pageSize = 10,
    topicId?: number,
    filters: QuestionFilters = {},
): Promise<PaginatedQuestionResponse> {
    const client = await createApiClient();
    const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });
    if (topicId !== undefined && topicId !== null) {
        params.set("topic_id", String(topicId));
    }
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.isGlobal !== undefined) params.set("is_global", String(filters.isGlobal));
    if (filters.organizationId !== undefined) {
        params.set("organization_id", String(filters.organizationId));
    }
    if (filters.userId !== undefined) params.set("question_user_id", String(filters.userId));
    filters.questionIds?.forEach((id) => params.append("question_ids", String(id)));
    return client.get<PaginatedQuestionResponse>(`questions/?${params.toString()}`);
}

export async function getQuestionsByIds(
    questionIds: number[],
    filters: Omit<QuestionFilters, "questionIds" | "search"> = {},
): Promise<Question[]> {
    const uniqueIds = [...new Set(questionIds)];
    const batches: number[][] = [];
    for (let index = 0; index < uniqueIds.length; index += 100) {
        batches.push(uniqueIds.slice(index, index + 100));
    }
    const pages: PaginatedQuestionResponse[] = [];
    let nextBatch = 0;
    const workers = Array.from({ length: Math.min(4, batches.length) }, async () => {
        while (nextBatch < batches.length) {
            const batchIndex = nextBatch++;
            pages[batchIndex] = await getAllQuestions(1, batches[batchIndex].length, undefined, {
                ...filters,
                questionIds: batches[batchIndex],
            });
        }
    });
    await Promise.all(workers);

    const questionsById = new Map(pages.flatMap((page) => page.items).map((question) => [question.id, question]));
    return uniqueIds.flatMap((id) => {
        const question = questionsById.get(id);
        return question ? [question] : [];
    });
}

export async function getQuestion(questionId: number): Promise<Question> {
    const client = await createApiClient();
    return client.get<Question>(`questions/${questionId}`);
}

export async function createQuestion(data: CreateQuestionInput): Promise<Question> {
    const client = await createApiClient();
    return client.post<Question>("questions/", data);
}

export async function updateQuestion(questionId: number, data: UpdateQuestionInput): Promise<Question> {
    const client = await createApiClient();
    return client.patch<Question>(`questions/${questionId}`, data);
}

export async function deleteQuestion(questionId: number): Promise<void> {
    const client = await createApiClient();
    await client.delete(`questions/${questionId}`);
}

export async function createQuestionOption(questionId: number, data: QuestionOption): Promise<QuestionOption> {
    const client = await createApiClient();
    return client.post<QuestionOption>(`questions/${questionId}/options/`, data);
}
