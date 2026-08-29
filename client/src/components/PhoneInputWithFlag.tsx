import React, { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { COUNTRIES as countries } from "@/lib/countries";
import { COUNTRY_PLACEHOLDERS } from "@/lib/countryPlaceholders";
import { onlyDigits } from "@/lib/phone";
import { useTranslation } from "react-i18next";

/**
 * Example phone-number placeholder for a country code. Uses the exact match
 * when available, else falls back to another country with the same dial code
 * (same number format — e.g. Aland Islands +358 borrows Finland's), then a
 * generic hint.
 *
 * Lifted from pages/Agency/AddAgentForm.tsx so the agency and workspace forms
 * share one implementation.
 */
export function phonePlaceholder(code: string, fallback: string = "Phone number"): string {
  if (COUNTRY_PLACEHOLDERS[code]) return COUNTRY_PLACEHOLDERS[code];
  const dial = countries.find((c) => c.code === code)?.dial;
  if (dial) {
    const sameDial = countries.find(
      (c) => c.dial === dial && COUNTRY_PLACEHOLDERS[c.code],
    );
    if (sameDial) return COUNTRY_PLACEHOLDERS[sameDial.code];
  }
  return fallback;
}

/**
 * Country selector chip — flag + dial code, opens a searchable popover with
 * the full country list grouped alphabetically. Lives on the left of the phone
 * input and reserves a fixed 84px so the input's placeholder is never clipped.
 *
 * Replicated verbatim from pages/Agency/AddAgentForm.tsx so both forms behave
 * identically. Any future tweaks should land here.
 */
function CountrySelector({
  value,
  onChange,
  isDark,
}: {
  value: string;
  onChange: (country: { code: string; dial: string; name: string }) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected =
    countries.find((c) => c.code === value) ||
    countries.find((c) => c.code === "US") ||
    countries[0];

  // Manual filter — by name, dial code, or ISO code. cmdk's fuzzy match was unreliable.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    const qd = q.replace("+", "");
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.replace("+", "").includes(qd) ||
        c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            // Fixed 84px so a long dial code (e.g. +1264) never spills into the input.
            "absolute left-0 top-0 bottom-0 z-10 flex items-center justify-start px-3 gap-1.5 border-r transition-colors rounded-l w-[84px] overflow-hidden",
            isDark
              ? "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
              : "border-slate-200 bg-slate-50 hover:bg-slate-100",
          )}
        >
          <img
            src={`https://flagcdn.com/w20/${selected.code.toLowerCase()}.png`}
            alt={selected.code}
            className="w-4 h-auto"
          />
          <span
            className={cn(
              "text-[11px] font-bold",
              isDark ? "text-slate-300" : "text-slate-700",
            )}
          >
            {selected.dial}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[280px] p-0 shadow-xl border",
          isDark ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200",
        )}
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="p-2">
          <input
            autoFocus
            placeholder={t("phone_input_with_flag.search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "w-full h-8 px-3 rounded-md border text-[12px] outline-none transition-colors",
              isDark
                ? "bg-[#0b1120] border-slate-700 text-white placeholder:text-slate-500 focus:border-slate-600"
                : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-300",
            )}
          />
        </div>
        {/* Country list grouped by first letter (replyagent parity) */}
        <div className="max-h-60 overflow-y-auto pb-2">
          {filtered.length === 0 ? (
            <div className="text-[12px] px-3 py-3 text-slate-400">
              {t("phone_input_with_flag.no_countries_found")}
            </div>
          ) : (
            filtered.map((country, idx) => {
              const letter = country.name.charAt(0).toUpperCase();
              const showHeader =
                idx === 0 ||
                filtered[idx - 1].name.charAt(0).toUpperCase() !== letter;
              return (
                <React.Fragment key={country.code}>
                  {showHeader && (
                    <div
                      className={cn(
                        "px-3 pt-2 pb-1 text-[12px] font-bold",
                        isDark ? "text-slate-200" : "text-slate-900",
                      )}
                    >
                      {letter}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(country);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-1.5 cursor-pointer text-[12px] text-left",
                      isDark
                        ? "hover:bg-slate-800 text-slate-200"
                        : "hover:bg-slate-50 text-slate-700",
                    )}
                  >
                    <img
                      src={`https://flagcdn.com/w20/${country.code.toLowerCase()}.png`}
                      alt={country.code}
                      className="w-4 h-auto shrink-0"
                    />
                    <span className="flex-1 truncate">{country.name}</span>
                    <span
                      className={cn(
                        "shrink-0",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      ({country.dial})
                    </span>
                    {selected.code === country.code && (
                      <Check className="w-3 h-3 text-primary shrink-0" />
                    )}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface PhoneInputWithFlagProps {
  /** ISO-2 country code (e.g. "US"). Empty string falls back to US in the picker. */
  country: string;
  onCountryChange: (iso2: string) => void;
  /** Phone number value (digits only is fine; component strips non-digits). */
  value: string;
  onChange: (digits: string) => void;
  /** Override the auto-generated placeholder. */
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Dark-mode flag so the picker chip + popover match the host form's theme. */
  isDark?: boolean;
}

/**
 * Phone input with country flag dropdown — replyagent parity.
 *
 * Wraps the same CountrySelector used by pages/Agency/AddAgentForm.tsx so the
 * workspace agent form and the agency add-user form look and behave identically.
 * Placeholder = example local number for the selected country (via
 * COUNTRY_PLACEHOLDERS), so the user sees the expected digit pattern.
 */
export function PhoneInputWithFlag({
  country,
  onCountryChange,
  value,
  onChange,
  placeholder,
  inputClassName,
  disabled,
  isDark = false,
}: PhoneInputWithFlagProps) {
  const { t } = useTranslation();
  const effectiveCountry = country || "US";
  return (
    <div className="relative w-full">
      <CountrySelector
        isDark={isDark}
        value={effectiveCountry}
        onChange={(c) => onCountryChange(c.code)}
      />
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(onlyDigits(e.target.value))}
        placeholder={placeholder ?? phonePlaceholder(effectiveCountry, t("phone_input_with_flag.phone_number_fallback"))}
        disabled={disabled}
        // pl-[84px] MUST come after inputClassName so it wins tailwind-merge
        // when the caller passes its own px-* class.
        className={cn(inputClassName, "pl-[84px]")}
      />
    </div>
  );
}
