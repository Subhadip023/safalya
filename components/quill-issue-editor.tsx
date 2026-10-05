"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, ImagePlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// Dynamically import react-quill-new to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[160px] flex items-center justify-center bg-muted/20 border border-input rounded-lg animate-pulse text-xs text-muted-foreground">
      Loading rich editor...
    </div>
  ),
}) as unknown as typeof import("react-quill-new").default;

export type QuillIssueEditorProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  repository?: "frontend" | "backend";
  minHeight?: string;
  maxHeight?: string;
};

export function isQuillEmpty(content: string): boolean {
  if (!content) return true;
  // Strip HTML tags and check if text remains
  const textOnly = content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  // Check if an image tag is present
  const hasImage = /<img\s+[^>]*src=/i.test(content);
  return textOnly.length === 0 && !hasImage;
}

export function QuillIssueEditor({
  value,
  onChange,
  placeholder = "Describe what happened, steps to reproduce, or feature motivation. You can paste (Ctrl+V) or upload screenshots...",
  disabled = false,
  repository = "frontend",
  minHeight = "160px",
  maxHeight = "320px",
}: QuillIssueEditorProps) {
  const quillRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Process and upload an image file
  const handleProcessAndUploadFile = useCallback(
    (file: File) => {
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Only image files (PNG, JPG, GIF, WebP, SVG) can be attached.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image file must be under 10MB.");
        return;
      }

      // Step 1: Read locally as base64 and display IMMEDIATELY in the editor
      const reader = new FileReader();
      reader.onload = async (event) => {
        const localDataUrl = event.target?.result as string;
        if (!localDataUrl) return;

        const editor = quillRef.current?.getEditor();
        if (editor) {
          editor.focus();
          const selection = editor.getSelection();
          const insertIndex = selection ? selection.index : editor.getLength();
          editor.insertEmbed(insertIndex, "image", localDataUrl, "user");
          editor.setSelection(insertIndex + 1);

          // CRITICAL: Synchronize with React state immediately so it's not lost on re-render
          const currentHtml = editor.root.innerHTML;
          onChange(currentHtml);
        } else {
          // Fallback if editor instance isn't directly exposed
          onChange(`${value}<p><img src="${localDataUrl}" alt="attachment" /></p>`);
        }

        // Step 2: Upload to GitHub repository attachments in the background
        setIsUploading(true);
        setUploadSuccess(false);

        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("repository", repository);

          const res = await fetch("/api/issues/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json().catch(() => null);

          if (res.ok && data?.url) {
            const permanentUrl = data.url;
            const currentEditor = quillRef.current?.getEditor();
            if (currentEditor) {
              const html = currentEditor.root.innerHTML;
              if (html.includes(localDataUrl)) {
                const updatedHtml = html.replace(localDataUrl, permanentUrl);
                currentEditor.root.innerHTML = updatedHtml;
                onChange(updatedHtml);
              }
            }
            setUploadSuccess(true);
            setTimeout(() => setUploadSuccess(false), 3000);
            toast.success("Image attached and uploaded to GitHub attachments!");
          }
        } catch {
          // If background upload fails, server /api/issues will process inline data-URI on submit
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };

      reader.readAsDataURL(file);
    },
    [repository, value, onChange]
  );

  // Custom image toolbar handler
  const imageHandler = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  // Intercept paste & drop events on Quill's root editor element in the CAPTURE phase.
  // This stops Quill's internal clipboard module from also inserting a duplicate copy!
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const interval = setInterval(() => {
      const editor = quillRef.current?.getEditor();
      if (!editor?.root) return;

      clearInterval(interval);
      const root = editor.root as HTMLElement;

      const handleNativePaste = (e: ClipboardEvent) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const items = Array.from(clipboardData.items || []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            handleProcessAndUploadFile(file);
          }
        }
      };

      const handleNativeDrop = (e: DragEvent) => {
        const files = Array.from(e.dataTransfer?.files || []);
        const imageFile = files.find((f) => f.type.startsWith("image/"));
        if (imageFile) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleProcessAndUploadFile(imageFile);
        }
      };

      root.addEventListener("paste", handleNativePaste, true);
      root.addEventListener("drop", handleNativeDrop, true);

      cleanup = () => {
        root.removeEventListener("paste", handleNativePaste, true);
        root.removeEventListener("drop", handleNativeDrop, true);
      };
    }, 100);

    return () => {
      clearInterval(interval);
      if (cleanup) cleanup();
    };
  }, [handleProcessAndUploadFile]);

  // Configure Quill modules
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike", "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
      clipboard: {
        matchVisual: false,
      },
    }),
    [imageHandler]
  );

  const formats = useMemo(
    () => [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "blockquote",
      "code-block",
      "list",
      "link",
      "image",
    ],
    []
  );

  return (
    <div className="quill-issue-editor-wrapper relative rounded-xl border border-input bg-background overflow-hidden transition-all focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent flex flex-col">
      {/* Hidden file input for native image picking */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleProcessAndUploadFile(file);
        }}
        accept="image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml"
        className="hidden"
        aria-hidden="true"
      />

      {/* Editor Component */}
      <div style={{ minHeight, maxHeight }} className="overflow-y-auto flex-1">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
          readOnly={disabled}
        />
      </div>

      {/* Bottom helper bar with subtle upload status indicator */}
      <div className="px-3 py-1.5 bg-muted/30 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Supports image button, file drag & drop, and Ctrl+V pasting</span>
        </div>

        <div className="flex items-center gap-2">
          {isUploading && (
            <span className="flex items-center gap-1.5 text-primary text-[11px] font-medium animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              Uploading image...
            </span>
          )}
          {uploadSuccess && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              Attached
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuillIssueEditor;
