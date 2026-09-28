"use client";

import { useState, useMemo, FormEvent, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import sanitizeHtml from "sanitize-html";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, X, Search, Sparkles, Upload, Users, Check, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Layers, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TestSeries } from "../../services/test-series";
import type { Question } from "../../services/questions";
import type { Topic } from "../../services/topics";
import type { User } from "../../services/users";
import type { TeacherGroup } from "../../services/teacher-groups";
import type { StudentBatch, BatchStudent } from "../../services/student-batches";

const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => <div className="bg-muted h-32 animate-pulse rounded" />,
});

const QUILL_MODULES = {
    toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ script: "sub" }, { script: "super" }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "clean"],
    ],
};

const QUILL_FORMATS = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "script",
    "list",
    "link",
];

function formatDateTimeLocal(isoString?: string): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getApiError(data: unknown, status: number): string {
    if (data && typeof data === "object") {
        const v = data as { detail?: unknown; message?: unknown };
        if (typeof v.detail === "string") return v.detail;
        if (Array.isArray(v.detail)) {
            const msgs = v.detail.flatMap((i) =>
                i && typeof i === "object" && "msg" in i ? [String(i.msg)] : [],
            );
            if (msgs.length > 0) return msgs.join(", ");
        }
        if (typeof v.message === "string") return v.message;
    }
    return `Server returned error status ${status}`;
}

type TestSeriesEditorProps = {
    series: TestSeries;
    availableQuestions: Question[];
    topics: Topic[];
    organizationUsers: User[];
    teacherGroups?: TeacherGroup[];
    studentBatches?: StudentBatch[];
    userId: number;
    userRole?: string;
    userOrgId?: number;
};

export default function TestSeriesEditor({
    series,
    availableQuestions,
    topics,
    organizationUsers,
    teacherGroups = [],
    studentBatches = [],
    userId,
    userRole,
    userOrgId,
}: TestSeriesEditorProps) {
    const router = useRouter();
    const [localQuestions, setLocalQuestions] = useState<Question[]>(availableQuestions);
    const [linkedQuestionIds, setLinkedQuestionIds] = useState<number[]>(series.questions?.map(q => q.question_id) || []);

    // Content Tabs state
    const [activeTab, setActiveTab] = useState<"details" | "questions" | "batches" | "students">("details");
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>(series.student_ids ?? []);
    const [batchSearchQuery, setBatchSearchQuery] = useState("");
    const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
    const [batchStudentsMap, setBatchStudentsMap] = useState<Record<number, BatchStudent[]>>({});
    const [loadingBatchStudents, setLoadingBatchStudents] = useState<Record<number, boolean>>({});

    // Students Tab pagination & search states (5 per page, desc order)
    const [studentPage, setStudentPage] = useState(1);
    const [studentSearchInput, setStudentSearchInput] = useState("");
    const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");
    const [paginatedStudents, setPaginatedStudents] = useState<User[]>([]);
    const [studentTotalCount, setStudentTotalCount] = useState(0);
    const [studentTotalPages, setStudentTotalPages] = useState(1);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    // Form metadata states
    const [name, setName] = useState(series.name);
    const [accessType, setAccessType] = useState(series.access_type);
    const isPrivateTest = accessType === "private";

    useEffect(() => {
        if (!isPrivateTest && (activeTab === "batches" || activeTab === "students")) {
            setActiveTab("details");
        }
    }, [isPrivateTest, activeTab]);
    const [teacherGroupId, setTeacherGroupId] = useState<number | null>(series.teacher_group_id ?? null);
    const [supervisorId, setSupervisorId] = useState<number | null>(series.supervisor_id ?? null);
    const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>(() => {
        if (series.batch_ids && series.batch_ids.length > 0) return series.batch_ids;
        if (series.batch_id) return [series.batch_id];
        return [];
    });

    // Automatically load students for selected batches to know all batch student IDs
    useEffect(() => {
        selectedBatchIds.forEach((bId) => {
            if (!batchStudentsMap[bId] && !loadingBatchStudents[bId]) {
                setLoadingBatchStudents((prev) => ({ ...prev, [bId]: true }));
                fetch(`/api/backend/student-batches/${bId}/students`)
                    .then((res) => (res.ok ? res.json() : []))
                    .then((data) => {
                        setBatchStudentsMap((prev) => ({ ...prev, [bId]: data }));
                    })
                    .catch(() => {})
                    .finally(() => {
                        setLoadingBatchStudents((prev) => ({ ...prev, [bId]: false }));
                    });
            }
        });
    }, [selectedBatchIds]);

    // Keep track of all student IDs that belong to currently selected batches
    const batchStudentIdsSet = useMemo(() => {
        const set = new Set<number>();
        for (const bId of selectedBatchIds) {
            const list = batchStudentsMap[bId];
            if (list) {
                for (const s of list) {
                    set.add(s.student_id ?? s.id);
                }
            }
        }
        return set;
    }, [selectedBatchIds, batchStudentsMap]);

    // The number only show: selected student - batch student
    const effectiveSelectedStudentCount = useMemo(() => {
        return selectedStudentIds.filter((id) => !batchStudentIdsSet.has(id)).length;
    }, [selectedStudentIds, batchStudentIdsSet]);

    const [validUntil, setValidUntil] = useState(series.valid_until);
    
    // Auto-close heuristic states for native datetime-local
    const lastDateRef = useRef(formatDateTimeLocal(series.valid_until));
    const isTypingRef = useRef(false);

    const [durationSeconds, setDurationSeconds] = useState(series.duration_seconds);
    const [isActive, setIsActive] = useState(series.is_active !== false);
    const [busy, setBusy] = useState(false);
    const [newInviteToken, setNewInviteToken] = useState<string | null>(series.invite_token);
    const [origin, setOrigin] = useState("");

    // Filter teacher groups by organization
    const availableTeacherGroups = useMemo(() => {
        const targetOrgId = series.org_id || userOrgId;
        if (!targetOrgId) return teacherGroups;
        return teacherGroups.filter((tg) => tg.org_id === targetOrgId);
    }, [teacherGroups, series.org_id, userOrgId]);

    // Filter student batches by organization
    const availableStudentBatches = useMemo(() => {
        const targetOrgId = series.org_id || userOrgId;
        if (!targetOrgId) return studentBatches;
        return studentBatches.filter((b) => b.org_id === targetOrgId);
    }, [studentBatches, series.org_id, userOrgId]);

    // Modal / Drawer controls
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

    // Filter controls for adding existing questions
    const [searchQuery, setSearchQuery] = useState("");
    const [topicFilter, setTopicFilter] = useState("");

    // Create question form states
    const [newQText, setNewQText] = useState("");
    const [newQMarks, setNewQMarks] = useState("1");
    const [newQTopicId, setNewQTopicId] = useState("");
    const [newQOptions, setNewQOptions] = useState([
        { ans: "", is_correct: true },
        { ans: "", is_correct: false },
        { ans: "", is_correct: false },
        { ans: "", is_correct: false },
    ]);
    const [createBusy, setCreateBusy] = useState(false);

    // Bulk upload states
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkJsonText, setBulkJsonText] = useState("");
    const [bulkFileLoading, setBulkFileLoading] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (typeof window !== "undefined") setOrigin(window.location.origin);
    }, []);

    // Derived states
    const linkedQuestions = useMemo(() => {
        return linkedQuestionIds.flatMap((id) => {
            const q = localQuestions.find((item) => item.id === id);
            return q ? [q] : [];
        });
    }, [linkedQuestionIds, localQuestions]);

    const totalMarks = useMemo(() => {
        return linkedQuestions.reduce((sum, q) => sum + parseFloat(q.marks), 0);
    }, [linkedQuestions]);

    const searchableQuestions = useMemo(() => {
        let result = localQuestions;
        if (topicFilter) {
            result = result.filter((q) => q.topic_id === Number(topicFilter));
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((q) => {
                const plain = sanitizeHtml(q.question, { allowedTags: [] }).toLowerCase();
                return plain.includes(query) || String(q.id).includes(query);
            });
        }
        return result;
    }, [localQuestions, searchQuery, topicFilter]);

    // Fetch paginated students (5 per page in desc order)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedStudentSearch(studentSearchInput);
            setStudentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [studentSearchInput]);

    const fetchStudents = useCallback(async (page: number, search: string, batchIds: number[]) => {
        setIsLoadingStudents(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "5",
                sort_order: "desc",
                exclude_batch_ids: batchIds.join(","),
            });
            if (search.trim()) params.set("q", search.trim());

            const res = await fetch(`/api/backend/test-series/${series.id}/students?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPaginatedStudents(data.items || []);
                setStudentTotalCount(data.total || 0);
                setStudentTotalPages(data.total_pages || 1);
            } else {
                let filtered = (organizationUsers || []).filter((u) => u.role === 3).sort((a, b) => b.id - a.id);
                if (search.trim()) {
                    const q = search.toLowerCase();
                    filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
                }
                setStudentTotalCount(filtered.length);
                setStudentTotalPages(Math.max(1, Math.ceil(filtered.length / 5)));
                const offset = (page - 1) * 5;
                setPaginatedStudents(filtered.slice(offset, offset + 5));
            }
        } catch {
            let filtered = (organizationUsers || []).filter((u) => u.role === 3).sort((a, b) => b.id - a.id);
            if (search.trim()) {
                const q = search.toLowerCase();
                filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
            }
            setStudentTotalCount(filtered.length);
            setStudentTotalPages(Math.max(1, Math.ceil(filtered.length / 5)));
            const offset = (page - 1) * 5;
            setPaginatedStudents(filtered.slice(offset, offset + 5));
        } finally {
            setIsLoadingStudents(false);
        }
    }, [series.id, organizationUsers]);

    useEffect(() => {
        setStudentPage(1);
    }, [selectedBatchIds]);

    useEffect(() => {
        fetchStudents(studentPage, debouncedStudentSearch, selectedBatchIds);
    }, [fetchStudents, studentPage, debouncedStudentSearch, selectedBatchIds]);

    const searchableBatches = useMemo(() => {
        let batches = availableStudentBatches;
        if (batchSearchQuery.trim()) {
            const query = batchSearchQuery.toLowerCase();
            batches = batches.filter((b) => b.name.toLowerCase().includes(query));
        }
        return batches;
    }, [availableStudentBatches, batchSearchQuery]);

    async function toggleExpandBatch(bId: number) {
        if (expandedBatchId === bId) {
            setExpandedBatchId(null);
            return;
        }
        setExpandedBatchId(bId);
        if (!batchStudentsMap[bId] && !loadingBatchStudents[bId]) {
            setLoadingBatchStudents((prev) => ({ ...prev, [bId]: true }));
            try {
                const res = await fetch(`/api/backend/student-batches/${bId}/students`);
                if (res.ok) {
                    const data = await res.json();
                    setBatchStudentsMap((prev) => ({ ...prev, [bId]: data }));
                }
            } catch {
                // handle gracefully
            } finally {
                setLoadingBatchStudents((prev) => ({ ...prev, [bId]: false }));
            }
        }
    }

    function toggleQuestion(id: number) {
        setLinkedQuestionIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((item) => item !== id);
            } else {
                return [...prev, id];
            }
        });
    }

    // Position updates
    function moveUp(index: number) {
        if (index === 0) return;
        setLinkedQuestionIds((prev) => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index - 1];
            next[index - 1] = temp;
            return next;
        });
    }

    function moveDown(index: number) {
        if (index === linkedQuestionIds.length - 1) return;
        setLinkedQuestionIds((prev) => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[index + 1];
            next[index + 1] = temp;
            return next;
        });
    }

    function removeQuestion(id: number) {
        setLinkedQuestionIds((prev) => prev.filter((item) => item !== id));
    }

    function toggleBatch(bId: number, bName?: string) {
        setSelectedBatchIds((prev) => {
            if (prev.includes(bId)) {
                if (bName) toast.info(`Unassigned ${bName}`);
                return prev.filter((id) => id !== bId);
            } else {
                if (bName) toast.success(`Assigned ${bName} to test series.`);
                return [...prev, bId];
            }
        });
    }

    function selectAllFilteredBatches() {
        const toAdd = searchableBatches.map((b) => b.id);
        setSelectedBatchIds((prev) => Array.from(new Set([...prev, ...toAdd])));
        toast.success(`Assigned ${toAdd.length} batches.`);
    }

    function clearFilteredBatches() {
        const toRemove = searchableBatches.map((b) => b.id);
        setSelectedBatchIds((prev) => prev.filter((id) => !toRemove.includes(id)));
        toast.info("Unassigned filtered batches.");
    }

    // Save full series
    async function handleSaveChanges(e?: FormEvent) {
        if (e) e.preventDefault();
        const validUntilDate = new Date(validUntil);
        if (Number.isNaN(validUntilDate.getTime()) || validUntilDate.getTime() <= Date.now()) {
            toast.error("Valid until must be a future date and time.");
            return;
        }
        if (durationSeconds <= 0) {
            toast.error("Duration must be greater than zero.");
            return;
        }

        setBusy(true);
        try {
            const res = await fetch(`/api/backend/test-series/${series.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    access_type: accessType,
                    teacher_group_id: teacherGroupId,
                    supervisor_id: supervisorId,
                    batch_id: selectedBatchIds[0] ?? null,
                    batch_ids: selectedBatchIds,
                    valid_until: validUntilDate.toISOString(),
                    duration_seconds: durationSeconds,
                    questions: linkedQuestionIds.map(id => {
                        const originalQ = series.questions?.find(q => q.question_id === id);
                        const localQ = localQuestions.find(q => q.id === id);
                        return {
                            question_id: id,
                            marks: originalQ?.marks ?? (localQ ? parseFloat(localQ.marks) : 1),
                            negative_marks: originalQ?.negative_marks ?? 0,
                        };
                    }),
                    is_active: isActive,
                    student_ids: selectedStudentIds.filter((id) => !batchStudentIdsSet.has(id)),
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(data, res.status));

            setNewInviteToken(data.invite_token ?? null);
            toast.success("Test series saved successfully!");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to save test series.");
        } finally {
            setBusy(false);
        }
    }

    // Create & Add Question Handler
    async function handleCreateQuestion(e: FormEvent) {
        e.preventDefault();
        const plainText = newQText.replace(/<[^>]*>/g, "").trim();
        if (!plainText || newQOptions.some((opt) => !opt.ans.trim())) {
            toast.error("Complete the question text and all option fields.");
            return;
        }
        const marksNum = Number(newQMarks);
        if (!Number.isFinite(marksNum) || marksNum <= 0) {
            toast.error("Marks must be greater than zero.");
            return;
        }

        setCreateBusy(true);
        try {
            const res = await fetch("/api/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: newQText,
                    marks: marksNum,
                    is_active: true,
                    topic_id: newQTopicId ? Number(newQTopicId) : null,
                    options: newQOptions.map((opt) => ({
                        ans: opt.ans.trim(),
                        is_correct: opt.is_correct,
                    })),
                }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message ?? "Unable to create question.");

            // Append to local states
            setLocalQuestions((prev) => [...prev, result]);
            setLinkedQuestionIds((prev) => [...prev, result.id]);

            toast.success("New question created and added!");
            // Reset form
            setNewQText("");
            setNewQMarks("1");
            setNewQTopicId("");
            setNewQOptions([
                { ans: "", is_correct: true },
                { ans: "", is_correct: false },
                { ans: "", is_correct: false },
                { ans: "", is_correct: false },
            ]);
            setIsCreateModalOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Unable to create question.");
        } finally {
            setCreateBusy(false);
        }
    }

    const AI_PROMPT_TEMPLATE = `Generate a JSON array of multiple-choice questions for an online assessment in the exact format specified below.
Each question must be an object with the following schema:
- question: string (can contain basic HTML tags like <p>, <strong>, <sub>, <sup> for scientific/math formatting)
- marks: number (e.g., 1 or 2)
- is_active: true
- topic_id: number | null (the database ID of the topic, or null if not applicable)
- options: an array of exactly 4 options. Each option must have:
  - ans: string (the text of the answer option)
  - is_correct: boolean (exactly one option in the array must be true, the other three must be false)

Example Format:
[
  {
    "question": "<p>What is the chemical formula for water?</p>",
    "marks": 1,
    "is_active": true,
    "topic_id": 1,
    "options": [
      { "ans": "H2O", "is_correct": true },
      { "ans": "CO2", "is_correct": false },
      { "ans": "O2", "is_correct": false },
      { "ans": "H2", "is_correct": false }
    ]
  }
]

Please generate 5 high-quality questions. Respond with the raw JSON array ONLY. Do not write any markdown code blocks, explanation text, or introductions.`;

    function copyAiPrompt() {
        navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
        toast.success("AI Prompt template copied to clipboard! Paste it into ChatGPT.");
    }

    const BULK_TEMPLATE_EXAMPLE = JSON.stringify(
        [
            {
                question: "<p>Sample question text here...</p>",
                marks: 2,
                is_active: true,
                options: [
                    { ans: "Correct option answer", is_correct: true },
                    { ans: "Incorrect option answer A", is_correct: false },
                    { ans: "Incorrect option answer B", is_correct: false },
                    { ans: "Incorrect option answer C", is_correct: false }
                ]
            }
        ],
        null,
        2
    );

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setBulkFileLoading(true);
        setJsonError(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                // Try parsing to validate structure
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) throw new Error("JSON must be an array of questions.");
                setBulkJsonText(JSON.stringify(parsed, null, 2));
                toast.success("JSON file loaded successfully!");
            } catch (err) {
                setJsonError(err instanceof Error ? err.message : "Malformed JSON file.");
                toast.error("Malformed JSON file.");
            } finally {
                setBulkFileLoading(false);
            }
        };
        reader.onerror = () => {
            setJsonError("Failed to read file.");
            setBulkFileLoading(false);
        };
        reader.readAsText(file);
    }

    async function handleBulkUploadSubmit(e: FormEvent) {
        e.preventDefault();
        setJsonError(null);
        let parsedPayload: any[] = [];
        try {
            parsedPayload = JSON.parse(bulkJsonText);
            if (!Array.isArray(parsedPayload)) {
                throw new Error("JSON must be an array of questions.");
            }
            if (parsedPayload.length === 0) {
                throw new Error("JSON array cannot be empty.");
            }
            // Basic layout verification
            parsedPayload.forEach((item, idx) => {
                if (typeof item !== "object" || !item) {
                    throw new Error(`Item at index ${idx} is not an object.`);
                }
                const plainText = String(item.question ?? "").replace(/<[^>]*>/g, "").trim();
                if (!plainText) {
                    throw new Error(`Item at index ${idx} has no question text.`);
                }
                const mVal = Number(item.marks);
                if (!Number.isFinite(mVal) || mVal <= 0) {
                    throw new Error(`Item at index ${idx} has invalid marks (must be > 0).`);
                }
                if (!Array.isArray(item.options) || item.options.length < 2) {
                    throw new Error(`Item at index ${idx} must have at least 2 option items.`);
                }
                if (item.options.some((opt: any) => !String(opt.ans ?? "").trim())) {
                    throw new Error(`Item at index ${idx} has empty option text.`);
                }
                const correctCount = item.options.filter((opt: any) => opt.is_correct).length;
                if (correctCount !== 1) {
                    throw new Error(`Item at index ${idx} must have exactly one correct option.`);
                }
            });
        } catch (err) {
            setJsonError(err instanceof Error ? err.message : "Malformed JSON.");
            toast.error(err instanceof Error ? err.message : "Malformed JSON.");
            return;
        }

        setBulkBusy(true);
        try {
            const res = await fetch("/api/backend/questions/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    parsedPayload.map((item) => ({
                        question: String(item.question),
                        marks: Number(item.marks),
                        is_active: item.is_active !== false,
                        topic_id: item.topic_id ? Number(item.topic_id) : null,
                        options: item.options.map((opt: any) => ({
                            ans: String(opt.ans).trim(),
                            is_correct: !!opt.is_correct,
                        })),
                    }))
                ),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(getApiError(data, res.status));

            const resultList = data as Question[];
            // Append to local states
            setLocalQuestions((prev) => [...prev, ...resultList]);
            setLinkedQuestionIds((prev) => [...prev, ...resultList.map((q) => q.id)]);

            toast.success(`Successfully uploaded and linked ${resultList.length} questions!`);
            setIsBulkModalOpen(false);
            setBulkJsonText("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bulk upload failed.");
        } finally {
            setBulkBusy(false);
        }
    }

    return (
        <div className="w-full space-y-6">
            {/* Header / Nav */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/test-series" />}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configure Series</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Manage details, questions, and ordering.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-3 py-1 text-xs">
                        {linkedQuestionIds.length} question{linkedQuestionIds.length !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="px-3 py-1 text-xs">
                        {totalMarks.toFixed(2)} total marks
                    </Badge>
                </div>
            </div>

            {/* Invite Token Banner */}
            {newInviteToken && accessType === "invite_only" && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-4 animate-in fade-in duration-200">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Invite link</p>
                        <code className="mt-1 block break-all text-xs text-muted-foreground">
                            {`${origin}/student/join#token=${newInviteToken}`}
                        </code>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            navigator.clipboard.writeText(`${origin}/student/join#token=${newInviteToken}`);
                            toast.success("Copied!");
                        }}
                    >
                        Copy link
                    </Button>
                </div>
            )}

            {/* Tab Bar */}
            <div className="flex border-b overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === "details"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                >
                    <span>Details</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("questions")}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === "questions"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                >
                    <span>Questions</span>
                    <Badge variant={activeTab === "questions" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {linkedQuestionIds.length}
                    </Badge>
                </button>
                {isPrivateTest && (
                    <>
                        <button
                            type="button"
                            onClick={() => setActiveTab("batches")}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === "batches"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                        >
                            <span>Batches</span>
                            {selectedBatchIds.length > 0 ? (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-600 text-white">
                                    {selectedBatchIds.length} Unassign
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Unassigned
                                </Badge>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("students")}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === "students"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                            }`}
                        >
                            <span>Students</span>
                            {effectiveSelectedStudentCount > 0 && (
                                <Badge variant={activeTab === "students" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                    {effectiveSelectedStudentCount}
                                </Badge>
                            )}
                        </button>
                    </>
                )}
                <div className="ml-auto flex items-center gap-2 px-1">
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveChanges()}
                        disabled={busy}
                        className="h-8 px-3 text-xs"
                    >
                        {busy ? "Saving..." : "Save Changes"}
                    </Button>
                    {/* <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href="/test-series" />}
                        className="h-8 px-3 text-xs"
                    >
                        Back
                    </Button> */}
                </div>
            </div>

            {activeTab === "details" ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Series Details</CardTitle>
                            <CardDescription>Configure core configuration fields.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveChanges} className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="s-name">Series Name</Label>
                                    <Input
                                        id="s-name"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Physics Final Exam"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-access">Access Type</Label>
                                    <select
                                        id="s-access"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={accessType}
                                        onChange={(e) => setAccessType(e.target.value as "public" | "invite_only" | "private")}
                                    >
                                        <option value="public">Public — open to all</option>
                                        <option value="invite_only">Invite only — link required</option>
                                        <option value="private">Private — restricted access</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-teacher-group">Teacher Group</Label>
                                    <select
                                        id="s-teacher-group"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={teacherGroupId ?? ""}
                                        onChange={(e) => setTeacherGroupId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">None (Unassigned)</option>
                                        {(availableTeacherGroups ?? []).map((tg) => (
                                            <option key={tg.id} value={tg.id}>
                                                {tg.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-supervisor">Supervisor</Label>
                                    <select
                                        id="s-supervisor"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={supervisorId ?? ""}
                                        onChange={(e) => setSupervisorId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                        <option value="">None (Unassigned)</option>
                                        {(organizationUsers ?? []).map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-valid">Valid Until</Label>
                                    <Input
                                        id="s-valid"
                                        type="datetime-local"
                                        required
                                        value={formatDateTimeLocal(validUntil)}
                                        onKeyDown={() => {
                                            isTypingRef.current = true;
                                        }}
                                        onKeyUp={() => {
                                            setTimeout(() => {
                                                isTypingRef.current = false;
                                            }, 100);
                                        }}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setValidUntil(new Date(newVal).toISOString());
                                            
                                            if (newVal && !isTypingRef.current) {
                                                const oldVal = lastDateRef.current;
                                                if (oldVal) {
                                                    const [oldDate, oldTime] = oldVal.split("T");
                                                    const [newDate, newTime] = newVal.split("T");
                                                    if (oldDate === newDate && oldTime !== newTime) {
                                                        e.target.blur();
                                                    }
                                                }
                                                lastDateRef.current = newVal;
                                            } else if (newVal) {
                                                lastDateRef.current = newVal;
                                            }
                                        }}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-duration">Duration (minutes)</Label>
                                    <Input
                                        id="s-duration"
                                        type="number"
                                        min="1"
                                        required
                                        value={Math.round(durationSeconds / 60)}
                                        onChange={(e) => setDurationSeconds(Math.round(Number(e.target.value) * 60))}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="s-status">Status</Label>
                                    <select
                                        id="s-status"
                                        className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={isActive ? "true" : "false"}
                                        onChange={(e) => setIsActive(e.target.value === "true")}
                                    >
                                        <option value="true">Active — students can view and join</option>
                                        <option value="false">Inactive — hidden from students</option>
                                    </select>
                                </div>

                            </form>
                        </CardContent>
                    </Card>
            ) : activeTab === "questions" ? (
                    <Card className="flex flex-col h-full min-h-[450px]">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle>Questions Checklist</CardTitle>
                                <CardDescription>Arrange and structure linked questions.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsAddPanelOpen((prev) => !prev)}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    <Search className="h-3 w-3" />
                                    {isAddPanelOpen ? "Close Finder" : "Add Existing"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsBulkModalOpen(true)}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    <Upload className="h-3 w-3" />
                                    Bulk Upload
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="flex items-center gap-1 text-xs"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Create Question
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1">
                            {/* Existing questions selection drawer */}
                            {isAddPanelOpen && (
                                <div className="border bg-muted/30 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                                    <div className="flex items-center justify-between gap-4">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                            <Sparkles className="h-3 w-3 text-amber-500" />
                                            Add Questions from Database
                                        </h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Input
                                            placeholder="Search questions..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="h-8 flex-1 text-xs min-w-40"
                                        />
                                        {topics.length > 0 && (
                                            <select
                                                value={topicFilter}
                                                onChange={(e) => setTopicFilter(e.target.value)}
                                                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                            >
                                                <option value="">All Topics</option>
                                                {topics.map((t) => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        )}
                                        {searchableQuestions.length > 0 && (
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const toAdd = searchableQuestions.map((q) => q.id);
                                                        setLinkedQuestionIds((prev) => {
                                                            const union = new Set([...prev, ...toAdd]);
                                                            return [...union];
                                                        });
                                                        toast.success("Added all filtered questions.");
                                                    }}
                                                    className="h-8 px-2.5 text-xs font-medium"
                                                >
                                                    Select all
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        const toRemove = searchableQuestions.map((q) => q.id);
                                                        setLinkedQuestionIds((prev) =>
                                                            prev.filter((id) => !toRemove.includes(id))
                                                        );
                                                        toast.success("Removed all filtered questions.");
                                                    }}
                                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                >
                                                    Clear
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {searchableQuestions.length === 0 ? (
                                        <p className="text-muted-foreground text-center text-xs py-4 border border-dashed rounded-lg">
                                            No questions found.
                                        </p>
                                    ) : (
                                        <div className="max-h-52 overflow-y-auto border rounded-lg bg-card divide-y">
                                            {searchableQuestions.map((q) => {
                                                const isChecked = linkedQuestionIds.includes(q.id);
                                                const plain = sanitizeHtml(q.question, { allowedTags: [] });
                                                return (
                                                    <label
                                                        key={q.id}
                                                        htmlFor={`add-q-${q.id}`}
                                                        className={`flex cursor-pointer items-center justify-between p-2.5 gap-4 hover:bg-muted/30 transition-colors ${
                                                            isChecked ? "bg-primary/5" : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <input
                                                                id={`add-q-${q.id}`}
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleQuestion(q.id)}
                                                                className="h-4 w-4 shrink-0 accent-primary"
                                                            />
                                                            <span className="text-xs truncate min-w-0 flex-1 flex items-center gap-2">
                                                                {plain || `Question #${q.id}`}
                                                                {q.topic && (
                                                                    <span
                                                                        className="inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold text-white shrink-0"
                                                                        style={{ backgroundColor: q.topic.color }}
                                                                    >
                                                                        {q.topic.name}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Badge variant="outline" className="text-[10px] py-0">{q.marks} marks</Badge>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Linked list rendering */}
                            {linkedQuestions.length === 0 ? (
                                <div className="border border-dashed rounded-xl p-12 text-center">
                                    <p className="text-muted-foreground text-sm">
                                        No questions linked to this series yet.
                                    </p>
                                    <p className="text-muted-foreground/60 text-xs mt-1">
                                        Use "Add Existing" or "Create Question" above.
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-xl divide-y overflow-hidden bg-card">
                                    {linkedQuestions.map((q, idx) => {
                                        const plain = sanitizeHtml(q.question, { allowedTags: [] });
                                        return (
                                            <div key={q.id} className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-muted/10 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <span className="text-muted-foreground text-sm font-semibold font-mono">
                                                        {String(idx + 1).padStart(2, "0")}
                                                    </span>
                                                    <span className="text-sm truncate font-medium flex items-center gap-2">
                                                        {plain || `Question #${q.id}`}
                                                        {q.topic && (
                                                            <span
                                                                className="inline-block text-xs px-1.5 py-0.5 rounded font-semibold text-white shrink-0"
                                                                style={{ backgroundColor: q.topic.color }}
                                                            >
                                                                {q.topic.name}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="outline" className="text-sm font-bold py-0">{q.marks} marks</Badge>
                                                    <div className="flex border rounded-md">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={idx === 0}
                                                            onClick={() => moveUp(idx)}
                                                            className="h-7 w-7 rounded-none border-r last:border-r-0"
                                                            aria-label="Move question up"
                                                        >
                                                            <ArrowUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={idx === linkedQuestions.length - 1}
                                                            onClick={() => moveDown(idx)}
                                                            className="h-7 w-7 rounded-none border-r last:border-r-0"
                                                            aria-label="Move question down"
                                                        >
                                                            <ArrowDown className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeQuestion(q.id)}
                                                            className="h-7 w-7 rounded-none text-destructive hover:bg-destructive/5"
                                                            aria-label="Remove question from series"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end border-t pt-4 bg-muted/10">
                            <Button 
                                variant="outline" 
                                nativeButton={false}
                                render={<Link href={`/test-series/${series.id}/preview`} />}
                            >
                                View Questions
                            </Button>
                        </CardFooter>
                    </Card>
                ) : activeTab === "batches" ? (
                    <Card className="flex flex-col h-full min-h-[450px]">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                    Assign Student Batches
                                </CardTitle>
                                <CardDescription>
                                    Assign student batches to grant access to all students registered in those batches.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    nativeButton={false}
                                    render={<Link href="/student-batches/create" target="_blank" />}
                                    className="flex items-center gap-1.5 text-xs"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Create Batch
                                </Button>
                                {/* <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSaveChanges()}
                                    disabled={busy}
                                    className="h-8 px-3 text-xs"
                                >
                                    {busy ? "Saving..." : "Save Changes"}
                                </Button> */}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4 flex-1">
                            {/* Search Input & Action Helpers */}
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search student batches by name..."
                                        className="pl-9"
                                        value={batchSearchQuery}
                                        onChange={(e) => setBatchSearchQuery(e.target.value)}
                                    />
                                </div>
                                {searchableBatches.length > 0 && (
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={selectAllFilteredBatches}
                                            className="h-9 px-2.5 text-xs font-medium"
                                        >
                                            Select all
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={clearFilteredBatches}
                                            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Assigned Batches Banner */}
                            {selectedBatchIds.length > 0 ? (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-900 dark:text-emerald-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                                Assigned Batches ({selectedBatchIds.length})
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setSelectedBatchIds([]);
                                                toast.info("All batches unassigned.");
                                            }}
                                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        >
                                            Unassign All
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {selectedBatchIds.map((bId) => {
                                            const batchObj = availableStudentBatches.find((b) => b.id === bId);
                                            return (
                                                <span
                                                    key={bId}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                                                >
                                                    {batchObj?.name || `Batch #${bId}`}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBatch(bId, batchObj?.name)}
                                                        className="hover:text-destructive transition-colors ml-0.5"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                                    <span>No student batch is currently assigned to this test series.</span>
                                    <span className="font-medium">Select batches below to assign them.</span>
                                </div>
                            )}

                            {searchableBatches.length === 0 ? (
                                <div className="border border-dashed rounded-xl p-12 text-center">
                                    <p className="text-muted-foreground text-sm">
                                        No student batches found matching your query.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {searchableBatches.map((batch) => {
                                        const isAssigned = selectedBatchIds.includes(batch.id);
                                        const supervisorUser = organizationUsers.find((u) => u.id === batch.supervisor);
                                        const isExpanded = expandedBatchId === batch.id;
                                        const students = batchStudentsMap[batch.id] ?? [];
                                        const isLoading = loadingBatchStudents[batch.id] ?? false;

                                        return (
                                            <div
                                                key={batch.id}
                                                className={`border rounded-xl transition-all overflow-hidden ${
                                                    isAssigned
                                                        ? "border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm"
                                                        : "bg-card hover:border-muted-foreground/30"
                                                }`}
                                            >
                                                <div className="p-4 flex items-center justify-between gap-4">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            id={`batch-chk-${batch.id}`}
                                                            checked={isAssigned}
                                                            onChange={() => toggleBatch(batch.id, batch.name)}
                                                            className="h-4 w-4 mt-1 shrink-0 accent-primary rounded border-gray-300 cursor-pointer"
                                                        />
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <label
                                                                    htmlFor={`batch-chk-${batch.id}`}
                                                                    className="font-semibold text-foreground text-sm truncate cursor-pointer"
                                                                >
                                                                    {batch.name}
                                                                </label>
                                                                {isAssigned ? (
                                                                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                                                                        Assigned
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant={batch.is_active ? "secondary" : "outline"} className="text-[10px] px-2 py-0.5">
                                                                        {batch.is_active ? "Active" : "Inactive"}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                {supervisorUser && (
                                                                    <span>Supervisor: <strong className="font-medium text-foreground">{supervisorUser.name}</strong></span>
                                                                )}
                                                                <span>Created: {new Date(batch.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => toggleExpandBatch(batch.id)}
                                                            className="h-8 px-2.5 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Users className="h-3.5 w-3.5" />
                                                            {isExpanded ? "Hide Students" : "View Students"}
                                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                        </Button>

                                                        {isAssigned ? (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => toggleBatch(batch.id, batch.name)}
                                                                className="h-8 px-3 text-xs border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                                            >
                                                                Assigned
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={() => toggleBatch(batch.id, batch.name)}
                                                                className="h-8 px-3 text-xs"
                                                            >
                                                                Assign
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Students List */}
                                                {isExpanded && (
                                                    <div className="border-t bg-muted/20 p-4 space-y-2 animate-in slide-in-from-top-1 duration-150">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                Batch Students ({students.length})
                                                            </p>
                                                            <Link
                                                                href={`/student-batches/${batch.id}`}
                                                                target="_blank"
                                                                className="text-xs text-primary flex items-center gap-1 hover:underline"
                                                            >
                                                                Manage Batch <ExternalLink className="h-3 w-3" />
                                                            </Link>
                                                        </div>
                                                        {isLoading ? (
                                                            <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                                                                Loading batch students...
                                                            </div>
                                                        ) : students.length === 0 ? (
                                                            <p className="text-xs text-muted-foreground py-2 italic">
                                                                No students found in this batch.
                                                            </p>
                                                        ) : (
                                                            <div className="max-h-40 overflow-y-auto border rounded-lg bg-card divide-y">
                                                                {students.map((s) => (
                                                                    <div key={s.id} className="p-2 flex items-center justify-between text-xs">
                                                                        <span className="font-medium text-foreground">{s.name || `Student #${s.student_id}`}</span>
                                                                        <span className="text-muted-foreground">{s.email || "No email"}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                            <div>
                                <div className="flex items-center gap-2">
                                    <CardTitle>Assign Students</CardTitle>
                                    {selectedBatchIds.length > 0 && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                                            Excluding {selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? "es" : ""}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription>
                                    {selectedBatchIds.length > 0
                                        ? "Showing students not enrolled in the selected batches."
                                        : "Select students who are permitted to access this private test series."}
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {paginatedStudents.length > 0 && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const toAdd = paginatedStudents.map((s) => s.id);
                                                setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...toAdd])));
                                                toast.success(`Selected ${toAdd.length} students on this page.`);
                                            }}
                                            className="h-8 px-2.5 text-xs font-medium"
                                        >
                                            Select page
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const toRemove = paginatedStudents.map((s) => s.id);
                                                setSelectedStudentIds((prev) => prev.filter((id) => !toRemove.includes(id)));
                                                toast.info("Cleared selections on this page.");
                                            }}
                                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            Clear page
                                        </Button>
                                    </>
                                )}
                                {effectiveSelectedStudentCount > 0 && (
                                    <Badge variant="secondary" className="px-3 py-1 text-xs">
                                        {effectiveSelectedStudentCount} selected
                                    </Badge>
                                )}
                                {/* <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSaveChanges()}
                                    disabled={busy}
                                    className="h-8 px-3 text-xs"
                                >
                                    {busy ? "Saving..." : "Save Changes"}
                                </Button> */}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search students by name or email..."
                                    className="pl-9 pr-9"
                                    value={studentSearchInput}
                                    onChange={(e) => setStudentSearchInput(e.target.value)}
                                />
                                {isLoadingStudents && (
                                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            
                            {isLoadingStudents ? (
                                <div className="border border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading students...</p>
                                </div>
                            ) : paginatedStudents.length === 0 ? (
                                <div className="border border-dashed rounded-xl p-12 text-center">
                                    <p className="text-muted-foreground text-sm">
                                        {selectedBatchIds.length > 0
                                            ? "All eligible students already belong to the selected batch(es)."
                                            : "No students found matching your search."}
                                    </p>
                                </div>
                            ) : (
                                <div className="border rounded-xl divide-y bg-card shadow-sm overflow-hidden">
                                    {paginatedStudents.map((student) => {
                                        const isChecked = selectedStudentIds.includes(student.id);
                                        return (
                                            <label
                                                key={student.id}
                                                htmlFor={`student-${student.id}`}
                                                className={`flex cursor-pointer items-center p-3.5 gap-4 hover:bg-muted/30 transition-colors ${
                                                    isChecked ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                <input
                                                    id={`student-${student.id}`}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setSelectedStudentIds((prev) =>
                                                            prev.includes(student.id)
                                                                ? prev.filter((id) => id !== student.id)
                                                                : [...prev, student.id]
                                                        );
                                                    }}
                                                    className="h-4 w-4 shrink-0 accent-primary rounded border-gray-300 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-foreground text-sm truncate">
                                                            {student.name}
                                                        </p>
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground font-mono">
                                                            ID #{student.id}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                        {student.email}
                                                    </p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination Footer */}
                            {studentTotalCount > 0 && (
                                <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <div>
                                        Showing <strong>{(studentPage - 1) * 5 + 1}</strong> -{" "}
                                        <strong>{Math.min(studentPage * 5, studentTotalCount)}</strong> of{" "}
                                        <strong>{studentTotalCount}</strong> students
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={studentPage <= 1 || isLoadingStudents}
                                            onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                                            className="h-8 px-2.5 text-xs flex items-center gap-1"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                            Previous
                                        </Button>

                                        <div className="flex items-center gap-1 px-1">
                                            {Array.from({ length: studentTotalPages }, (_, i) => i + 1)
                                                .filter((p) => {
                                                    return p === 1 || p === studentTotalPages || Math.abs(p - studentPage) <= 1;
                                                })
                                                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                                                        acc.push("...");
                                                    }
                                                    acc.push(p);
                                                    return acc;
                                                }, [])
                                                .map((item, idx) => (
                                                    typeof item === "string" ? (
                                                        <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">...</span>
                                                    ) : (
                                                        <Button
                                                            key={item}
                                                            type="button"
                                                            size="sm"
                                                            variant={studentPage === item ? "default" : "outline"}
                                                            onClick={() => setStudentPage(item)}
                                                            className="h-8 w-8 p-0 text-xs"
                                                            disabled={isLoadingStudents}
                                                        >
                                                            {item}
                                                        </Button>
                                                    )
                                                ))}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={studentPage >= studentTotalPages || isLoadingStudents}
                                            onClick={() => setStudentPage((p) => Math.min(studentTotalPages, p + 1))}
                                            className="h-8 px-2.5 text-xs flex items-center gap-1"
                                        >
                                            Next
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

            {/* Create Question Modal */}
            {isCreateModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
                    onClick={() => setIsCreateModalOpen(false)}
                >
                    <div
                        className="relative bg-background border rounded-xl shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
                            <div>
                                <h3 className="text-lg font-semibold leading-none tracking-tight">Create & Link Question</h3>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                    The newly created question will automatically be added to this series.
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full shrink-0"
                                onClick={() => setIsCreateModalOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleCreateQuestion} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                {/* Question Text */}
                                <div>
                                    <Label className="mb-2 block font-medium">Question Description</Label>
                                    <div className="overflow-hidden rounded-lg bg-white border text-black">
                                        <ReactQuill
                                            theme="snow"
                                            value={newQText}
                                            onChange={setNewQText}
                                            placeholder="Write your question text here..."
                                            modules={QUILL_MODULES}
                                            formats={QUILL_FORMATS}
                                        />
                                    </div>
                                </div>

                                {/* Marks & Topic */}
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="q-marks">Marks</Label>
                                        <Input
                                            id="q-marks"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            required
                                            value={newQMarks}
                                            onChange={(e) => setNewQMarks(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="q-topic">Topic</Label>
                                        <select
                                            id="q-topic"
                                            className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            value={newQTopicId}
                                            onChange={(e) => setNewQTopicId(e.target.value)}
                                        >
                                            <option value="">No topic</option>
                                            {topics.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Answers options */}
                                <fieldset className="space-y-3 border-t pt-4">
                                    <legend className="mb-2 text-sm font-semibold">Answer options</legend>
                                    <RadioGroup
                                        value={String(newQOptions.findIndex((o) => o.is_correct))}
                                        onValueChange={(val) =>
                                            setNewQOptions((curr) =>
                                                curr.map((opt, idx) => ({
                                                    ...opt,
                                                    is_correct: idx === Number(val),
                                                }))
                                            )
                                        }
                                        className="space-y-3"
                                    >
                                        {newQOptions.map((opt, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <RadioGroupItem value={String(index)} aria-label={`Option ${index + 1} is correct`} />
                                                <Input
                                                    value={opt.ans}
                                                    onChange={(e) =>
                                                        setNewQOptions((curr) =>
                                                            curr.map((item, idx) =>
                                                                idx === index ? { ...item, ans: e.target.value } : item
                                                            )
                                                        )
                                                    }
                                                    placeholder={`Option ${index + 1}`}
                                                    className="flex-1"
                                                    required
                                                />
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </fieldset>
                            </div>

                            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end gap-3 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    disabled={createBusy}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createBusy}>
                                    {createBusy ? "Creating question..." : "Create Question"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Upload Questions Modal */}
            {isBulkModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
                    onClick={() => setIsBulkModalOpen(false)}
                >
                    <div
                        className="relative bg-background border rounded-xl shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/20">
                            <div>
                                <h3 className="text-lg font-semibold leading-none tracking-tight">Bulk Upload Questions</h3>
                                <p className="text-sm text-muted-foreground mt-1.5">
                                    Upload a JSON file or paste a JSON array of questions to bulk-create and link them.
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full shrink-0"
                                onClick={() => setIsBulkModalOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <form onSubmit={handleBulkUploadSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5 flex-1">
                                {/* JSON file upload */}
                                <div className="space-y-2">
                                    <Label className="font-medium">Upload JSON File</Label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".json"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={bulkFileLoading}
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <Upload className="h-4 w-4" />
                                            {bulkFileLoading ? "Reading file..." : "Choose JSON File"}
                                        </Button>
                                        <span className="text-muted-foreground text-xs">
                                            Or paste your JSON array directly into the editor.
                                        </span>
                                    </div>
                                </div>

                                {/* Text area JSON input */}
                                <div className="space-y-2 flex-1 flex flex-col min-h-64">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="bulk-json" className="font-medium">Question Array JSON</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={copyAiPrompt}
                                                className="h-7 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/5"
                                            >
                                                Copy AI Prompt
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => {
                                                    setBulkJsonText(BULK_TEMPLATE_EXAMPLE);
                                                    toast.success("Template pasted into editor!");
                                                }}
                                                className="h-7 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/5"
                                            >
                                                Paste Template Example
                                            </Button>
                                        </div>
                                    </div>
                                    <textarea
                                        id="bulk-json"
                                        value={bulkJsonText}
                                        onChange={(e) => setBulkJsonText(e.target.value)}
                                        placeholder={`[\n  {\n    "question": "<p>Example Question</p>",\n    "marks": 2,\n    "options": [\n      { "ans": "Ans A", "is_correct": true },\n      ...\n    ]\n  }\n]`}
                                        className="w-full flex-1 min-h-48 font-mono text-xs p-3 rounded-lg border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-ring resize-none overflow-y-auto"
                                        required
                                    />
                                </div>

                                {/* Display live parsing errors */}
                                {jsonError && (
                                    <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-xs text-destructive font-medium">
                                        Error: {jsonError}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end gap-3 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsBulkModalOpen(false)}
                                    disabled={bulkBusy}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={bulkBusy}>
                                    {bulkBusy ? "Uploading questions..." : "Upload questions"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
