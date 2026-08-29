import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, Lock, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface PasswordErrors {
  currentPassword: string;
  newPassword: string;
  retypePassword: string;
}

const EMPTY_ERRORS: PasswordErrors = {
  currentPassword: "",
  newPassword: "",
  retypePassword: "",
};

// The complexity rules the server enforces too — kept in sync with
// `UsersService.changePassword` so a client-side pass is never weaker than
// the server's pass.
const complexityRules = [
  { key: "min_chars", test: (p: string) => p.length >= 8 },
  { key: "upper_case", test: (p: string) => /[A-Z]/.test(p) },
  { key: "special_char", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  { key: "number", test: (p: string) => /\d/.test(p) },
];

/**
 * Defined at MODULE scope on purpose. When this lived inside
 * ChangePasswordSection, React re-created it on every parent render,
 * remounting the underlying <input> and dropping focus after a single
 * keystroke. Hoisting it out of the parent keeps the input mounted across
 * renders so typing flows normally.
 */
interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  visible: boolean;
  toggleVisible: () => void;
  autoComplete: string;
  inputCls: string;
  labelCls: string;
  subClass: string;
  hideLabel: string;
  showLabel: string;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  visible,
  toggleVisible,
  autoComplete,
  inputCls,
  labelCls,
  subClass,
  hideLabel,
  showLabel,
}) => (
  <div className="space-y-2">
    <label htmlFor={id} className={labelCls}>
      {label}
    </label>
    <div className="relative max-w-sm">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={cn(inputCls, error && "!border-rose-500 focus:!ring-rose-500/30")}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={toggleVisible}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 transition-colors",
          subClass,
          "hover:text-primary",
        )}
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
    {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}
  </div>
);

const ChangePasswordSection = () => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { toast } = useToast();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [errors, setErrors] = useState<PasswordErrors>(EMPTY_ERRORS);
  const [show, setShow] = useState<{ [k: string]: boolean }>({});

  // Design tokens ─────────────────────────────────────────
  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-500" : "text-slate-400";
  const softBg = dark ? "bg-slate-950/40" : "bg-slate-50/50";
  const softBorder = dark ? "border-slate-800" : "border-slate-100";

  const inputCls = cn(
    "w-full h-11 rounded-xl text-[13px] font-bold transition-all px-4 pr-12 border outline-none",
    "focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
    dark ? "bg-slate-950/50 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900",
  );
  const primaryBtn =
    "h-11 px-7 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2";
  const labelCls = cn("block text-[11px] font-semibold", sub);

  // Live client-side validation feeds the inline rule checklist + disables
  // Save. Server still re-validates, so a successful API call is a guarantee
  // of correctness even when the client is bypassed.
  const validatePassword = (password: string): string => {
    const failed = complexityRules.filter((r) => !r.test(password)).map((r) => t(`password.${r.key}`));
    return failed.join(", ");
  };

  useEffect(() => {
    const newPasswordError = newPassword ? validatePassword(newPassword) : "";
    const retypeError =
      retypePassword && newPassword !== retypePassword ? t("password.no_match") : "";
    setErrors((prev) => ({
      ...prev,
      newPassword: newPasswordError,
      retypePassword: retypeError,
    }));
  }, [newPassword, retypePassword]);

  const isSaveDisabled =
    !currentPassword ||
    !newPassword ||
    !retypePassword ||
    !!errors.newPassword ||
    !!errors.retypePassword;

  const toggleShow = (id: string) =>
    setShow((prev) => ({ ...prev, [id]: !prev[id] }));

  const mutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
      retypePassword: string;
    }) => {
      const res = await apiRequest("POST", "/api/users/change-password", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t("password.changedTitle", { defaultValue: "Password Changed" }),
        description:
          data?.message ?? t("password.changedDesc", {
            defaultValue: "Your password has been successfully updated.",
          }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setRetypePassword("");
      setErrors(EMPTY_ERRORS);
    },
    onError: (error: any) => {
      // ApiError carries the parsed body on `error.body`. Backend returns
      // `{ errors: { field: message } }` on validation failures — pull each
      // field's message into the per-field error state so the wrong-input
      // field gets highlighted. The global `handleApiError` already skips
      // its toast when it sees a structured `errors` body, so non-field
      // errors (network, 500, etc.) are already surfaced to the user there
      // and don't need a second toast here.
      const serverErrors: Partial<PasswordErrors> | undefined =
        error?.body?.errors ?? error?.errors;
      if (serverErrors && typeof serverErrors === "object") {
        setErrors((prev) => ({
          ...prev,
          currentPassword: serverErrors.currentPassword ?? "",
          newPassword: serverErrors.newPassword ?? prev.newPassword,
          retypePassword: serverErrors.retypePassword ?? prev.retypePassword,
        }));
      }
    },
  });

  const handleSave = () => {
    if (isSaveDisabled || mutation.isPending) return;
    // Reset only the currentPassword error each submit — keeps client-side
    // complexity errors in place so the user can see why the rule fails.
    setErrors((prev) => ({ ...prev, currentPassword: "" }));
    mutation.mutate({ currentPassword, newPassword, retypePassword });
  };

  return (
    <Card className={cn("rounded-[2rem] border overflow-hidden shadow-sm transition-all duration-300", card, border)}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={cn("px-8 py-5 border-b flex items-center justify-between", border)}>
          <div className="flex items-center gap-4">
            <div className={cn("p-2.5 rounded-xl shadow-sm", "bg-primary/10")}>
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className={cn("text-[16px] font-bold tracking-tight", text)}>
                {t("change_password", { defaultValue: "Change password" })}
              </h1>
              <p className={cn("text-[11px] font-medium mt-0.5 opacity-60 max-w-2xl", sub)}>
                {t("password.subtitle", {
                  defaultValue: "Update the password for your user account.",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled || mutation.isPending}
            className={primaryBtn}
          >
            {mutation.isPending && <Loader2 size={12} className="animate-spin" />}
            {t("common.save", { defaultValue: "Save" })}
          </button>
        </div>

        {/* Body — one card, fields on the left and the requirements
            checklist filling the space on the right instead of stacking
            full-width above the (narrower) fields. */}
        <div className="p-8">
          <div className={cn("rounded-[1.5rem] border grid grid-cols-1 lg:grid-cols-2", softBg, softBorder)}>
            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className={cn("p-6 space-y-5 border-b lg:border-b-0 lg:border-r", softBorder)}
            >
              <PasswordField
                id="current-password"
                label={t("password.currentLabel", { defaultValue: "Current Password" })}
                value={currentPassword}
                onChange={setCurrentPassword}
                error={errors.currentPassword}
                visible={!!show["current-password"]}
                toggleVisible={() => toggleShow("current-password")}
                autoComplete="current-password"
                inputCls={inputCls}
                labelCls={labelCls}
                subClass={sub}
                hideLabel={t("password.hide")}
                showLabel={t("password.show")}
              />
              <PasswordField
                id="new-password"
                label={t("password.newLabel", { defaultValue: "New Password" })}
                value={newPassword}
                onChange={setNewPassword}
                error={errors.newPassword}
                visible={!!show["new-password"]}
                toggleVisible={() => toggleShow("new-password")}
                autoComplete="new-password"
                inputCls={inputCls}
                labelCls={labelCls}
                subClass={sub}
                hideLabel={t("password.hide")}
                showLabel={t("password.show")}
              />
              <PasswordField
                id="retype-password"
                label={t("password.retypeLabel", { defaultValue: "Retype New Password" })}
                value={retypePassword}
                onChange={setRetypePassword}
                error={errors.retypePassword}
                visible={!!show["retype-password"]}
                toggleVisible={() => toggleShow("retype-password")}
                autoComplete="new-password"
                inputCls={inputCls}
                labelCls={labelCls}
                subClass={sub}
                hideLabel={t("password.hide")}
                showLabel={t("password.show")}
              />
              {/* Submit button is in the header — keep the form element wrapping
                  the inputs so Enter-to-submit works without an extra button. */}
              <button type="submit" hidden disabled={isSaveDisabled || mutation.isPending} />
            </form>

            {/* Requirements */}
            <div className="p-6 space-y-3">
              <p className={cn("text-[12px] font-semibold text-primary")}>
                {t("password.requirements", { defaultValue: "Password Requirements" })}
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {complexityRules.map((r) => {
                  const ok = newPassword ? r.test(newPassword) : false;
                  return (
                    <div key={r.key} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                          ok
                            ? "bg-emerald-500/15 text-emerald-500"
                            : cn(dark ? "bg-slate-800" : "bg-slate-200", sub),
                        )}
                      >
                        {ok ? <Check size={10} /> : <X size={10} />}
                      </div>
                      <span
                        className={cn(
                          "text-[12px] font-bold",
                          ok ? "text-emerald-600 dark:text-emerald-400" : sub,
                        )}
                      >
                        {t(`password.${r.key}`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordSection;
