import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Check, FileText, Film, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";

/**
 * Media picker for a WhatsApp template header.
 *
 * Meta will not accept a URL for a template header — the file has to be uploaded
 * to the app so it can hand back an opaque handle. replyagent solves this by
 * making the header a *gallery* selection rather than a file input: the file is
 * already on our S3, and the backend re-uploads it to Meta from that URL when the
 * template is submitted. That is why this picker returns the gallery record and
 * not a `File`.
 *
 * The `format` prop maps to the gallery's own media_type filter so an IMAGE
 * header can never be pointed at a PDF.
 */

export interface TemplateMediaSelection {
  id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  file_length: number;
  thumb?: string;
}

const FORMAT_TO_MEDIA_TYPE: Record<string, string> = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DOCUMENT: "FILE",
};

// Meta's per-format caps for template header media. Enforced here so the user
// finds out before a submit round-trip, mirroring replyagent's gallery guard.
const MAX_BYTES: Record<string, number> = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 15 * 1024 * 1024,
  DOCUMENT: 10 * 1024 * 1024,
};

const ALLOWED_IMAGE_EXT = ["png", "jpg", "jpeg"];

interface Props {
  open: boolean;
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
  onClose: () => void;
  onSelect: (media: TemplateMediaSelection) => void;
}

export default function TemplateMediaPicker({ open, format, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const dark = mode === "dark";
  const [error, setError] = useState<string | null>(null);

  const mediaType = FORMAT_TO_MEDIA_TYPE[format] ?? "IMAGE";

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/gallery/listings", "template-media", mediaType],
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/gallery/listings?limit=60&media_type=${mediaType}`)
      ).json(),
    enabled: open,
  });

  const files = useMemo(() => {
    const rows: any[] = data?.file_folders?.data ?? [];
    return rows.map((f) => ({
      id: String(f.id),
      file_url: f.file_url,
      thumb: f.thumb_200 || f.file_url,
      file_name: f.object_name || "media",
      mime_type: f.mime_type || "",
      extension: String(f.extension || "").toLowerCase(),
      file_length: Number(f.file_size || 0),
    }));
  }, [data]);

  const choose = (file: (typeof files)[number]) => {
    const cap = MAX_BYTES[format];
    if (cap && file.file_length > cap) {
      setError(
        t("template_media_picker.size_limit_error", {
          fileName: file.file_name,
          sizeMb: (file.file_length / 1024 / 1024).toFixed(1),
          format: format.toLowerCase(),
          capMb: cap / 1024 / 1024,
        }),
      );
      return;
    }
    if (format === "IMAGE" && file.extension && !ALLOWED_IMAGE_EXT.includes(file.extension)) {
      setError(t("template_media_picker.image_format_error"));
      return;
    }
    setError(null);
    onSelect({
      id: file.id,
      file_url: file.file_url,
      file_name: file.file_name,
      mime_type: file.mime_type,
      file_length: file.file_length,
      thumb: file.thumb,
    });
    onClose();
  };

  const card = dark ? "bg-[#0f1829]" : "bg-white";
  const border = dark ? "border-slate-800" : "border-slate-200";
  const text = dark ? "text-white" : "text-slate-900";
  const sub = dark ? "text-slate-400" : "text-slate-500";

  const FormatIcon = format === "VIDEO" ? Film : format === "DOCUMENT" ? FileText : ImageIcon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn("rounded-[1.5rem] border p-0 max-w-3xl overflow-hidden", card, border)}>
        <div className="p-6 space-y-4">
          <div>
            <h2 className={cn("text-[14px] font-bold", text)}>
              {t("template_media_picker.choose_header_title", { format: format.toLowerCase() })}
            </h2>
            <p className={cn("text-[11px] font-medium opacity-70 mt-0.5", sub)}>
              {t("template_media_picker.choose_header_subtitle")}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={22} />
            </div>
          ) : files.length === 0 ? (
            <div className={cn("h-56 flex flex-col items-center justify-center gap-2 text-center", sub)}>
              <FormatIcon size={28} className="opacity-40" />
              <p className="text-[12px] font-semibold">
                {t("template_media_picker.no_files_title", { format: format.toLowerCase() })}
              </p>
              <p className="text-[11px] font-medium opacity-70 max-w-xs">
                {t("template_media_picker.no_files_hint")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[22rem] overflow-y-auto pr-1">
              {files.map((file) => (
                <div
                  role="button"
                  tabIndex={0}
                  key={file.id}
                  onClick={() => choose(file)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose(file);
                    }
                  }}
                  className={cn(
                    "group rounded-xl border overflow-hidden cursor-pointer transition-all hover:border-primary/50",
                    border,
                    dark ? "bg-slate-950/40" : "bg-slate-50",
                  )}
                >
                  <div className="h-24 flex items-center justify-center overflow-hidden">
                    {format === "IMAGE" ? (
                      <img
                        src={file.thumb}
                        alt={file.file_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FormatIcon size={26} className="opacity-50" />
                    )}
                  </div>
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    <Check
                      size={11}
                      className="opacity-0 group-hover:opacity-100 text-primary shrink-0 transition-opacity"
                    />
                    <span className={cn("text-[10px] font-semibold truncate", text)}>
                      {file.file_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
