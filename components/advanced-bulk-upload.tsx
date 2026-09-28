"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Copy, X, Layers } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Topic } from "@/app/services/topics";
import { TestSeries } from "@/app/services/test-series";

// ─── Types ─────────────────────────────────────────────────────────────────

type OptionDraft = { ans: string; is_correct: boolean };

type QuestionDraft = {
    id: string; // local key only
    question: string;
    marks: string;
    is_active: boolean;
    topic_id?: string;
    options: OptionDraft[];
};

type ValidationError = { index: number; message: string };

// ─── Constants ─────────────────────────────────────────────────────────────

const EXAMPLE_JSON = JSON.stringify(
    [
        {
            question: "<p>What is the capital of France?</p>",
            marks: 1,
            is_active: true,
            topic_id: 1,
            options: [
                { ans: "Paris", is_correct: true },
                { ans: "Berlin", is_correct: false },
                { ans: "Rome", is_correct: false },
                { ans: "Madrid", is_correct: false },
            ],
        },
        {
            question: "<p>Which planet is closest to the Sun?</p>",
            marks: 2,
            is_active: true,
            topic_id: 2,
            options: [
                { ans: "Venus", is_correct: false },
                { ans: "Mercury", is_correct: true },
                { ans: "Earth", is_correct: false },
                { ans: "Mars", is_correct: false },
            ],
        },
    ],
    null,
    2,
);

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

function makeBlankQuestion(): QuestionDraft {
    return {
        id: crypto.randomUUID(),
        question: "",
        marks: "1",
        is_active: true,
        topic_id: "",
        options: [
            { ans: "", is_correct: true },
            { ans: "", is_correct: false },
            { ans: "", is_correct: false },
            { ans: "", is_correct: false },
        ],
    };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateDrafts(drafts: QuestionDraft[]): ValidationError[] {
    const errors: ValidationError[] = [];
    drafts.forEach((q, i) => {
        const plainText = q.question.replace(/<[^>]*>/g, "").trim();
        if (!plainText) errors.push({ index: i, message: "Question text is required." });
        const marks = parseFloat(q.marks);
        if (!Number.isFinite(marks) || marks <= 0) errors.push({ index: i, message: "Marks must be > 0." });
        if (q.options.length < 2) errors.push({ index: i, message: "At least 2 options required." });
        if (q.options.some((o) => !o.ans.trim())) errors.push({ index: i, message: "All option texts must be filled." });
        const correctCount = q.options.filter((o) => o.is_correct).length;
        if (correctCount !== 1) errors.push({ index: i, message: "Exactly one option must be marked correct." });
    });
    return errors;
}

// ─── Helper to parse raw JSON into QuestionDraft[] ──────────────────────────

function parseJsonToDrafts(raw: string): QuestionDraft[] {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("JSON must be an array of questions.");
    return (parsed as Record<string, unknown>[]).map((item, i) => {
        if (typeof item !== "object" || item === null) throw new Error(`Item ${i + 1} is not an object.`);
        const opts = item.options;
        if (!Array.isArray(opts) || opts.length < 2) throw new Error(`Item ${i + 1}: "options" must be an array with at least 2 items.`);
        return {
            id: crypto.randomUUID(),
            question: String(item.question ?? ""),
            marks: String(item.marks ?? "1"),
            is_active: item.is_active !== false,
            topic_id: item.topic_id ? String(item.topic_id) : "",
            options: (opts as Record<string, unknown>[]).map((o, oi) => ({
                ans: String(o.ans ?? ""),
                is_correct: o.is_correct === true,
            })),
        };
    });
}

// ─── Question Card (builder mode) ───────────────────────────────────────────

function QuestionCard({
    q,
    index,
    error,
    onChange,
    onRemove,
    canRemove,
    topics,
}: {
    q: QuestionDraft;
    index: number;
    error?: string;
    onChange: (updated: QuestionDraft) => void;
    onRemove: () => void;
    canRemove: boolean;
    topics: Topic[];
}) {
    function setField<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
        onChange({ ...q, [key]: value });
    }

    function setOptionAns(oi: number, ans: string) {
        const opts = q.options.map((o, idx) => (idx === oi ? { ...o, ans } : o));
        setField("options", opts);
    }

    function setCorrect(oi: number) {
        const opts = q.options.map((o, idx) => ({ ...o, is_correct: idx === oi }));
        setField("options", opts);
    }

    function addOption() {
        setField("options", [...q.options, { ans: "", is_correct: false }]);
    }

    function removeOption(oi: number) {
        if (q.options.length <= 2) return;
        const remaining = q.options.filter((_, idx) => idx !== oi);
        if (!remaining.some((o) => o.is_correct)) remaining[0].is_correct = true;
        setField("options", remaining);
    }

    return (
        <Card className={`relative overflow-hidden ${error ? "border-destructive" : ""}`}>
            {/* numbered stripe */}
            <div className="absolute inset-y-0 left-0 flex w-10 items-center justify-center rounded-l-xl bg-muted/60 text-sm font-bold text-muted-foreground">
                {index + 1}
            </div>

            <div className="ml-10">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Question {index + 1}
                        </CardTitle>
                        {canRemove && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive h-7 text-xs"
                                onClick={onRemove}
                            >
                                Remove
                            </Button>
                        )}
                    </div>
                    {error && <p className="text-destructive text-xs">{error}</p>}
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Question text */}
                    <div className="space-y-1.5">
                        <Label htmlFor={`q-${q.id}-text`}>Question text (HTML supported)</Label>
                        <textarea
                            id={`q-${q.id}-text`}
                            rows={3}
                            value={q.question}
                            onChange={(e) => setField("question", e.target.value)}
                            placeholder="<p>Enter your question here…</p>"
                            className="border-input bg-background w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                        />
                    </div>

                    {/* Marks + Topic + Active */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`q-${q.id}-marks`}>Marks</Label>
                            <Input
                                id={`q-${q.id}-marks`}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={q.marks}
                                onChange={(e) => setField("marks", e.target.value)}
                                className="w-24"
                            />
                        </div>

                        <div className="space-y-1.5 w-48">
                            <Label htmlFor={`q-${q.id}-topic`}>Topic (Optional)</Label>
                            <select
                                id={`q-${q.id}-topic`}
                                value={q.topic_id ?? ""}
                                onChange={(e) => setField("topic_id", e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Default (Inherit global or none)</option>
                                {topics.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 text-sm mt-5">
                            <input
                                type="checkbox"
                                checked={q.is_active}
                                onChange={(e) => setField("is_active", e.target.checked)}
                                className="h-4 w-4 accent-primary"
                            />
                            Active
                        </label>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            Options{" "}
                            <span className="text-muted-foreground text-xs font-normal">
                                (● = correct answer)
                            </span>
                        </p>
                        {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={opt.is_correct}
                                    onChange={() => setCorrect(oi)}
                                    aria-label={`Mark option ${oi + 1} as correct`}
                                    className="h-4 w-4 shrink-0 accent-primary"
                                />
                                <Input
                                    value={opt.ans}
                                    onChange={(e) => setOptionAns(oi, e.target.value)}
                                    placeholder={`Option ${oi + 1}`}
                                    className={`flex-1 ${opt.is_correct ? "border-primary bg-primary/5" : ""}`}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive h-8 text-xs shrink-0"
                                    disabled={q.options.length <= 2}
                                    onClick={() => removeOption(oi)}
                                >
                                    ✕
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-1 h-8 text-xs"
                            onClick={addOption}
                        >
                            + Add option
                        </Button>
                    </div>
                </CardContent>
            </div>
        </Card>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type Mode = "builder" | "json";
type TestSeriesOption = "none" | "existing" | "new";

export default function AdvancedBulkUpload({
    topics = [],
    testSeries = [],
    preselectedTestSeriesId,
    onSuccess,
    onCancel,
}: {
    topics?: Topic[];
    testSeries?: TestSeries[];
    preselectedTestSeriesId?: number;
    onSuccess?: (newQuestions: any[], assignedSeriesId?: number) => void;
    onCancel?: () => void;
}) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [mode, setMode] = useState<Mode>("builder");
    const [drafts, setDrafts] = useState<QuestionDraft[]>([makeBlankQuestion()]);
    const [globalTopicId, setGlobalTopicId] = useState<string>("");
    const [jsonText, setJsonText] = useState("");
    const [jsonError, setJsonError] = useState("");
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{
        created: number;
        ids: number[];
        seriesId?: number;
        seriesName?: string;
    } | null>(null);

    // ── Test Series Assignment state ───────────────────────────────────────
    const [tsOption, setTsOption] = useState<TestSeriesOption>(preselectedTestSeriesId ? "existing" : "none");
    const [selectedTsId, setSelectedTsId] = useState<string>(preselectedTestSeriesId ? String(preselectedTestSeriesId) : "");
    const [newTsName, setNewTsName] = useState<string>("");
    const [newTsAccessType, setNewTsAccessType] = useState<"public" | "invite_only" | "private">("public");
    const [newTsDuration, setNewTsDuration] = useState<string>("60");

    // ── AI Prompt Modal state ──────────────────────────────────────────────
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [promptSubject, setPromptSubject] = useState("");
    const [promptTopic, setPromptTopic] = useState("");
    const [promptMarks, setPromptMarks] = useState("1");
    const [promptNumQuestions, setPromptNumQuestions] = useState("5");
    const [promptAdditional, setPromptAdditional] = useState("");

    // ── JSON mode helpers ──────────────────────────────────────────────────

    function loadFile(file: File) {
        const reader = new FileReader();
        reader.onload = (e) => setJsonText(String(e.target?.result ?? ""));
        reader.readAsText(file);
    }

    function parseJson() {
        setJsonError("");
        try {
            const parsed = parseJsonToDrafts(jsonText);
            setDrafts(parsed);
            setMode("builder");
            toast.success(`Loaded ${parsed.length} question${parsed.length !== 1 ? "s" : ""} — review and submit.`);
        } catch (err) {
            setJsonError(err instanceof Error ? err.message : "Invalid JSON.");
        }
    }

    // ── Builder helpers ────────────────────────────────────────────────────

    function updateDraft(index: number, updated: QuestionDraft) {
        setDrafts((prev) => prev.map((q, i) => (i === index ? updated : q)));
    }

    function removeDraft(index: number) {
        setDrafts((prev) => prev.filter((_, i) => i !== index));
    }

    // ── Submit ─────────────────────────────────────────────────────────────

    async function handleSubmit() {
        const errors = validateDrafts(drafts);
        setValidationErrors(errors);
        if (errors.length > 0) {
            toast.error(`Fix ${errors.length} error${errors.length > 1 ? "s" : ""} before submitting.`);
            return;
        }

        if (tsOption === "existing" && !selectedTsId) {
            toast.error("Please select an existing Test Series.");
            return;
        }
        if (tsOption === "new" && !newTsName.trim()) {
            toast.error("Please enter a title for the new Test Series.");
            return;
        }

        setBusy(true);
        try {
            const payload = drafts.map(({ question, marks, is_active, topic_id, options }) => {
                const finalTopicId = topic_id || globalTopicId;
                return {
                    question,
                    marks: parseFloat(marks),
                    is_active,
                    topic_id: finalTopicId ? Number(finalTopicId) : null,
                    options: options.map(({ ans, is_correct }) => ({ ans: ans.trim(), is_correct })),
                };
            });

            const res = await fetch("/api/backend/questions/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                const msg =
                    typeof data?.detail === "string"
                        ? data.detail
                        : Array.isArray(data?.detail)
                        ? data.detail.map((d: { msg: string }) => d.msg).join(" ")
                        : "Bulk upload failed.";
                throw new Error(msg);
            }

            const ids = (data as { id: number }[]).map((q) => q.id);
            let assignedSeriesId: number | undefined = undefined;
            let assignedSeriesName: string | undefined = undefined;

            if (tsOption === "existing" && selectedTsId) {
                const tsRes = await fetch(`/api/backend/test-series/${selectedTsId}`);
                if (tsRes.ok) {
                    const tsData = await tsRes.json();
                    const existingQuestions = Array.isArray(tsData.questions) ? tsData.questions : [];
                    const existingQIds = existingQuestions.map((q: any) => q.question_id);
                    const newQuestions = (data as any[]).filter(q => !existingQIds.includes(q.id)).map(q => ({
                        question_id: q.id,
                        marks: parseFloat(q.marks) || 1,
                        negative_marks: 0,
                    }));
                    const combinedQuestions = [...existingQuestions, ...newQuestions];

                    const patchRes = await fetch(`/api/backend/test-series/${selectedTsId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ questions: combinedQuestions }),
                    });
                    if (patchRes.ok) {
                        assignedSeriesId = Number(selectedTsId);
                        assignedSeriesName = tsData.name ?? `Test Series #${selectedTsId}`;
                    }
                }
            } else if (tsOption === "new" && newTsName.trim()) {
                const validUntilDate = new Date();
                validUntilDate.setDate(validUntilDate.getDate() + 30);
                const durationMins = parseInt(newTsDuration) || 60;

                    const createTsRes = await fetch("/api/backend/test-series/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: newTsName.trim(),
                            access_type: newTsAccessType,
                            valid_until: validUntilDate.toISOString(),
                            duration_seconds: durationMins * 60,
                            questions: (data as any[]).map(q => ({
                                question_id: q.id,
                                marks: parseFloat(q.marks) || 1,
                                negative_marks: 0
                            })),
                            is_active: true,
                        }),
                    });
                if (createTsRes.ok) {
                    const newTsData = await createTsRes.json();
                    assignedSeriesId = newTsData.id;
                    assignedSeriesName = newTsName.trim();
                }
            }

            setResult({
                created: ids.length,
                ids,
                seriesId: assignedSeriesId,
                seriesName: assignedSeriesName,
            });
            setDrafts([makeBlankQuestion()]);
            setValidationErrors([]);
            if (assignedSeriesName) {
                toast.success(`${ids.length} questions created and assigned to "${assignedSeriesName}"!`);
            } else if (preselectedTestSeriesId) {
                toast.success(`${ids.length} questions created and automatically assigned!`);
            } else {
                toast.success(`${ids.length} question${ids.length !== 1 ? "s" : ""} created!`);
            }
            
            if (onSuccess) {
                onSuccess(data as any[], assignedSeriesId);
            } else {
                router.refresh();
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bulk upload failed.");
        } finally {
            setBusy(false);
        }
    }

    function copyAiPrompt() {
        setIsPromptModalOpen(true);
    }

    function generateCustomPrompt() {
        const matchedTopic = topics.find(
            (t) => t.name.toLowerCase() === promptTopic.trim().toLowerCase() || String(t.id) === promptTopic.trim()
        );
        const matchedTopicId = matchedTopic ? matchedTopic.id : null;

        const subjectLine = promptSubject.trim() ? `- Subject: ${promptSubject.trim()}\n` : "";
        const topicLine = promptTopic.trim()
            ? `- Topic: ${promptTopic.trim()}${matchedTopicId !== null ? ` (Topic ID: ${matchedTopicId})` : ""}\n`
            : "";
        const marksLine = promptMarks.trim() ? `- Default Marks per question: ${promptMarks.trim()}\n` : "";
        const countLine = promptNumQuestions.trim() ? `- Number of questions to generate: ${promptNumQuestions.trim()}\n` : "";
        const addLine = promptAdditional.trim() ? `- Additional Requirements: ${promptAdditional.trim()}\n` : "";
        
        const detailsHeader = [subjectLine, topicLine, marksLine, countLine, addLine].filter(Boolean).join("");

        const topicIdSchemaDesc = matchedTopicId !== null
            ? `number (set to ${matchedTopicId} for topic "${matchedTopic?.name}")`
            : `number | null (the database ID of the topic, or null if not applicable)`;

        const topicIdExampleValue = matchedTopicId !== null ? matchedTopicId : "null";

        return `Generate a JSON array of multiple-choice questions for an online assessment in the exact format specified below.

${detailsHeader ? `Assessment Details & Requirements:\n${detailsHeader}\n` : ""}Each question must be an object with the following schema:
- question: string (can contain basic HTML tags like <p>, <strong>, <sub>, <sup> for scientific/math formatting)
- marks: number (e.g., ${promptMarks.trim() || "1"})
- is_active: true
- topic_id: ${topicIdSchemaDesc}
- options: an array of exactly 4 options. Each option must have:
  - ans: string (the text of the answer option)
  - is_correct: boolean (exactly one option in the array must be true, the other three must be false)

Example Format:
[
  {
    "question": "<p>What is the chemical formula for water?</p>",
    "marks": ${promptMarks.trim() || "1"},
    "is_active": true,
    "topic_id": ${topicIdExampleValue},
    "options": [
      { "ans": "H2O", "is_correct": true },
      { "ans": "CO2", "is_correct": false },
      { "ans": "O2", "is_correct": false },
      { "ans": "H2", "is_correct": false }
    ]
  }
]

Please generate ${promptNumQuestions.trim() || "5"} high-quality questions${promptSubject.trim() ? ` for subject "${promptSubject.trim()}"` : ""}${promptTopic.trim() ? ` under topic "${promptTopic.trim()}"${matchedTopicId !== null ? ` (topic_id: ${matchedTopicId})` : ""}` : ""}. Respond with the raw JSON array ONLY. Do not write any markdown code blocks, explanation text, or introductions.`;
    }

    function handleCopyCustomPrompt() {
        const fullPrompt = generateCustomPrompt();
        navigator.clipboard.writeText(fullPrompt);
        toast.success("AI Prompt template copied to clipboard! Paste it into ChatGPT.");
        setIsPromptModalOpen(false);
    }

    const errorMap = new Map(validationErrors.map((e) => [e.index, e.message]));

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bulk upload questions</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Build questions interactively or paste / upload a JSON file.
                </p>
            </div>

            {/* ── Success Banner ── */}
            {result && (
                <Alert className="border-green-500/40 bg-green-50 dark:bg-green-950/20">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p>
                                ✅ <strong>{result.created}</strong> question{result.created !== 1 ? "s" : ""} created
                                successfully (IDs: {result.ids.join(", ")}).
                            </p>
                            {result.seriesName && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Assigned to Test Series: <strong>{result.seriesName}</strong>
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {result.seriesId && (
                                <Button size="sm" onClick={() => router.push(`/test-series/${result.seriesId}`)}>
                                    View Test Series
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => router.push("/questions")}>
                                View all questions
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* ── Test Series Assignment Card ── */}
            {!preselectedTestSeriesId && (
                <Card className="border bg-card">
                <CardHeader className="py-3.5 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Assign to Test Series (Optional)
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Attach newly created questions directly to an existing or brand new Test Series.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex flex-wrap gap-5 text-xs font-medium">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="tsOption"
                                value="none"
                                checked={tsOption === "none"}
                                onChange={() => setTsOption("none")}
                                className="text-primary focus:ring-primary"
                            />
                            <span>Do not assign</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="tsOption"
                                value="existing"
                                checked={tsOption === "existing"}
                                onChange={() => setTsOption("existing")}
                                className="text-primary focus:ring-primary"
                            />
                            <span>Add to existing Test Series</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="tsOption"
                                value="new"
                                checked={tsOption === "new"}
                                onChange={() => setTsOption("new")}
                                className="text-primary focus:ring-primary"
                            />
                            <span>Create new Test Series</span>
                        </label>
                    </div>

                    {tsOption === "existing" && (
                        <div className="pt-2">
                            <Label htmlFor="select-existing-ts" className="text-xs">Select Test Series</Label>
                            <select
                                id="select-existing-ts"
                                value={selectedTsId}
                                onChange={(e) => setSelectedTsId(e.target.value)}
                                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                                <option value="">-- Choose Test Series --</option>
                                {testSeries.map((ts) => (
                                    <option key={ts.id} value={ts.id}>
                                        {ts.name} ({ts.questions?.length || 0} questions)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {tsOption === "new" && (
                        <div className="grid gap-3 sm:grid-cols-3 pt-2">
                            <div className="sm:col-span-1 space-y-1">
                                <Label htmlFor="new-ts-name" className="text-xs">Test Series Title *</Label>
                                <Input
                                    id="new-ts-name"
                                    value={newTsName}
                                    onChange={(e) => setNewTsName(e.target.value)}
                                    placeholder="e.g. Physics Midterm 2026"
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="new-ts-access" className="text-xs">Access Type</Label>
                                <select
                                    id="new-ts-access"
                                    value={newTsAccessType}
                                    onChange={(e) => setNewTsAccessType(e.target.value as "public" | "invite_only" | "private")}
                                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="public">Public</option>
                                    <option value="invite_only">Invite Only</option>
                                    <option value="private">Private</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="new-ts-duration" className="text-xs">Duration (minutes)</Label>
                                <Input
                                    id="new-ts-duration"
                                    type="number"
                                    min="1"
                                    value={newTsDuration}
                                    onChange={(e) => setNewTsDuration(e.target.value)}
                                    placeholder="60"
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {/* ── Mode tabs ── */}
            <div className="flex gap-2">
                <Button
                    id="tab-builder"
                    variant={mode === "builder" ? "default" : "outline"}
                    onClick={() => setMode("builder")}
                >
                    Interactive builder
                </Button>
                <Button
                    id="tab-json"
                    variant={mode === "json" ? "default" : "outline"}
                    onClick={() => setMode("json")}
                >
                    JSON upload
                </Button>
            </div>

            {/* ── JSON mode ── */}
            {mode === "json" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Paste or upload JSON</CardTitle>
                        <CardDescription>
                            JSON must be an array. Each item needs{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">question</code>,{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">marks</code>, and{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">options</code> (min 2, exactly one{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">is_correct: true</code>). You can also
                            optionally supply{" "}
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">topic_id</code>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* File picker */}
                        <div className="flex items-center gap-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) loadFile(file);
                                }}
                            />
                            <Button
                                id="btn-choose-file"
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Choose JSON file
                            </Button>
                            <span className="text-muted-foreground text-sm">or paste below</span>
                        </div>

                        <textarea
                            id="json-input"
                            rows={14}
                            value={jsonText}
                            onChange={(e) => setJsonText(e.target.value)}
                            placeholder={EXAMPLE_JSON}
                            spellCheck={false}
                            className="border-input bg-background w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />

                        {jsonError && (
                            <Alert variant="destructive">
                                <AlertDescription>{jsonError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2">
                            <Button id="btn-load-json" onClick={parseJson} disabled={!jsonText.trim()}>
                                Load & preview
                            </Button>
                            <Button
                                id="btn-load-example"
                                variant="ghost"
                                onClick={() => setJsonText(EXAMPLE_JSON)}
                            >
                                Load example
                            </Button>
                            <Button
                                id="btn-copy-prompt"
                                variant="outline"
                                onClick={copyAiPrompt}
                            >
                                Copy AI Prompt
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Builder mode ── */}
            {mode === "builder" && (
                <div className="space-y-4">
                    {/* Stats bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary" className="text-sm">
                                {drafts.length} question{drafts.length !== 1 ? "s" : ""}
                            </Badge>
                            {validationErrors.length > 0 && (
                                <Badge variant="destructive" className="text-sm">
                                    {validationErrors.length} error{validationErrors.length !== 1 ? "s" : ""}
                                </Badge>
                            )}

                            {/* Global Topic Select */}
                            {topics.length > 0 && (
                                <div className="flex items-center gap-2 sm:ml-4">
                                    <Label htmlFor="global-topic" className="text-xs shrink-0 text-muted-foreground">Apply Topic to All:</Label>
                                    <select
                                        id="global-topic"
                                        value={globalTopicId}
                                        onChange={(e) => setGlobalTopicId(e.target.value)}
                                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                    >
                                        <option value="">No Global Topic</option>
                                        {topics.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={copyAiPrompt}
                                className="gap-1.5"
                            >
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Copy AI Prompt
                            </Button>
                            <Button
                                id="btn-add-question"
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDrafts((prev) => [...prev, makeBlankQuestion()])}
                            >
                                + Add question
                            </Button>
                            <Button
                                id="btn-submit-bulk"
                                size="sm"
                                disabled={busy || drafts.length === 0}
                                onClick={handleSubmit}
                            >
                                {busy
                                    ? "Uploading…"
                                    : `Upload ${drafts.length} question${drafts.length !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </div>

                    {/* Question cards */}
                    <div className="space-y-4">
                        {drafts.map((q, i) => (
                            <QuestionCard
                                key={q.id}
                                q={q}
                                index={i}
                                error={errorMap.get(i)}
                                onChange={(updated) => updateDraft(i, updated)}
                                onRemove={() => removeDraft(i)}
                                canRemove={drafts.length > 1}
                                topics={topics}
                            />
                        ))}
                    </div>

                    {/* Bottom submit */}
                    <div className="flex justify-end gap-3 pt-2">
                        {onCancel && (
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDrafts((prev) => [...prev, makeBlankQuestion()])}
                        >
                            + Add question
                        </Button>
                        <Button
                            id="btn-submit-bulk-bottom"
                            disabled={busy || drafts.length === 0}
                            onClick={handleSubmit}
                        >
                            {busy
                                ? "Uploading…"
                                : `Upload ${drafts.length} question${drafts.length !== 1 ? "s" : ""}`}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── AI Prompt Customization Modal ── */}
            {isPromptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in-50">
                    <Card className="w-full max-w-lg shadow-xl border-border bg-card">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    Customize AI Prompt
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    Configure subject, topic, and marks to generate a tailored ChatGPT prompt.
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsPromptModalOpen(false)}
                                className="h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="prompt-subject" className="text-xs font-semibold">Subject</Label>
                                    <Input
                                        id="prompt-subject"
                                        value={promptSubject}
                                        onChange={(e) => setPromptSubject(e.target.value)}
                                        placeholder="e.g. Physics, Mathematics"
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="prompt-topic" className="text-xs font-semibold">Topic</Label>
                                    {topics.length > 0 ? (
                                        <div className="space-y-1">
                                            <select
                                                value={promptTopic}
                                                onChange={(e) => setPromptTopic(e.target.value)}
                                                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                <option value="">Select or type custom below</option>
                                                {topics.map((t) => (
                                                    <option key={t.id} value={t.name}>
                                                        {t.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {!topics.some((t) => t.name === promptTopic) && (
                                                <Input
                                                    value={promptTopic}
                                                    onChange={(e) => setPromptTopic(e.target.value)}
                                                    placeholder="Or enter custom topic..."
                                                    className="h-8 text-xs mt-1"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <Input
                                            id="prompt-topic"
                                            value={promptTopic}
                                            onChange={(e) => setPromptTopic(e.target.value)}
                                            placeholder="e.g. Thermodynamics, Algebra"
                                            className="h-9 text-sm"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="prompt-marks" className="text-xs font-semibold">Marks per Question</Label>
                                    <Input
                                        id="prompt-marks"
                                        type="number"
                                        min="1"
                                        value={promptMarks}
                                        onChange={(e) => setPromptMarks(e.target.value)}
                                        placeholder="1"
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="prompt-num-questions" className="text-xs font-semibold">Number of Questions</Label>
                                    <Input
                                        id="prompt-num-questions"
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={promptNumQuestions}
                                        onChange={(e) => setPromptNumQuestions(e.target.value)}
                                        placeholder="5"
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="prompt-additional" className="text-xs font-semibold">Additional Instructions (Optional)</Label>
                                <textarea
                                    id="prompt-additional"
                                    rows={3}
                                    value={promptAdditional}
                                    onChange={(e) => setPromptAdditional(e.target.value)}
                                    placeholder="e.g. Focus on medium difficulty questions. Include scientific formulas with <sub> and <sup> tags."
                                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            <div className="flex justify-end gap-2 border-t pt-4">
                                <Button variant="outline" onClick={() => setIsPromptModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleCopyCustomPrompt} className="gap-2">
                                    <Copy className="h-4 w-4" />
                                    Copy AI Prompt
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
