"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Sparkles,
    Copy,
    Check,
    X,
    Layers,
    ExternalLink,
    ArrowRight,
    Edit3,
    FileText,
    CheckCircle2,
    RotateCcw,
    Trash2,
    Plus,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Topic } from "@/app/services/topics";
import { TestSeries } from "@/app/services/test-series";
import { useTopics } from "@/lib/query/topics/use-topics";
import dynamic from "next/dynamic";
import { DictationButton } from "@/components/ui/dictation-button";

const ReactQuill = dynamic(() => import("react-quill-new"), {
    ssr: false,
    loading: () => <div className="bg-muted h-40 animate-pulse rounded" />,
}) as unknown as typeof import("react-quill-new").default;

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

type Mode = "builder" | "ai";
type TestSeriesOption = "none" | "existing" | "new";

// ─── Constants ─────────────────────────────────────────────────────────────

const EXAMPLE_JSON = JSON.stringify(
    [
        {
            question: "<p>What is the capital of France?</p>",
            marks: 1,
            is_active: true,
            topic_id: null,
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
            topic_id: null,
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

// ─── Robust JSON Cleaner & Parser ──────────────────────────────────────────

function cleanAndParseJsonToDrafts(raw: string): QuestionDraft[] {
    let cleaned = raw.trim();
    if (!cleaned) throw new Error("Please paste the AI response text.");

    // 1. Remove markdown code fences anywhere in text
    cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, "$1").trim();

    // 2. Replace smart/curly quotes with standard ASCII quotes
    cleaned = cleaned
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");

    // 3. Auto-repair unescaped quotes inside HTML tags and text fields
    // a. Convert double quotes inside HTML tags <tag attr="val"> to single quotes <tag attr='val'>
    cleaned = cleaned.replace(/<[^>]+>/g, (tag) => tag.replace(/"/g, "'"));

    // b. Fix unescaped quotes inside "question": "..."
    cleaned = cleaned.replace(/"question"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:marks|options|topic_id|is_active)"/g, (match, content) => {
        const after = match.slice(match.lastIndexOf('",'));
        const safeContent = content.replace(/(?<!\\)"/g, '\\"');
        return `"question": "${safeContent}${after}`;
    });

    // c. Fix unescaped quotes inside "ans": "..."
    cleaned = cleaned.replace(/"ans"\s*:\s*"([\s\S]*?)"\s*,\s*"is_correct"/g, (match, content) => {
        const after = match.slice(match.lastIndexOf('",'));
        const safeContent = content.replace(/(?<!\\)"/g, '\\"');
        return `"ans": "${safeContent}${after}`;
    });

    // 4. Find outermost brackets [ ... ] or braces { ... }
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    } else if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        // If single object was generated by AI, wrap it into an array
        cleaned = "[" + cleaned.substring(firstBrace, lastBrace + 1) + "]";
    }

    let parsed: unknown = null;
    let parseErrorMsg = "";

    // Strategy 1: Direct JSON.parse
    try {
        parsed = JSON.parse(cleaned);
    } catch (e1) {
        parseErrorMsg = e1 instanceof Error ? e1.message : String(e1);
    }

    // Strategy 2: Relaxed JavaScript evaluation (handles \<p>, unquoted keys, single quotes, comments, trailing commas)
    if (!parsed) {
        try {
            const evaluated = Function('"use strict"; return (' + cleaned + ')')();
            if (Array.isArray(evaluated) && evaluated.length > 0) {
                parsed = evaluated;
            } else if (typeof evaluated === "object" && evaluated !== null) {
                parsed = [evaluated];
            }
        } catch {
            // continue to Strategy 3
        }
    }

    // Strategy 3: Sanitized JSON.parse
    if (!parsed) {
        let sanitized = cleaned;
        sanitized = sanitized.replace(/\\u(?![0-9a-fA-F]{4})/g, "u");
        sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, "$1");
        sanitized = sanitized.replace(/,\s*([\]}])/g, "$1");

        try {
            parsed = JSON.parse(sanitized);
        } catch (e3) {
            parseErrorMsg = e3 instanceof Error ? e3.message : parseErrorMsg;
        }

        if (!parsed) {
            try {
                const evaluated = Function('"use strict"; return (' + sanitized + ')')();
                if (Array.isArray(evaluated) && evaluated.length > 0) {
                    parsed = evaluated;
                }
            } catch {
                // fall through
            }
        }
    }

    if (!parsed) {
        throw new Error(
            parseErrorMsg
                ? `Could not parse questions (${parseErrorMsg}). Please ensure the complete AI response was copied.`
                : "Could not parse JSON. Please make sure you copied the full response from your AI assistant."
        );
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (items.length === 0) throw new Error("The questions array is empty.");

    return (parsed as Record<string, unknown>[]).map((item, i) => {
        if (typeof item !== "object" || item === null) throw new Error(`Item ${i + 1} is not a valid question object.`);
        const opts = item.options;
        if (!Array.isArray(opts) || opts.length < 2) {
            throw new Error(`Item ${i + 1}: "options" must have at least 2 choices.`);
        }
        return {
            id: crypto.randomUUID(),
            question: String(item.question ?? ""),
            marks: String(item.marks ?? "1"),
            is_active: item.is_active !== false,
            topic_id: item.topic_id ? String(item.topic_id) : "",
            options: (opts as Record<string, unknown>[]).map((o) => ({
                ans: String(o.ans ?? ""),
                is_correct: o.is_correct === true,
            })),
        };
    });
}

// ─── AI Prompt Generator ───────────────────────────────────────────────────

function generateCustomPrompt(
    subject: string,
    topicName: string,
    topicId: number | null,
    marks: string,
    count: string,
    additional: string,
) {
    const subjectLine = subject.trim() ? `- Subject: ${subject.trim()}\n` : "";
    const topicLine = topicName.trim()
        ? `- Topic: ${topicName.trim()}${topicId !== null ? ` (Topic ID: ${topicId})` : ""}\n`
        : "";
    const marksLine = marks.trim() ? `- Default Marks per question: ${marks.trim()}\n` : "";
    const countLine = count.trim() ? `- Number of questions to generate: ${count.trim()}\n` : "";
    const addLine = additional.trim() ? `- Additional Requirements: ${additional.trim()}\n` : "";

    const detailsHeader = [subjectLine, topicLine, marksLine, countLine, addLine].filter(Boolean).join("");

    const topicIdSchemaDesc = topicId !== null
        ? `number (set to ${topicId} for topic "${topicName}")`
        : `number | null (the database ID of the topic, or null if not applicable)`;

    const topicIdExampleValue = topicId !== null ? topicId : "null";

    return `Generate a JSON array of multiple-choice questions for an online assessment in the exact format specified below.

${detailsHeader ? `Assessment Details & Requirements:\n${detailsHeader}\n` : ""}Each question must be an object with the following schema:
- question: string (can contain basic HTML tags like <p>, <strong>, <sub>, <sup> for scientific/math formatting)
- marks: number (e.g., ${marks.trim() || "1"})
- is_active: true
- topic_id: ${topicIdSchemaDesc}
- options: an array of exactly 4 options. Each option must have:
  - ans: string (the text of the answer option)
  - is_correct: boolean (exactly one option in the array must be true, the other three must be false)

Example Format:
[
  {
    "question": "<p>What is the chemical formula for water?</p>",
    "marks": ${marks.trim() || "1"},
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

Please generate ${count.trim() || "5"} high-quality questions${subject.trim() ? ` for subject "${subject.trim()}"` : ""}${topicName.trim() ? ` under topic "${topicName.trim()}"${topicId !== null ? ` (topic_id: ${topicId})` : ""}` : ""}.
CRITICAL RULES FOR VALID JSON:
- If question text or options contain quotes or technical terms, use single quotes (e.g. 'momentum') or escaped quotes (\\") so the JSON is strictly valid.
- Never use unescaped double quotes inside HTML attributes (e.g. use <span class='bold'> or simple <strong> tags).
- Respond with the raw JSON array ONLY. Do not write any markdown code blocks, explanation text, or introductions.`;
}

// ─── Question Card (Builder mode) ───────────────────────────────────────────

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

    const quillRef = useRef<any>(null);

    const handleDictation = (text: string) => {
        const editor = quillRef.current?.getEditor();
        if (editor) {
            const selection = editor.getSelection();
            const cursorPosition = selection ? selection.index : editor.getLength() - 1;
            editor.insertText(cursorPosition, text + " ");
            editor.setSelection(cursorPosition + text.length + 1);
        } else {
            setField("question", q.question + " " + text);
        }
    };

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
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Remove
                            </Button>
                        )}
                    </div>
                    {error && <p className="text-destructive text-xs">{error}</p>}
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Question text */}
                    <div className="space-y-1.5">
                        <Label htmlFor={`q-${q.id}-text`}>Question Text</Label>
                        <div className="relative overflow-hidden rounded-lg bg-white text-black border border-input">
                            <div className="absolute top-1.5 right-1.5 z-10">
                                <DictationButton onResult={handleDictation} />
                            </div>
                            <ReactQuill
                                ref={quillRef}
                                theme="snow"
                                value={q.question}
                                onChange={(value) => setField("question", value)}
                                placeholder="Write your question..."
                                modules={QUILL_MODULES}
                                formats={QUILL_FORMATS}
                            />
                        </div>
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
                                (Select radio button for correct answer)
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

export default function AdvancedBulkUpload({
    testSeries = [],
    preselectedTestSeriesId,
    preselectedQuestionSetId,
    initialMode = "builder",
    onSuccess,
    onCancel,
}: {
    testSeries?: TestSeries[];
    preselectedTestSeriesId?: number;
    preselectedQuestionSetId?: number;
    initialMode?: "builder" | "ai";
    onSuccess?: (newQuestions: any[], assignedSeriesId?: number) => void;
    onCancel?: () => void;
}) {
    const { data: topics = [] } = useTopics();
    const router = useRouter();

    // Main Mode: "builder" (Interactive Builder) or "ai" (AI Upload)
    const [mode, setMode] = useState<Mode>(initialMode);

    const [drafts, setDrafts] = useState<QuestionDraft[]>([makeBlankQuestion()]);
    const [globalTopicId, setGlobalTopicId] = useState<string>("");
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

    // ── AI Upload Flow State ───────────────────────────────────────────────
    const [aiStep, setAiStep] = useState<1 | 2 | 3>(1);
    const [promptSubject, setPromptSubject] = useState("");
    const [promptTopic, setPromptTopic] = useState("");
    const [promptMarks, setPromptMarks] = useState("1");
    const [promptNumQuestions, setPromptNumQuestions] = useState("5");
    const [promptAdditional, setPromptAdditional] = useState("");
    const [promptCopied, setPromptCopied] = useState(false);

    // AI Paste & Preview
    const [aiInputText, setAiInputText] = useState("");
    const [aiError, setAiError] = useState("");
    const [isAiParsed, setIsAiParsed] = useState(false);

    // Modal state (when triggered from builder)
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

    function handleResetAi() {
        setAiStep(1);
        setPromptCopied(false);
        setAiInputText("");
        setIsAiParsed(false);
        setDrafts([makeBlankQuestion()]);
    }

    // ── AI Prompt Copying Logic ────────────────────────────────────────────

    async function handleCopyPrompt() {
        let finalTopicId: number | null = null;
        let finalTopicName = promptTopic.trim();

        if (finalTopicName) {
            const matchedTopic = topics.find(
                (t) => t.name.toLowerCase() === finalTopicName.toLowerCase() || String(t.id) === finalTopicName,
            );
            if (matchedTopic) {
                finalTopicId = matchedTopic.id;
                finalTopicName = matchedTopic.name;
            } else {
                try {
                    const toastId = toast.loading("Setting up topic...");
                    const res = await fetch("/api/backend/topics/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: finalTopicName, color: "#3b82f6", is_active: true }),
                    });
                    if (res.ok) {
                        const newTopic = await res.json();
                        finalTopicId = newTopic.id;
                        toast.dismiss(toastId);
                    } else {
                        toast.dismiss(toastId);
                    }
                } catch (e) {
                    toast.dismiss();
                    console.error("Failed to create topic", e);
                }
            }
        }

        const fullPrompt = generateCustomPrompt(
            promptSubject,
            finalTopicName,
            finalTopicId,
            promptMarks,
            promptNumQuestions,
            promptAdditional,
        );

        await navigator.clipboard.writeText(fullPrompt);
        setPromptCopied(true);
        setAiStep(2);
        toast.success("AI Prompt copied! Now paste it into ChatGPT, Claude, or Gemini below.");
    }

    // ── AI Response Parsing ────────────────────────────────────────────────

    function handleParseAiResponse() {
        setAiError("");
        try {
            const parsed = cleanAndParseJsonToDrafts(aiInputText);
            setDrafts(parsed);
            setIsAiParsed(true);
            setAiStep(3);
            if (isAiModalOpen) {
                setIsAiModalOpen(false);
                setMode("builder");
            }
            toast.success(`Loaded ${parsed.length} questions from AI! Review and upload.`);
        } catch (err) {
            setAiError(err instanceof Error ? err.message : "Failed to parse questions.");
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
            if (mode === "ai") {
                setMode("builder");
            }
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
                        : "Upload failed.";
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

            if (preselectedQuestionSetId) {
                const qSetRes = await fetch(`/api/backend/question-sets/${preselectedQuestionSetId}/questions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question_ids: ids }),
                });
                if (!qSetRes.ok) {
                    const errData = await qSetRes.json().catch(() => null);
                    console.error("Failed to link questions to question set:", errData);
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
            setAiInputText("");
            setIsAiParsed(false);
            setAiStep(1);
            setPromptCopied(false);
            if (isAiModalOpen) setIsAiModalOpen(false);

            if (assignedSeriesName) {
                toast.success(`${ids.length} questions created and assigned to "${assignedSeriesName}"!`);
            } else if (preselectedTestSeriesId) {
                toast.success(`${ids.length} questions created and automatically assigned!`);
            } else if (preselectedQuestionSetId) {
                toast.success(`${ids.length} questions created and added to the Question Set!`);
            } else {
                toast.success(`${ids.length} question${ids.length !== 1 ? "s" : ""} created successfully!`);
            }

            if (onSuccess) {
                onSuccess(data as any[], assignedSeriesId);
            } else {
                router.refresh();
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed.");
        } finally {
            setBusy(false);
        }
    }

    const errorMap = new Map(validationErrors.map((e) => [e.index, e.message]));

    // ─── Test Series Assignment Component ──────────────────────────────────
    const TestSeriesAssignmentSection = (
        !preselectedTestSeriesId && !preselectedQuestionSetId && (
            <Card className="border bg-card">
                <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        Assign to Test Series (Optional)
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Attach newly created questions directly to an existing or new Test Series.
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
        )
    );

    // ─── AI Upload 3-Step Wizard Content ───────────────────────────────────
    const AiUploadFlow = (
        <div className="space-y-6">
            {/* Step 1: Configure & Copy AI Prompt (Collapsed summary when done, full form initially) */}
            {aiStep >= 2 ? (
                <Card className="border border-green-500/30 bg-green-50/20 dark:bg-green-950/10">
                    <CardContent className="py-2.5 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-[11px] font-bold">
                                ✓
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                                Step 1: Prompt Configured & Copied
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                ({promptSubject || "General Assessment"} • {promptNumQuestions} Questions • {promptMarks} Mark{parseFloat(promptMarks) !== 1 ? "s" : ""})
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setAiStep(1)}
                            className="h-7 text-xs text-primary font-medium hover:bg-primary/10 gap-1"
                        >
                            <Edit3 className="h-3 w-3" />
                            Edit Prompt
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border border-primary/20 shadow-sm">
                    <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                    1
                                </span>
                                Configure & Copy AI Prompt
                            </CardTitle>
                            {promptCopied && (
                                <Badge variant="outline" className="text-green-600 border-green-500 bg-green-50 gap-1 text-xs">
                                    <Check className="h-3 w-3" /> Prompt Copied
                                </Badge>
                            )}
                        </div>
                        <CardDescription className="text-xs">
                            Configure your subject and parameters, then copy the prompt for ChatGPT, Gemini, or Claude.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-subject" className="text-xs font-semibold">Subject / Topic Area</Label>
                                <Input
                                    id="ai-subject"
                                    value={promptSubject}
                                    onChange={(e) => {
                                        setPromptSubject(e.target.value);
                                        setPromptCopied(false);
                                    }}
                                    placeholder="e.g. Physics, World History, JavaScript"
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-topic" className="text-xs font-semibold">Topic Tag (Optional)</Label>
                                {topics.length > 0 ? (
                                    <div className="space-y-1">
                                        <select
                                            id="ai-topic"
                                            value={promptTopic}
                                            onChange={(e) => {
                                                setPromptTopic(e.target.value);
                                                setPromptCopied(false);
                                            }}
                                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <option value="">Select existing or type below</option>
                                            {topics.map((t) => (
                                                <option key={t.id} value={t.name}>
                                                    {t.name}
                                                </option>
                                            ))}
                                        </select>
                                        {!topics.some((t) => t.name === promptTopic) && (
                                            <Input
                                                value={promptTopic}
                                                onChange={(e) => {
                                                    setPromptTopic(e.target.value);
                                                    setPromptCopied(false);
                                                }}
                                                placeholder="Or enter custom topic..."
                                                className="h-8 text-xs mt-1"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <Input
                                        id="ai-topic"
                                        value={promptTopic}
                                        onChange={(e) => {
                                            setPromptTopic(e.target.value);
                                            setPromptCopied(false);
                                        }}
                                        placeholder="e.g. Thermodynamics, Algebra"
                                        className="h-9 text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-marks" className="text-xs font-semibold">Marks per Question</Label>
                                <Input
                                    id="ai-marks"
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={promptMarks}
                                    onChange={(e) => {
                                        setPromptMarks(e.target.value);
                                        setPromptCopied(false);
                                    }}
                                    placeholder="1"
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-count" className="text-xs font-semibold">Number of Questions</Label>
                                <Input
                                    id="ai-count"
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={promptNumQuestions}
                                    onChange={(e) => {
                                        setPromptNumQuestions(e.target.value);
                                        setPromptCopied(false);
                                    }}
                                    placeholder="5"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ai-additional" className="text-xs font-semibold">Additional Instructions (Optional)</Label>
                            <Input
                                id="ai-additional"
                                value={promptAdditional}
                                onChange={(e) => {
                                    setPromptAdditional(e.target.value);
                                    setPromptCopied(false);
                                }}
                                placeholder="e.g. Medium difficulty, include real-world applications"
                                className="h-9 text-sm"
                            />
                        </div>

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                            <Button
                                type="button"
                                onClick={handleCopyPrompt}
                                className={`gap-2 font-semibold shadow-sm transition-all ${promptCopied ? "bg-green-600 hover:bg-green-700" : ""}`}
                            >
                                {promptCopied ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        Copied! Next: Paste to AI below
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        Copy AI Prompt
                                    </>
                                )}
                            </Button>
                            {isAiParsed && drafts.length > 0 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAiStep(3)}
                                    className="text-xs gap-1"
                                >
                                    Back to Questions (Step 3) <ArrowRight className="h-3 w-3" />
                                </Button>
                            ) : promptCopied ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setAiStep(2)}
                                    className="text-xs gap-1"
                                >
                                    Continue to Step 2 <ArrowRight className="h-3 w-3" />
                                </Button>
                            ) : null}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Paste AI Response (Collapsed when Step 3 is active) */}
            {aiStep === 3 ? (
                <Card className="border border-green-500/30 bg-green-50/20 dark:bg-green-950/10">
                    <CardContent className="py-2.5 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-[11px] font-bold">
                                ✓
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                                Step 2: AI Response Loaded
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                ({drafts.length} question{drafts.length !== 1 ? "s" : ""} parsed from AI)
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setAiStep(2)}
                            className="h-7 text-xs text-primary font-medium hover:bg-primary/10 gap-1"
                        >
                            <Edit3 className="h-3 w-3" />
                            Re-paste Response
                        </Button>
                    </CardContent>
                </Card>
            ) : aiStep === 2 ? (
                <Card className="border shadow-sm animate-in fade-in-50 duration-200">
                    <CardHeader className="pb-3 bg-muted/30 border-b">
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                                2
                            </span>
                            Paste AI Response
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Paste the prompt into your AI assistant, then copy the result and paste it in the box below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        {/* Helper AI quick links */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/40 border">
                            <span className="font-medium text-foreground">Paste prompt to:</span>
                            <a
                                href="https://chatgpt.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                                ChatGPT <ExternalLink className="h-3 w-3" />
                            </a>
                            <span>•</span>
                            <a
                                href="https://gemini.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                                Gemini <ExternalLink className="h-3 w-3" />
                            </a>
                            <span>•</span>
                            <a
                                href="https://claude.ai"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            >
                                Claude <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>

                        {/* Text area for AI response */}
                        <textarea
                            rows={8}
                            value={aiInputText}
                            onChange={(e) => {
                                setAiInputText(e.target.value);
                                setIsAiParsed(false);
                                setAiError("");
                            }}
                            placeholder="Paste the generated response from ChatGPT, Gemini, or Claude here..."
                            spellCheck={false}
                            className="border-input bg-background w-full rounded-lg border p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />

                        {aiError && (
                            <Alert variant="destructive">
                                <AlertDescription>{aiError}</AlertDescription>
                            </Alert>
                        )}

                        <div className="pt-1 flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                onClick={handleParseAiResponse}
                                disabled={!aiInputText.trim()}
                                className="gap-2 font-semibold"
                            >
                                <ArrowRight className="h-4 w-4" />
                                Load & Preview Questions
                            </Button>
                            {isAiParsed && drafts.length > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setAiStep(3)}
                                    className="text-xs"
                                >
                                    Cancel & Return to Step 3
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {/* Step 3: Interactive Question Builder */}
            {aiStep === 3 && isAiParsed && drafts.length > 0 && (
                <div className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
                    {/* Step 3 Header Card */}
                    <Card className="border border-primary/20 shadow-sm">
                        <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                        3
                                    </span>
                                    Interactive Question Builder
                                </CardTitle>
                                <Badge variant="outline" className="text-green-600 border-green-500 bg-green-50 dark:bg-green-950/30 gap-1 text-xs font-semibold">
                                    <Check className="h-3 w-3" /> {drafts.length} Question{drafts.length !== 1 ? "s" : ""} Loaded & Editable
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Review and customize your AI-generated questions below using the rich-text builder. Edit questions, options, marks, or add new ones before uploading.
                            </CardDescription>
                        </CardHeader>
                    </Card>

                    {/* Optional Test Series Assignment */}
                    {TestSeriesAssignmentSection}

                    {/* Stats & Tools Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="secondary" className="text-sm font-semibold">
                                {drafts.length} question{drafts.length !== 1 ? "s" : ""}
                            </Badge>
                            {validationErrors.length > 0 && (
                                <Badge variant="destructive" className="text-sm font-semibold">
                                    {validationErrors.length} error{validationErrors.length !== 1 ? "s" : ""}
                                </Badge>
                            )}

                            {/* Global Topic Select */}
                            {topics.length > 0 && (
                                <div className="flex items-center gap-2 sm:ml-4">
                                    <Label htmlFor="global-topic-ai" className="text-xs shrink-0 text-muted-foreground">
                                        Apply Topic to All:
                                    </Label>
                                    <select
                                        id="global-topic-ai"
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
                                onClick={handleResetAi}
                                className="gap-1 text-xs"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Start Over
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDrafts((prev) => [...prev, makeBlankQuestion()])}
                                className="gap-1 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Question
                            </Button>
                            <Button
                                size="sm"
                                disabled={busy || drafts.length === 0}
                                onClick={handleSubmit}
                                className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {busy ? "Uploading…" : `Upload ${drafts.length} Question${drafts.length !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </div>

                    {/* Question Cards (Interactive Builder) */}
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

                    {/* Bottom Submit Bar */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDrafts((prev) => [...prev, makeBlankQuestion()])}
                        >
                            + Add Question
                        </Button>
                        <Button
                            disabled={busy || drafts.length === 0}
                            onClick={handleSubmit}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                        >
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                            {busy ? "Uploading…" : `Upload ${drafts.length} Questions — Done!`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* ── Top Header with 2 Clear Options: Add Question & AI Upload ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mode === "ai" ? "AI Question Upload" : "Add Questions"}
                    </h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                        {mode === "ai"
                            ? "Generate questions using ChatGPT, Gemini, or Claude and upload in 3 quick steps."
                            : "Create and edit questions interactively with rich text, marks, and options."}
                    </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted border">
                    <button
                        type="button"
                        id="tab-builder"
                        onClick={() => setMode("builder")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            mode === "builder"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Edit3 className="h-3.5 w-3.5" />
                        Add Question
                    </button>
                    <button
                        type="button"
                        id="tab-ai"
                        onClick={() => setMode("ai")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            mode === "ai"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Upload
                    </button>
                </div>
            </div>

            {/* ── Success Banner ── */}
            {result && (
                <Alert className="border-green-500/40 bg-green-50 dark:bg-green-950/20">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p>
                                ✅ <strong>{result.created}</strong> question{result.created !== 1 ? "s" : ""} created
                                successfully!
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

            {/* ── MODE 1: AI UPLOAD ── */}
            {mode === "ai" && AiUploadFlow}

            {/* ── MODE 2: INTERACTIVE BUILDER (ADD QUESTION) ── */}
            {mode === "builder" && (
                <div className="space-y-4">
                    {/* Optional Test Series Assignment */}
                    {TestSeriesAssignmentSection}

                    {/* Stats & Tools Bar */}
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
                                onClick={() => setIsAiModalOpen(true)}
                                className="gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/5"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                AI Upload Wizard
                            </Button>
                            <Button
                                id="btn-add-question"
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDrafts((prev) => [...prev, makeBlankQuestion()])}
                                className="gap-1 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Question
                            </Button>
                            <Button
                                id="btn-submit-bulk"
                                size="sm"
                                disabled={busy || drafts.length === 0}
                                onClick={handleSubmit}
                                className="text-xs font-semibold"
                            >
                                {busy
                                    ? "Uploading…"
                                    : `Upload ${drafts.length} Question${drafts.length !== 1 ? "s" : ""}`}
                            </Button>
                        </div>
                    </div>

                    {/* Question Cards */}
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

                    {/* Bottom Submit Bar */}
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
                            + Add Question
                        </Button>
                        <Button
                            id="btn-submit-bulk-bottom"
                            disabled={busy || drafts.length === 0}
                            onClick={handleSubmit}
                            className="font-semibold"
                        >
                            {busy
                                ? "Uploading…"
                                : `Upload ${drafts.length} Question${drafts.length !== 1 ? "s" : ""}`}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── AI Upload Wizard Modal (When triggered from builder) ── */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in-50">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-border bg-card my-8">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 sticky top-0 bg-card z-10">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                                    <Sparkles className="h-5 w-5" />
                                    AI Upload Assistant
                                </CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                    Copy prompt $\rightarrow$ Paste in ChatGPT/Gemini/Claude $\rightarrow$ Paste response here!
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsAiModalOpen(false)}
                                className="h-8 w-8 rounded-full"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-6">
                            {AiUploadFlow}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
