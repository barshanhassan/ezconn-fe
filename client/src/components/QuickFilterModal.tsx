import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Filter as FilterIcon, Plus, ChevronDown, Check, ChevronLeft, Search, Pencil, Trash2,
  Tag, Hash, User, Link2, Phone, Mail, Clock, MessageSquare, FileText, Globe, AtSign,
  Users, BadgeCheck, UserPlus, BellRing, Calendar, DollarSign, Percent, Activity, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export type FilterFieldType = "text" | "number" | "date" | "boolean" | "select" | "tag" | "agent";

export interface FilterFieldOption {
  key: string;
  module: string;
  label: string;
  type: FilterFieldType;
  options?: { value: string; label: string }[];
}

export interface FilterFieldGroup {
  key: string;
  label: string;
  fields: FilterFieldOption[];
}

export interface QuickFilterCondition {
  id: string;
  module: string;
  fieldKey: string;
  fieldType: FilterFieldType;
  fieldLabel: string;
  groupLabel: string;
  operator: string;
  value: any;
  options?: { value: string; label: string }[];
}

// Operator vocabulary matches AudienceFilterService (shared with the Broadcasts
// audience builder) — replyagent's condition builder.
export const FILTER_OPERATORS: Record<FilterFieldType, { value: string; label: string; needsValue: boolean }[]> = {
  text: [
    { value: "is", label: "Is", needsValue: true },
    { value: "is_not", label: "Is not", needsValue: true },
    { value: "contains", label: "Contains", needsValue: true },
    { value: "does_not_contain", label: "Does not contain", needsValue: true },
    { value: "begins_with", label: "Begins with", needsValue: true },
    { value: "not_starting_with", label: "Does not begin with", needsValue: true },
    { value: "has_value", label: "Has any value", needsValue: false },
    { value: "is_null", label: "Is empty", needsValue: false },
  ],
  number: [
    { value: "is", label: "Is", needsValue: true },
    { value: "is_not", label: "Is not", needsValue: true },
    { value: "greater_than", label: "Greater than", needsValue: true },
    { value: "less_than", label: "Less than", needsValue: true },
    { value: "has_value", label: "Has any value", needsValue: false },
    { value: "is_null", label: "Is empty", needsValue: false },
  ],
  date: [
    { value: "is", label: "On", needsValue: true },
    { value: "before", label: "Before", needsValue: true },
    { value: "after", label: "After", needsValue: true },
    { value: "between", label: "Between", needsValue: true },
    { value: "has_value", label: "Has any value", needsValue: false },
    { value: "is_null", label: "Is empty", needsValue: false },
  ],
  boolean: [{ value: "is", label: "Is", needsValue: true }],
  select: [
    { value: "is", label: "Is", needsValue: true },
    { value: "is_not", label: "Is not", needsValue: true },
  ],
  tag: [
    { value: "is", label: "Is", needsValue: true },
    { value: "is_not", label: "Is not", needsValue: true },
  ],
  agent: [
    { value: "is", label: "Is", needsValue: true },
    { value: "is_not", label: "Is not", needsValue: true },
  ],
};

// Per-field icon, matching replyagent's condition picker cards.
const FIELD_ICONS: Record<string, React.ComponentType<any>> = {
  tags: Tag,
  opportunity_tag: Tag,
  id: Hash,
  full_name: User,
  first_name: User,
  last_name: User,
  title: User,
  source: Link2,
  phone: Phone,
  whatsapp_number: Phone,
  phone_country_code: MessageSquare,
  email: Mail,
  created_at: Clock,
  opp_status: Activity,
  status: Activity,
  value: DollarSign,
  closing_date: Calendar,
  confidence: Percent,
  assign_to: UserCheck,
  wa_id: Phone,
  username: AtSign,
  follower_count: Users,
  verified: BadgeCheck,
  follows_us: UserPlus,
  we_follow_them: UserPlus,
  last_interaction: Clock,
  opt_in: BellRing,
  locale: Globe,
  language: Globe,
  timezone: Clock,
  gender: User,
};

const iconFor = (key: string) => FIELD_ICONS[key] ?? FileText;

/** Human-readable summary of one condition — the green preview strip. */
function describeCondition(c: QuickFilterCondition, tagOptions: { id: string; name: string }[], agentOptions: { id: string; name: string }[]) {
  const ops = FILTER_OPERATORS[c.fieldType] ?? FILTER_OPERATORS.text;
  const opLabel = (ops.find((o) => o.value === c.operator)?.label ?? c.operator).toLowerCase();
  const needsValue = ops.find((o) => o.value === c.operator)?.needsValue ?? true;
  if (!needsValue) return `${c.fieldLabel} ${opLabel}`;
  let shown: string;
  if (c.fieldType === "boolean") shown = c.value === true ? "Yes" : c.value === false ? "No" : "";
  else if (c.fieldType === "agent") shown = agentOptions.find((a) => a.id === String(c.value))?.name ?? String(c.value ?? "");
  else if (c.fieldType === "select") shown = c.options?.find((o) => o.value === String(c.value))?.label ?? String(c.value ?? "");
  else if (c.operator === "between") shown = `${c.value?.from ?? ""} – ${c.value?.to ?? ""}`;
  else shown = String(c.value ?? "");
  return `${c.fieldLabel} ${opLabel} "${shown}"`;
}

export default function QuickFilterModal({
  open,
  onClose,
  groups,
  tagOptions,
  agentOptions,
  conditions,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  groups: FilterFieldGroup[];
  tagOptions: { id: string; name: string }[];
  agentOptions: { id: string; name: string }[];
  conditions: QuickFilterCondition[];
  onApply: (next: QuickFilterCondition[]) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"list" | "pick" | "configure">("list");
  const [draft, setDraft] = useState<QuickFilterCondition[]>(conditions);
  const [started, setStarted] = useState(conditions.length > 0);
  const [pickSearch, setPickSearch] = useState("");
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [editing, setEditing] = useState<QuickFilterCondition | null>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  // Re-seed the working copy each time the modal opens so Close discards edits.
  useEffect(() => {
    if (open) {
      setDraft(conditions);
      setStarted(conditions.length > 0);
      setStep("list");
      setEditing(null);
      setPickSearch("");
    }
  }, [open]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) setQuickMenuOpen(false);
    };
    if (quickMenuOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [quickMenuOpen]);

  const q = pickSearch.trim().toLowerCase();
  const pickGroups = useMemo(
    () =>
      q
        ? groups
            .map((g) => ({ ...g, fields: g.fields.filter((f) => f.label.toLowerCase().includes(q)) }))
            .filter((g) => g.fields.length > 0)
        : groups,
    [groups, q],
  );

  if (!open) return null;

  const startConfigure = (group: FilterFieldGroup, field: FilterFieldOption) => {
    const ops = FILTER_OPERATORS[field.type] ?? FILTER_OPERATORS.text;
    setEditing({
      id: Date.now().toString(),
      module: field.module,
      fieldKey: field.key,
      fieldType: field.type,
      fieldLabel: field.label,
      groupLabel: group.label,
      operator: ops[0].value,
      value: field.type === "boolean" ? true : "",
      options: field.options,
    });
    setStep("configure");
  };

  const saveCondition = () => {
    if (!editing) return;
    setDraft((prev) => {
      const exists = prev.some((c) => c.id === editing.id);
      return exists ? prev.map((c) => (c.id === editing.id ? editing : c)) : [...prev, editing];
    });
    setEditing(null);
    setStarted(true);
    setStep("list");
  };

  const editingOps = editing ? FILTER_OPERATORS[editing.fieldType] ?? FILTER_OPERATORS.text : [];
  const editingNeedsValue = editing ? editingOps.find((o) => o.value === editing.operator)?.needsValue ?? true : false;

  const selectClass =
    "w-full h-11 px-3 pr-9 text-sm rounded-md border border-input bg-white dark:bg-background text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-[860px] bg-white dark:bg-background rounded-xl shadow-2xl border border-border overflow-hidden">
        {/* ── Step 1: Quick filter (condition list) ───────────────────────── */}
        {step === "list" && (
          <>
            <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-5 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("conversations_inbox.quick_filter.title")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("conversations_inbox.quick_filter.subtitle")}</p>
              </div>
              <div className="relative" ref={quickMenuRef}>
                <button
                  type="button"
                  onClick={() => setQuickMenuOpen((o) => !o)}
                  className="flex items-center gap-2 h-11 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <FilterIcon size={16} />
                  {t("conversations_inbox.quick_filter.select_or_create")}
                  <ChevronDown size={14} />
                </button>
                {quickMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-background border border-border rounded-md shadow-lg py-1 z-10">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted text-left"
                      onClick={() => {
                        setQuickMenuOpen(false);
                        setStarted(true);
                      }}
                    >
                      <Plus size={15} /> {t("conversations_inbox.quick_filter.create_new")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-7 py-6 min-h-[360px] max-h-[60vh] overflow-y-auto">
              {!started && draft.length === 0 ? (
                <div className="h-[320px] flex flex-col items-center justify-center text-center">
                  <FilterIcon size={72} className="text-primary/25 mb-5" strokeWidth={1.5} />
                  <p className="text-xl text-muted-foreground">{t("conversations_inbox.quick_filter.empty")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {draft.map((c) => {
                    const Icon = iconFor(c.fieldKey);
                    return (
                      <div key={c.id} className="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
                        <span className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon size={17} className="text-primary" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{describeCondition(c, tagOptions, agentOptions)}</p>
                          <p className="text-xs text-muted-foreground">{c.groupLabel}</p>
                        </div>
                        <button
                          type="button"
                          className="p-2 rounded hover:bg-muted"
                          onClick={() => { setEditing(c); setStep("configure"); }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded hover:bg-muted text-destructive"
                          onClick={() => setDraft((prev) => prev.filter((x) => x.id !== c.id))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => { setPickSearch(""); setStep("pick"); }}
                    className="flex items-center justify-center gap-2 w-[240px] h-12 rounded-md border border-dashed border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
                  >
                    <Plus size={16} /> {t("conversations_inbox.quick_filter.add_condition")}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-6 rounded-md border border-input text-sm font-medium hover:bg-muted transition-colors"
              >
                {t("conversations_inbox.quick_filter.close")}
              </button>
              <button
                type="button"
                onClick={() => { onApply(draft); onClose(); }}
                className="h-11 px-7 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
              >
                {t("conversations_inbox.quick_filter.apply")}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Select a condition (grouped field picker) ───────────── */}
        {step === "pick" && (
          <>
            <div className="flex items-start gap-4 px-7 pt-6 pb-5">
              <span className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <FilterIcon size={20} className="text-white" />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{t("conversations_inbox.quick_filter.select_condition")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("conversations_inbox.quick_filter.select_condition_sub")}</p>
              </div>
              <button type="button" onClick={() => setStep("list")} className="p-2 rounded-md hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="px-7">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={pickSearch}
                  onChange={(e) => setPickSearch(e.target.value)}
                  placeholder={t("conversations_inbox.quick_filter.search")}
                  className="w-full h-12 pl-10 pr-3 text-sm rounded-md border border-input bg-white dark:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="px-7 py-5 max-h-[52vh] overflow-y-auto">
              {pickGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">{t("custom_dropdown.no_results")}</p>
              )}
              {pickGroups.map((g) => (
                <div key={g.key} className="mb-6 last:mb-0">
                  <h3 className="text-base font-bold text-foreground mb-3">{g.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {g.fields.map((f) => {
                      const Icon = iconFor(f.key);
                      return (
                        <button
                          key={`${g.key}-${f.key}`}
                          type="button"
                          onClick={() => startConfigure(g, f)}
                          className="flex items-center gap-3 border border-border rounded-lg px-4 py-3.5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <span className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon size={17} className="text-primary" />
                          </span>
                          <span className="text-sm text-foreground truncate">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Configure condition ─────────────────────────────────── */}
        {step === "configure" && editing && (
          <>
            <div className="flex items-start gap-4 px-7 pt-6 pb-5">
              <span className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <FilterIcon size={20} className="text-white" />
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{t("conversations_inbox.quick_filter.configure")}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{t("conversations_inbox.quick_filter.configure_sub")}</p>
              </div>
              <button type="button" onClick={() => { setEditing(null); setStep("list"); }} className="p-2 rounded-md hover:bg-muted">
                <X size={18} />
              </button>
            </div>

            <div className="px-7 pb-2 space-y-5 max-h-[58vh] overflow-y-auto">
              <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-muted/30">
                {(() => {
                  const Icon = iconFor(editing.fieldKey);
                  return (
                    <span className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon size={17} className="text-primary" />
                    </span>
                  );
                })()}
                <div>
                  <p className="text-sm font-semibold text-foreground">{editing.fieldLabel}</p>
                  <p className="text-xs text-muted-foreground">{editing.groupLabel}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("conversations_inbox.quick_filter.where")}</label>
                <div className="relative">
                  <select
                    value={editing.operator}
                    onChange={(e) => {
                      const op = e.target.value;
                      setEditing({ ...editing, operator: op, value: op === "between" ? { from: "", to: "" } : editing.value });
                    }}
                    className={selectClass}
                  >
                    {editingOps.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {editingNeedsValue && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{editing.fieldLabel}</label>

                  {editing.fieldType === "tag" && (
                    <div className="relative">
                      <select
                        value={String(editing.value ?? "")}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">—</option>
                        {tagOptions.map((tg) => (
                          <option key={tg.id} value={tg.name}>{tg.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  )}

                  {editing.fieldType === "agent" && (
                    <div className="relative">
                      <select
                        value={String(editing.value ?? "")}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">—</option>
                        {agentOptions.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  )}

                  {editing.fieldType === "select" && (
                    <div className="relative">
                      <select
                        value={String(editing.value ?? "")}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">—</option>
                        {(editing.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  )}

                  {editing.fieldType === "boolean" && (
                    <div className="relative">
                      <select
                        value={editing.value === false ? "false" : "true"}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value === "true" })}
                        className={selectClass}
                      >
                        <option value="true">{t("conversations_inbox.filters.yes")}</option>
                        <option value="false">{t("conversations_inbox.filters.no")}</option>
                      </select>
                      <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  )}

                  {editing.fieldType === "date" && editing.operator === "between" && (
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={editing.value?.from ?? ""}
                        onChange={(e) => setEditing({ ...editing, value: { ...editing.value, from: e.target.value } })}
                        className="w-1/2 h-11 px-3 text-sm rounded-md border border-input bg-white dark:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="date"
                        value={editing.value?.to ?? ""}
                        onChange={(e) => setEditing({ ...editing, value: { ...editing.value, to: e.target.value } })}
                        className="w-1/2 h-11 px-3 text-sm rounded-md border border-input bg-white dark:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {editing.fieldType === "date" && editing.operator !== "between" && (
                    <input
                      type="date"
                      value={String(editing.value ?? "")}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      className="w-full h-11 px-3 text-sm rounded-md border border-input bg-white dark:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}

                  {(editing.fieldType === "text" || editing.fieldType === "number") && (
                    <input
                      type={editing.fieldType === "number" ? "number" : "text"}
                      value={String(editing.value ?? "")}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      placeholder={t("conversations_inbox.filters.value_placeholder")}
                      className="w-full h-11 px-3 text-sm rounded-md border border-input bg-white dark:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5 rounded-md border border-primary/40 bg-primary/10 px-4 py-3">
                <Check size={15} className="text-primary shrink-0" />
                <span className="text-sm text-foreground truncate">{describeCondition(editing, tagOptions, agentOptions)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-7 py-4">
              <button
                type="button"
                onClick={() => setStep(draft.some((c) => c.id === editing.id) ? "list" : "pick")}
                className="flex items-center gap-1.5 h-11 px-5 rounded-md border border-input text-sm font-medium hover:bg-muted transition-colors"
              >
                <ChevronLeft size={15} /> {t("conversations_inbox.quick_filter.back")}
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setEditing(null); setStep("list"); }}
                  className="h-11 px-6 rounded-md border border-input text-sm font-medium hover:bg-muted transition-colors"
                >
                  {t("conversations_inbox.quick_filter.close")}
                </button>
                <button
                  type="button"
                  onClick={saveCondition}
                  className="flex items-center gap-2 h-11 px-6 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Check size={15} /> {t("conversations_inbox.quick_filter.save_condition")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
