import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Type-to-confirm input. Mirrors replyagent's `DeletionGuard.vue` —
 * destructive actions (delete account / number, reconnect that wipes state)
 * require the user to type the literal phrase before the Delete button enables.
 *
 *   <DeletionGuard onValid={setGuardOk} />
 *
 * The parent owns the boolean state; we only signal valid/invalid via the
 * callback. Default phrase is `DELETE` to match replyagent.
 */
interface Props {
  phrase?: string;
  onValid: (ok: boolean) => void;
  className?: string;
}

export default function DeletionGuard({ phrase, onValid, className }: Props) {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { t } = useTranslation();
  const [text, setText] = useState("");
  // Random 5-digit confirmation code (replyagent parity — a fresh code per mount
  // is harder to muscle-memory past than a static "DELETE"). An explicit `phrase`
  // prop still overrides it for callers that want a fixed word.
  const [randomCode] = useState(() => String(Math.floor(10000 + Math.random() * 90000)));
  const target = phrase ?? randomCode;

  useEffect(() => {
    onValid(text.trim().toUpperCase() === target.toUpperCase());
  }, [text, target, onValid]);

  return (
    <div className={cn("space-y-2", className)}>
      <label className={cn("text-[11px] font-semibold", dark ? "text-slate-400" : "text-slate-600")}>
        {t("deletion_guard.type_prefix")} <span className="text-rose-500">{target}</span>{" "}
        {t("deletion_guard.type_suffix")}
      </label>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={target}
        className={cn(
          "h-11 rounded-xl text-[13px] font-bold",
          dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      />
    </div>
  );
}
