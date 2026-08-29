/**
 * Shared reusable components for the Contact Profile modal — replyagent
 * parity helpers (CountryPicker, AddressEditor, LanguagePicker, etc.).
 * These are pure UI; they fetch their own data (countries / languages /
 * timezones) lazily when opened.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  ChevronDown,
  Search,
  X,
  Loader2,
  MapPin,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const apiGet = async (url: string) => (await apiRequest("GET", url)).json();

// ─── Countries (cached at module level after first fetch) ───────────

let CACHED_COUNTRIES: Country[] | null = null;
let CACHED_COUNTRIES_PROMISE: Promise<Country[]> | null = null;

export interface Country {
  id: number;
  iso2: string;
  name: string;
  phone_code: string;
  placeholder?: string;
}

const FALLBACK_COUNTRIES: Country[] = [
  { id: 1, iso2: "US", name: "United States", phone_code: "1", placeholder: "(555) 555-5555" },
  { id: 2, iso2: "GB", name: "United Kingdom", phone_code: "44", placeholder: "7400 123456" },
  { id: 3, iso2: "PK", name: "Pakistan", phone_code: "92", placeholder: "300 1234567" },
  { id: 4, iso2: "IN", name: "India", phone_code: "91", placeholder: "98765 43210" },
  { id: 5, iso2: "BR", name: "Brazil", phone_code: "55", placeholder: "11 91234-5678" },
  { id: 6, iso2: "DE", name: "Germany", phone_code: "49", placeholder: "1512 3456789" },
  { id: 7, iso2: "FR", name: "France", phone_code: "33", placeholder: "6 12 34 56 78" },
  { id: 8, iso2: "ES", name: "Spain", phone_code: "34", placeholder: "612 34 56 78" },
  { id: 9, iso2: "IT", name: "Italy", phone_code: "39", placeholder: "320 123 4567" },
  { id: 10, iso2: "AE", name: "United Arab Emirates", phone_code: "971", placeholder: "50 123 4567" },
  { id: 11, iso2: "SA", name: "Saudi Arabia", phone_code: "966", placeholder: "5x xxx xxxx" },
  { id: 12, iso2: "AU", name: "Australia", phone_code: "61", placeholder: "412 345 678" },
  { id: 13, iso2: "CA", name: "Canada", phone_code: "1", placeholder: "(555) 555-5555" },
  { id: 14, iso2: "MX", name: "Mexico", phone_code: "52", placeholder: "55 1234 5678" },
  { id: 15, iso2: "ID", name: "Indonesia", phone_code: "62", placeholder: "812-345-6789" },
  { id: 16, iso2: "JP", name: "Japan", phone_code: "81", placeholder: "90-1234-5678" },
  { id: 17, iso2: "CN", name: "China", phone_code: "86", placeholder: "131 2345 6789" },
  { id: 18, iso2: "EG", name: "Egypt", phone_code: "20", placeholder: "10 12345678" },
];

export async function loadCountries(): Promise<Country[]> {
  if (CACHED_COUNTRIES) return CACHED_COUNTRIES;
  if (CACHED_COUNTRIES_PROMISE) return CACHED_COUNTRIES_PROMISE;
  CACHED_COUNTRIES_PROMISE = (async () => {
    try {
      const resp = await apiGet("/api/custom-fields/countries");
      const list = Array.isArray(resp) ? resp : resp?.countries ?? [];
      if (list.length) {
        CACHED_COUNTRIES = list as Country[];
        return CACHED_COUNTRIES;
      }
    } catch {
      // fall through
    }
    CACHED_COUNTRIES = FALLBACK_COUNTRIES;
    return CACHED_COUNTRIES;
  })();
  return CACHED_COUNTRIES_PROMISE;
}

// ─── CountryPicker ──────────────────────────────────────────────────

export function CountryPicker({
  value,
  onChange,
  buttonClassName = "",
}: {
  value: Country | null;
  onChange: (c: Country) => void;
  buttonClassName?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCountries().then(setCountries);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone_code.includes(q) ||
        c.iso2.toLowerCase().includes(q),
    );
  }, [countries, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`px-2 ${buttonClassName}`}
        >
          {value ? (
            <span className="flex items-center gap-1">
              <FlagBox iso={value.iso2} />
              <span className="text-xs">+{value.phone_code}</span>
            </span>
          ) : (
            <span className="text-xs">{t("contact_profile_shared.country_label")}</span>
          )}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("contact_profile_shared.search_placeholder")}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-64">
          {filtered.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{t("contact_profile_shared.no_match")}</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 text-sm text-left"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <FlagBox iso={c.iso2} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  +{c.phone_code}
                </span>
                {value?.id === c.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function FlagBox({ iso }: { iso: string }) {
  // Lightweight emoji-flag rendering: convert ISO-2 to regional indicator
  // codepoints. Falls back to the ISO text if the browser font doesn't
  // render emoji flags (e.g. Windows in some configurations).
  const code = iso?.toUpperCase() ?? "";
  if (code.length !== 2) return <span className="text-[10px]">{code}</span>;
  const flag = code
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
  return <span className="text-base leading-none">{flag}</span>;
}

// ─── PhoneFieldEditor ────────────────────────────────────────────────

export function PhoneFieldEditor({
  initialCountry,
  initialValue,
  initialType,
  onSave,
  onCancel,
  typeOptions,
  saving = false,
}: {
  initialCountry: Country | null;
  initialValue: string;
  initialType: string;
  onSave: (payload: {
    value: string;
    type: string;
    country_iso2: string;
    phone_code: string;
  }) => void;
  onCancel: () => void;
  typeOptions: { value: string; label: string }[];
  saving?: boolean;
}) {
  const { t } = useTranslation();
  const [country, setCountry] = useState<Country | null>(initialCountry);
  const [value, setValue] = useState(initialValue);
  const [type, setType] = useState(initialType);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CountryPicker value={country} onChange={setCountry} />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9\s\-()]/g, ""))}
        placeholder={country?.placeholder ?? t("contact_profile_shared.phone_placeholder")}
        className="flex-1 min-w-[180px]"
      />
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        disabled={saving}
      >
        <X className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!value || !country || saving}
        onClick={() =>
          onSave({
            value: value.replace(/\D/g, ""),
            type,
            country_iso2: country!.iso2,
            phone_code: country!.phone_code,
          })
        }
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

// ─── AddressEditor ──────────────────────────────────────────────────

export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export function AddressEditor({
  initial,
  onSave,
  onCancel,
  saving = false,
  disabled = false,
}: {
  initial: AddressValue;
  onSave: (next: AddressValue) => void;
  onCancel: () => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [a, setA] = useState<AddressValue>(initial);
  return (
    <div className="space-y-2">
      <Input
        value={a.street ?? ""}
        onChange={(e) => setA({ ...a, street: e.target.value })}
        placeholder={t("contact_profile_shared.street_placeholder")}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={a.city ?? ""}
          onChange={(e) => setA({ ...a, city: e.target.value })}
          placeholder={t("contact_profile_shared.city_placeholder")}
          disabled={disabled}
        />
        <Input
          value={a.state ?? ""}
          onChange={(e) => setA({ ...a, state: e.target.value })}
          placeholder={t("contact_profile_shared.state_placeholder")}
          disabled={disabled}
        />
        <Input
          value={a.zip ?? ""}
          onChange={(e) => setA({ ...a, zip: e.target.value })}
          placeholder={t("contact_profile_shared.zip_placeholder")}
          disabled={disabled}
        />
        <Input
          value={a.country ?? ""}
          onChange={(e) => setA({ ...a, country: e.target.value })}
          placeholder={t("contact_profile_shared.country_placeholder")}
          disabled={disabled}
        />
      </div>
      {!disabled && (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={saving}
          onClick={() => onSave(a)}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
      )}
    </div>
  );
}

// ─── Language / Locale / Timezone pickers ────────────────────────────

const COMMON_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ar", label: "Arabic" },
  { code: "ur", label: "Urdu" },
  { code: "hi", label: "Hindi" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
];

const COMMON_LOCALES = [
  "en_US",
  "en_GB",
  "es_ES",
  "es_MX",
  "pt_BR",
  "pt_PT",
  "fr_FR",
  "de_DE",
  "it_IT",
  "ar_AE",
  "ur_PK",
  "hi_IN",
  "zh_CN",
  "ja_JP",
  "ko_KR",
  "ru_RU",
  "tr_TR",
  "id_ID",
];

export function LanguagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("contact_profile_shared.select_language_placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {COMMON_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            {t(`contact_profile_shared.languages.${l.code}`)} ({l.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LocalePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("contact_profile_shared.select_locale_placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {COMMON_LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TimezonePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // Use Intl supportedValuesOf when available; fall back to a curated list.
  const timezones = useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.("timeZone");
      if (Array.isArray(supported) && supported.length) return supported as string[];
    } catch {}
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Sao_Paulo",
      "Europe/London",
      "Europe/Berlin",
      "Europe/Madrid",
      "Europe/Paris",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Dubai",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Asia/Singapore",
      "Australia/Sydney",
    ];
  }, []);

  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t("contact_profile_shared.select_timezone_placeholder")} />
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-64">
          {timezones.map((tz) => (
            <SelectItem key={tz} value={tz}>
              {tz}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}

// ─── Custom Field Renderer ──────────────────────────────────────────

export interface CustomFieldDescriptor {
  id?: string | number;
  slug: string;
  label: string;
  content_type: string; // TEXT | NUMBER | DATE | DATETIME | PHONE | URL | CURRENCY | EMAIL
  input_type?: string; // text | textarea | select | radio | multiselect | date | number | email
  properties?: { value: string; label?: string }[];
  description?: string;
}

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  countryHint,
}: {
  field: CustomFieldDescriptor;
  value: any;
  onChange: (v: any) => void;
  countryHint?: Country | null;
}) {
  const { t } = useTranslation();
  const ct = String(field.content_type ?? "").toUpperCase();
  const it = String(field.input_type ?? "").toLowerCase();

  if (it === "multiselect" || ct === "MULTISELECT") {
    const arr: string[] = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div className="flex flex-wrap gap-1">
        {(field.properties ?? []).map((p) => {
          const checked = arr.includes(p.value);
          return (
            <button
              key={p.value}
              type="button"
              className={`text-xs px-2 py-1 rounded border ${
                checked
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted/50"
              }`}
              onClick={() =>
                onChange(
                  checked
                    ? arr.filter((x) => x !== p.value)
                    : [...arr, p.value],
                )
              }
            >
              {p.label ?? p.value}
            </button>
          );
        })}
      </div>
    );
  }

  if (it === "select" || it === "radio") {
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("contact_profile_shared.select_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {(field.properties ?? []).map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label ?? p.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (it === "textarea") {
    return (
      <textarea
        className="w-full border rounded p-2 text-sm"
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (ct === "PHONE") {
    return (
      <div className="flex gap-2">
        {countryHint && <FlagBox iso={countryHint.iso2} />}
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("contact_profile_shared.phone_number_placeholder")}
        />
      </div>
    );
  }

  if (ct === "DATE") {
    return (
      <Input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (ct === "DATETIME") {
    return (
      <Input
        type="datetime-local"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (ct === "NUMBER") {
    return (
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (ct === "CURRENCY") {
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          step="0.01"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (ct === "URL") {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">https://</span>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("contact_profile_shared.url_placeholder")}
        />
      </div>
    );
  }

  if (ct === "EMAIL" || it === "email") {
    return (
      <Input
        type="email"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("contact_profile_shared.email_placeholder")}
      />
    );
  }

  // Default: TEXT
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("contact_profile_shared.enter_value_placeholder")}
    />
  );
}

// ─── Optin / Channel chip ──────────────────────────────────────────

export function OptinChip({
  channel,
  subscribed,
  onToggle,
}: {
  channel: string;
  subscribed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        subscribed
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
      }`}
      title={
        subscribed
          ? t("contact_profile_shared.unsubscribe_channel", { channel })
          : t("contact_profile_shared.optin_channel", { channel })
      }
    >
      {channel} {subscribed ? "✓" : "✗"}
    </button>
  );
}
