import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface ActivityGroup {
  type: string;
  title: string;
  iconSrc?: string;
  children: { id: string; title: string }[];
}

interface ActivityFilterDropdownProps {
  groups: ActivityGroup[];
  // Keys of unchecked leaves, formatted "<type>:<id>". Empty set = everything
  // selected ("All activities") — mirrors replyagent's InboxActivityFilter.
  deselected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
  // Controlled open state — lets this dropdown coordinate with sibling
  // toolbar dropdowns (only one open at a time) instead of managing its
  // open/closed state purely internally.
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Header "Select all activities" filter — 1:1 mirror of replyagent's
 * InboxActivityFilter.vue: one collapsible section per channel TYPE, one
 * checkbox per configured INSTANCE of that channel, plus a top "select all"
 * checkbox. Selection scopes the inbox list/count to those instances.
 */
const ActivityFilterDropdown: React.FC<ActivityFilterDropdownProps> = ({
  groups,
  deselected,
  onChange,
  className,
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === "function" ? (open as (prev: boolean) => boolean)(isOpen) : open;
    if (onOpenChange) onOpenChange(next);
    if (!isControlled) setInternalIsOpen(next);
  };
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const allLeaves = groups.flatMap((g) => g.children.map((c) => `${g.type}:${c.id}`));
  const totalCount = allLeaves.length;
  const checkedCount = allLeaves.filter((k) => !deselected.has(k)).length;
  const allSelected = deselected.size === 0;

  const toggleLeaf = (key: string) => {
    const next = new Set(deselected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const toggleSelectAll = () => {
    onChange(allSelected ? new Set(allLeaves) : new Set());
  };

  const toggleCollapsed = (type: string) => {
    const next = new Set(collapsed);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setCollapsed(next);
  };

  let label = t("conversations_inbox.search.activities.all");
  if (totalCount > 0) {
    if (checkedCount === 0) label = t("conversations_inbox.search.activities.select");
    else if (checkedCount === totalCount) label = t("conversations_inbox.search.activities.all");
    else if (checkedCount === 1) {
      const onlyKey = allLeaves.find((k) => !deselected.has(k));
      const [type, id] = onlyKey?.split(":") ?? [];
      label = groups.find((g) => g.type === type)?.children.find((c) => c.id === id)?.title ?? label;
    } else label = t("conversations_inbox.search.activities.count", { count: checkedCount });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-md bg-white dark:bg-background border border-input dark:border-slate-700 hover:bg-accent dark:hover:bg-slate-700 transition-colors",
          !allSelected && totalCount > 0 && "border-primary text-primary bg-primary/5",
          className,
        )}
        onClick={() => setIsOpen((o) => !o)}
        data-testid="button-activity-filter"
      >
        <ListFilter size={16} />
      </button>

      {isOpen && (
        <div
          className="absolute z-[100] mt-1.5 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-none animate-in fade-in-0 zoom-in-95 duration-100 overflow-hidden"
          style={{ width: "240px" }}
        >
          <div className="px-3 py-2.5 border-b dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
              <span
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  allSelected ? "bg-primary border-primary" : "border-slate-300 dark:border-slate-600",
                )}
                onClick={toggleSelectAll}
              >
                {allSelected && <Check size={11} className="text-white" />}
              </span>
              <span onClick={toggleSelectAll}>{t("conversations_inbox.search.activities.select_all")}</span>
            </label>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                {t("conversations_inbox.search.activities.no_channels")}
              </div>
            ) : (
              groups.map((g) => {
                const isCollapsed = collapsed.has(g.type);
                return (
                  <div key={g.type} className="border-b last:border-b-0 dark:border-slate-800">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent dark:hover:bg-slate-800 transition-colors"
                      onClick={() => toggleCollapsed(g.type)}
                    >
                      {g.iconSrc ? (
                        <img src={g.iconSrc} alt={g.title} className="w-4 h-4 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 shrink-0" />
                      )}
                      <span className="flex-1 text-left truncate">{g.title}</span>
                      <ChevronDown size={12} className={cn("transition-transform shrink-0", !isCollapsed && "rotate-180")} />
                    </button>
                    {!isCollapsed && (
                      <div className="pb-1">
                        {g.children.map((c) => {
                          const key = `${g.type}:${c.id}`;
                          const checked = !deselected.has(key);
                          return (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs cursor-pointer select-none hover:bg-accent dark:hover:bg-slate-800 transition-colors"
                              onClick={() => toggleLeaf(key)}
                            >
                              <span
                                className={cn(
                                  "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                                  checked ? "bg-primary border-primary" : "border-slate-300 dark:border-slate-600",
                                )}
                              >
                                {checked && <Check size={9} className="text-white" />}
                              </span>
                              <span className="truncate text-foreground">{c.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFilterDropdown;
