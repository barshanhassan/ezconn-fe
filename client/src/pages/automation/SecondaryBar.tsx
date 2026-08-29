/**
 * SecondaryBar — 350px-wide slide-in panel that overlays the main
 * SidebarPanel when the user clicks an activity to edit it. This mirrors
 * replyagent's `components/automation/ui/SecondaryBar.vue` exactly:
 *
 *   ┌────────────────────────────┐
 *   │  Title          (× close)  │  ← bg-primary (green) header band
 *   ├────────────────────────────┤
 *   │                            │
 *   │  scrollable body slot      │
 *   │                            │
 *   ├────────────────────────────┤
 *   │  [Cancel]  [Save]          │  ← footer slot
 *   └────────────────────────────┘
 *
 * Sits inside the SidebarPanel container with absolute positioning so it
 * doesn't push the main list — it slides over it. Replyagent's main list
 * stays mounted behind the SecondaryBar so toggling preserves state.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";

interface SecondaryBarProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Header background tailwind class. Defaults to emerald-500 (replyagent
      `bg-primary`). Channel-specific editors can override. */
  headerClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SecondaryBar({
  open,
  title,
  onClose,
  headerClass = "bg-emerald-500",
  children,
  footer,
}: SecondaryBarProps) {
  const { t } = useTranslation();
  if (!open) return null;
  // Positioned `fixed` over the right 384px of the viewport so it covers
  // the SidebarPanel regardless of which scroll container or flex layer
  // the trigger lives inside. Replyagent's SecondaryBar slides over the
  // main sidebar — fixed positioning gives us the same visual behaviour
  // without coupling to the ancestor's `position: relative`.
  return (
    <div className="fixed top-14 right-0 bottom-0 w-[350px] bg-white flex flex-col z-30 border-l shadow-xl animate-in slide-in-from-right duration-150">
      <div
        className={`px-4 py-3 flex items-center gap-2 shrink-0 ${headerClass}`}
      >
        <span className="font-semibold text-base text-white truncate">
          {title}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 inline-flex items-center justify-center rounded text-white hover:bg-white/15"
          title={t("secondary_bar.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
      {footer && (
        <div className="border-t px-4 py-3 flex items-center justify-end gap-2 shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}
