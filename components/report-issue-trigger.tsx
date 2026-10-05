"use client";

import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import ReportIssueModal from "./report-issue-modal";

export type ReportIssueTriggerProps = {
  userRole?: string;
  userName?: string;
  organizationName?: string;
  variant?: "icon" | "button" | "sidebar";
  className?: string;
};

export default function ReportIssueTrigger({
  userRole,
  userName,
  organizationName,
  variant = "icon",
  className = "",
}: ReportIssueTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className={`relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
          title="Report an issue to GitHub"
        >
          <Bug className="h-4 w-4" />
          <span className="sr-only">Report an Issue</span>
        </Button>
      ) : variant === "sidebar" ? (
        <SidebarMenuButton
          type="button"
          onClick={() => setIsOpen(true)}
          tooltip="Report Issue"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted ${className}`}
        >
          <Bug className="!h-5 !w-5 shrink-0" />
          <span className="font-medium group-data-[collapsible=icon]:hidden truncate text-base">
            Report Issue
          </span>
        </SidebarMenuButton>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-1.5 ${className}`}
        >
          <Bug className="h-3.5 w-3.5" />
          <span>Report Issue</span>
        </Button>
      )}

      <ReportIssueModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userRole={userRole}
        userName={userName}
        organizationName={organizationName}
      />
    </>
  );
}
