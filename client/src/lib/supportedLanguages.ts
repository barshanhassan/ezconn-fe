/**
 * The only languages Agentawk's UI is actually translated into. Every
 * language picker in the app (agency topbar, workspace topbar, notification
 * language, agent "Interface Language") should pull from this single list —
 * showing anything beyond it would be a dropdown option that silently does
 * nothing when selected.
 */
export interface SupportedLanguage {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", label: "English (U.S)", flag: "us" },
  { code: "es", label: "Español", flag: "es" },
  { code: "pt", label: "Português do Brasil", flag: "br" },
  { code: "ar", label: "العربية", flag: "sa" },
  { code: "fr", label: "Français", flag: "fr" },
  { code: "de", label: "Deutsch", flag: "de" },
  { code: "hi", label: "हिन्दी", flag: "in" },
  { code: "ur", label: "اردو", flag: "pk" },
  { code: "zh", label: "中文(简体)", flag: "cn" },
  { code: "ja", label: "日本語", flag: "jp" },
  { code: "ru", label: "Русский", flag: "ru" },
  { code: "tr", label: "Türkçe", flag: "tr" },
  { code: "it", label: "Italiano", flag: "it" },
  { code: "id", label: "Bahasa Indonesia", flag: "id" },
  { code: "vi", label: "Tiếng Việt", flag: "vn" },
];
