import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Edit2, Eye, Copy, Trash2, Download, Search, Filter, Send, FileText, ArrowLeft, ShoppingCart, Bell, Shield, Paperclip, X } from "react-feather";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, ChevronsUpDown, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ArrowUpDown, GripVertical, Bold, Italic, Strikethrough, Smile } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import CustomDropdown from "@/components/CustomDropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PreviewV2 from "@/components/PreviewV2";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";
import { WA_TEMPLATE_LANGUAGES } from "@/lib/waTemplateLanguages";
import { waTemplateKeysFor } from "@/lib/waTemplateKeys";
import TemplateMediaPicker, { type TemplateMediaSelection } from "@/components/gallery/TemplateMediaPicker";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";


type SortDirection = "asc" | "desc" | "default";

interface SortEntry {
  id: string;
  column: string;
  direction: "asc" | "desc";
}

interface FilterEntry {
  id: string;
  column: string;
  operator: string;
  value: string;
}

export default function TemplateManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const workspaceTz = useWorkspaceTimezone();

  // Add style to hide scrollbar
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplateName, setCloneTemplateName] = useState<string>("");
  const [templateToCloneId, setTemplateToCloneId] = useState<number | null>(null);
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [templateCreationStep, setTemplateCreationStep] = useState<"category" | "form" | "content">("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en_US");
  const [templateName, setTemplateName] = useState<string>("");
  const [templateType, setTemplateType] = useState<string>("");
  // replyagent's builder is three mutually exclusive shapes, not one form with
  // optional sections: a single-card Template, a Carousel (bubble body + 1-10
  // cards), or an Agent Notification (text header + body + footer, no buttons).
  // Meta validates against the shape, so the composer has to model it.
  const [templateMode, setTemplateMode] = useState<"template" | "carousel" | "notification">("template");
  const [carouselCards, setCarouselCards] = useState<any[]>([]);
  const [cardPickerIndex, setCardPickerIndex] = useState<number | null>(null);
  // Which carousel card the composer's live preview / the read-only Preview
  // dialog is currently showing (independent of the card being edited).
  const [previewActiveCard, setPreviewActiveCard] = useState(0);
  const [composerActiveCard, setComposerActiveCard] = useState(0);

  // "Map keys" — replyagent doesn't let you type a free sample for a template
  // variable, it maps each {{n}} to a system/custom/agent merge tag via a
  // dropdown (that tag is what's actually substituted at send time). Custom
  // fields come from the same endpoint the contact profile's field picker uses.
  const { data: customFieldsData } = useQuery<any>({
    queryKey: ["/api/custom-fields"],
    queryFn: async () => (await apiRequest("GET", "/api/custom-fields")).json(),
    enabled: createTemplateOpen,
  });
  const customFieldOptions = useMemo(() => {
    const list: any[] = Array.isArray(customFieldsData)
      ? customFieldsData
      : (customFieldsData?.fields ?? customFieldsData?.data ?? []);
    return list
      .filter((f: any) => f?.slug && f?.label)
      .map((f: any) => ({ slug: String(f.slug), label: String(f.label) }));
  }, [customFieldsData]);
  const templateKeyOptions = useMemo(
    () => waTemplateKeysFor(templateMode, customFieldOptions),
    [templateMode, customFieldOptions],
  );
  const [mediaSample, setMediaSample] = useState<string>("none");
  // Gallery selection for the header (replaces the old, non-functional local
  // File state — see the Media Sample block for why).
  const [selectedMedia, setSelectedMedia] = useState<TemplateMediaSelection | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [headerText, setHeaderText] = useState<string>("");
  const [bodyText, setBodyText] = useState<string>("");
  const [footerText, setFooterText] = useState<string>("");
  const [variableSamples, setVariableSamples] = useState<{ [key: string]: string }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [templateButtons, setTemplateButtons] = useState<Array<{
    id: number;
    type: string;
    buttonText?: string;
    urlType?: string;
    websiteUrl?: string;
    trackAppConversion?: boolean;
    enableMetaTracking?: boolean;
    activeFor?: string;
    country?: string;
    phoneNumber?: string;
    flowButton?: string;
    flowId?: string;
    offerCode?: string;
  }>>([]);
  const [draggedButtonId, setDraggedButtonId] = useState<number | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Helper functions for template creation flow
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
  };

  const handleBackToCategory = () => {
    setTemplateCreationStep("category");
    setSelectedCategory(null);
  };

  const handleNextFromCategory = () => {
    if (selectedCategory) {
      setTemplateCreationStep("form");
    }
  };

  const handleNextFromForm = () => {
    if (templateName.trim() && templateType.trim()) {
      setTemplateCreationStep("content");
    }
  };

  const handleBackToForm = () => {
    setTemplateCreationStep("form");
  };

  // Helper function to get the next variable number
  const getNextVariableNumber = () => {
    const allText = headerText + " " + bodyText;
    const variableMatches = allText.match(/\{\{(\d+)\}\}/g);

    if (!variableMatches) return 1;

    const numbers = variableMatches.map(match => {
      const numberMatch = match.match(/\{\{(\d+)\}\}/);
      return numberMatch ? parseInt(numberMatch[1]) : 0;
    });

    const maxNumber = Math.max(...numbers);
    return maxNumber + 1;
  };

  // Helper function to get all variables used in header and body (both numeric and text)
  const getAllVariables = () => {
    const allText = headerText + " " + bodyText;
    // Match both numeric {{1}} and text {{name}} variables
    const variableMatches = allText.match(/\{\{[^}]+\}\}/g);

    if (!variableMatches) return [];

    const uniqueVariables = Array.from(new Set(variableMatches));
    return uniqueVariables.sort((a, b) => {
      // Extract content inside braces
      const aContent = a.match(/\{\{([^}]+)\}\}/)?.[1] || "";
      const bContent = b.match(/\{\{([^}]+)\}\}/)?.[1] || "";

      // Check if both are numeric
      const aIsNumeric = /^\d+$/.test(aContent);
      const bIsNumeric = /^\d+$/.test(bContent);

      if (aIsNumeric && bIsNumeric) {
        return parseInt(aContent) - parseInt(bContent);
      } else if (aIsNumeric && !bIsNumeric) {
        return -1; // Numeric variables come first
      } else if (!aIsNumeric && bIsNumeric) {
        return 1; // Text variables come after numeric
      } else {
        return aContent.localeCompare(bContent); // Alphabetical for text variables
      }
    });
  };

  // Helper function to check if the template form is valid
  const isTemplateFormValid = () => {
    // Body is required (for a carousel this is the bubble above the cards)
    if (!bodyText.trim()) return false;

    // Carousel: Meta rejects the template unless every card is complete and all
    // cards expose the same button types, so check that before enabling submit
    // rather than letting the round-trip fail.
    if (templateMode === "carousel") {
      if (carouselCards.length === 0 || carouselCards.length > 10) return false;
      let buttonSignature: string | null = null;
      for (const card of carouselCards) {
        if (!card?.media?.file_url) return false;
        if (!String(card?.body ?? "").trim()) return false;
        const buttons: any[] = card?.buttons ?? [];
        if (buttons.length === 0 || buttons.length > 2) return false;
        for (const b of buttons) {
          if (!String(b?.buttonText ?? "").trim()) return false;
          if (b.type === "visit-website" && !String(b?.websiteUrl ?? "").trim()) return false;
          if (b.type === "call-phone" && !String(b?.phoneNumber ?? "").trim()) return false;
        }
        const signature = buttons.map((b) => b.type).join(",");
        if (buttonSignature === null) buttonSignature = signature;
        else if (signature !== buttonSignature) return false;
      }
      return true;
    }

    // If variables exist, all must have samples
    const variables = getAllVariables();
    if (variables.length > 0) {
      if (!variables.every(variable => {
        const variableKey = variable.match(/\{\{([^}]+)\}\}/)?.[1] || "";
        return variableSamples[variableKey]?.trim();
      })) {
        return false;
      }
    }

    // If buttons exist, all required fields must be filled
    if (templateButtons.length > 0) {
      return templateButtons.every(button => {
        // All buttons must have buttonText
        if (!button.buttonText?.trim()) return false;

        // Type-specific validations
        switch (button.type) {
          case "quick-reply":
            return true; // Only buttonText is required
          case "visit-website":
            return button.urlType?.trim() && button.websiteUrl?.trim();
          case "call-whatsapp":
            return true; // Only buttonText is required
          case "call-phone":
            return button.country?.trim() && button.phoneNumber?.trim();
          case "complete-flow":
            return button.flowButton?.trim() && button.flowId?.trim();
          case "copy-offer":
            return button.offerCode?.trim();
          default:
            return false;
        }
      });
    }

    return true;
  };

  // Helper function to check if template has changed
  const hasTemplateChanged = () => {
    if (!originalTemplate) return false;

    return (
      templateName !== originalTemplate.name ||
      selectedCategory !== originalTemplate.category ||
      templateType !== originalTemplate.type ||
      selectedLanguage !== originalTemplate.language ||
      headerText !== (originalTemplate.header || "") ||
      bodyText !== (originalTemplate.body || "") ||
      footerText !== (originalTemplate.footer || "") ||
      JSON.stringify(templateButtons) !== JSON.stringify(originalTemplate.buttons || []) ||
      JSON.stringify(variableSamples) !== JSON.stringify(originalTemplate.variableSamples || {}) ||
      mediaSample !== (originalTemplate.mediaSample || "none") ||
      (selectedMedia?.id ?? null) !== (originalTemplate.media?.id ?? null)
    );
  };

  const handleCancelCreateTemplate = () => {
    setCreateTemplateOpen(false);
    setEditingTemplateId(null);
    setOriginalTemplate(null);
    setTemplateCreationStep("category");
    setSelectedCategory(null);
    setSelectedLanguage("en_US");
    setTemplateName("");
    setTemplateType("");
    setMediaSample("none");
    setSelectedMedia(null);
    setMediaPickerOpen(false);
    setTemplateMode("template");
    setCarouselCards([]);
    setCardPickerIndex(null);
    setComposerActiveCard(0);
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setVariableSamples({});
    setShowEmojiPicker(false);
    setTemplateButtons([]);
  };

  // Button drag handlers
  const handleButtonDragStart = (id: number) => {
    setDraggedButtonId(id);
  };

  const handleButtonDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleButtonDrop = (targetId: number) => {
    if (!draggedButtonId || draggedButtonId === targetId) return;

    const draggedIndex = templateButtons.findIndex(b => b.id === draggedButtonId);
    const targetIndex = templateButtons.findIndex(b => b.id === targetId);

    const newButtons = [...templateButtons];
    [newButtons[draggedIndex], newButtons[targetIndex]] = [newButtons[targetIndex], newButtons[draggedIndex]];
    setTemplateButtons(newButtons);
    setDraggedButtonId(null);
  };

  const updateButtonConfig = (buttonId: number, field: string, value: any) => {
    setTemplateButtons(templateButtons.map(btn =>
      btn.id === buttonId ? { ...btn, [field]: value } : btn
    ));
  };

  // Handler to create template
  const handleCreateTemplate = () => {
    if (!isTemplateFormValid()) return;

    // Submit to the backend, which creates the template on Meta (enters
    // PENDING review) and persists it locally so it appears in the list.
    const waAccountId = new URLSearchParams(window.location.search).get("wa_account_id");
    createTemplateMutation.mutate({
      wa_account_id: waAccountId || undefined,
      name: templateName,
      category: selectedCategory,
      language: selectedLanguage,
      header: headerText || undefined,
      body: bodyText,
      footer: footerText || undefined,
      buttons: templateButtons,
      examples: variableSamples,
      mediaSample,
      // Template shape. The backend builds a different component set per mode,
      // so this has to travel with the payload.
      template_type: templateMode,
      cards: templateMode === "carousel" ? carouselCards : undefined,
      // The backend uploads this gallery file to Meta and swaps in the returned
      // header handle. Without it a media header cannot be built at all.
      mediaHeader: selectedMedia
        ? { format: mediaSample.toUpperCase(), media: selectedMedia }
        : undefined,
    });
  };

  // Open edit template handler
  const handleOpenEditTemplate = (templateId: number) => {
    const templateToEdit = whatsappTemplates.find(tpl => tpl.id === templateId);
    if (!templateToEdit) return;

    // Save original template for change detection
    setOriginalTemplate(templateToEdit);

    // Prefill all form fields with template data
    setEditingTemplateId(templateId);
    setSelectedCategory(templateToEdit.category);
    setTemplateType(templateToEdit.type || "");
    setTemplateMode(templateToEdit.mode ?? "template");
    setCarouselCards(templateToEdit.carouselCards?.length ? templateToEdit.carouselCards : []);
    setSelectedLanguage(templateToEdit.language);
    setTemplateName(templateToEdit.name);
    setHeaderText(templateToEdit.header || "");
    setBodyText(templateToEdit.body || "");
    setFooterText(templateToEdit.footer || "");
    setTemplateButtons(templateToEdit.buttons || []);
    setSelectedMedia(templateToEdit.media || null);
    setMediaSample(templateToEdit.mediaSample || "none");
    setVariableSamples(templateToEdit.variableSamples || {});

    // Start at category step to show all 3 steps
    setTemplateCreationStep("category");
    setCreateTemplateOpen(true);
  };



  // Save edited template handler
  const handleSaveEditedTemplate = () => {
    if (!isTemplateFormValid() || editingTemplateId === null) return;

    // Resubmit the edited structure to Meta for re-approval. The backend only
    // allows this for REJECTED / PAUSED templates and keeps the original
    // name/language (immutable at Meta). Mirrors replyagent's resubmit flow.
    updateTemplateMutation.mutate({
      id: editingTemplateId,
      payload: {
        name: templateName,
        category: selectedCategory,
        language: selectedLanguage,
        header: headerText || undefined,
        body: bodyText,
        footer: footerText || undefined,
        buttons: templateButtons,
        examples: variableSamples,
        mediaSample,
        template_type: templateMode,
        cards: templateMode === "carousel" ? carouselCards : undefined,
        mediaHeader: selectedMedia
          ? { format: mediaSample.toUpperCase(), media: selectedMedia }
          : undefined,
      },
    });
  };

  const handleOpenDeleteModal = (template: any) => {
    setTemplateToDelete(template);
    setShowDeleteTemplateModal(true);
  };

  const handleOpenBulkDeleteModal = () => {
    setShowBulkDeleteModal(true);
  };

  // Confirm delete handler
  const handleConfirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
    }
  };

  // Bulk delete used to only clear the checkboxes and toast "Deleted" — nothing
  // was ever removed. Delete each selected template for real, then report how
  // many actually succeeded rather than assuming all of them did.
  const handleConfirmBulkDelete = async () => {
    const ids = [...selectedTemplates];
    setShowBulkDeleteModal(false);
    const results = await Promise.allSettled(
      ids.map((id) => apiRequest("DELETE", `/api/waba/templates/${id}`)),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelectedTemplates([]);
    queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
    if (failed === 0) {
      toast({
        title: t("template_manager.toasts.templates_deleted_title"),
        description: t("template_manager.toasts.templates_deleted_desc", { count: ids.length }),
      });
    } else {
      toast({
        title: t("template_manager.toasts.templates_delete_partial_title"),
        description: t("template_manager.toasts.templates_delete_partial_desc", {
          deleted: ids.length - failed,
          total: ids.length,
          failed,
        }),
        variant: "destructive",
      });
    }
  };

  // Open clone dialog
  const handleOpenCloneDialog = (templateId: number) => {
    const templateToClone = whatsappTemplates.find(tpl => tpl.id === templateId);
    if (!templateToClone) return;

    setTemplateToCloneId(templateId);
    setCloneTemplateName(templateToClone.name);
    setCloneDialogOpen(true);
  };

  // Cancel clone dialog
  const handleCancelCloneDialog = () => {
    setCloneDialogOpen(false);
    setCloneTemplateName("");
    setTemplateToCloneId(null);
  };

  // Clone template handler
  const handleCloneTemplate = () => {
    if (!templateToCloneId || !cloneTemplateName.trim()) return;

    const templateToClone = whatsappTemplates.find(tpl => tpl.id === templateToCloneId);
    if (!templateToClone) return;

    // Clone used to build an object locally and drop it on the floor (the state
    // write was commented out), so the toast lied. A clone is a genuinely new
    // template at Meta — submit it under the new name and let it enter review.
    createTemplateMutation.mutate(
      {
        wa_account_id:
          new URLSearchParams(window.location.search).get("wa_account_id") || undefined,
        name: cloneTemplateName,
        category: templateToClone.category,
        language: templateToClone.language,
        header: templateToClone.header || undefined,
        body: templateToClone.body,
        footer: templateToClone.footer || undefined,
        buttons: templateToClone.buttons ?? [],
        examples: templateToClone.variableSamples ?? {},
      },
      {
        onSuccess: () => {
          toast({
            title: t("template_manager.toasts.template_cloned_title"),
            description: t("template_manager.toasts.template_cloned_desc", {
              oldName: templateToClone.name,
              newName: cloneTemplateName,
            }),
          });
          handleCancelCloneDialog();
        },
        onError: (err: any) => {
          toast({
            title: t("template_manager.toasts.clone_failed_title"),
            description: err?.message ?? t("template_manager.toasts.clone_failed_desc"),
            variant: "destructive",
          });
        },
      },
    );
  };

  // Text formatting functions
  const applyFormatting = (formatChar: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = bodyText.substring(start, end);

    if (selectedText) {
      // Check if the selected text is already formatted
      const beforeSelection = bodyText.substring(Math.max(0, start - formatChar.length), start);
      const afterSelection = bodyText.substring(end, Math.min(bodyText.length, end + formatChar.length));

      const isAlreadyFormatted = beforeSelection === formatChar && afterSelection === formatChar;

      if (isAlreadyFormatted) {
        // Remove formatting
        const newText =
          bodyText.substring(0, start - formatChar.length) +
          selectedText +
          bodyText.substring(end + formatChar.length);
        setBodyText(newText);

        // Restore cursor position after removing formatting
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start - formatChar.length, end - formatChar.length);
        }, 0);
      } else {
        // Add formatting
        const formattedText = `${formatChar}${selectedText}${formatChar}`;
        const newText = bodyText.substring(0, start) + formattedText + bodyText.substring(end);
        setBodyText(newText);

        // Restore cursor position after formatting
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + formatChar.length, end + formatChar.length);
        }, 0);
      }
    } else {
      // No selection - check if cursor is between formatting characters
      const beforeCursor = bodyText.substring(Math.max(0, start - formatChar.length), start);
      const afterCursor = bodyText.substring(start, Math.min(bodyText.length, start + formatChar.length));

      if (beforeCursor === formatChar && afterCursor === formatChar) {
        // Remove the formatting characters
        const newText =
          bodyText.substring(0, start - formatChar.length) +
          bodyText.substring(start + formatChar.length);
        setBodyText(newText);

        // Place cursor where it was (adjusted for removed characters)
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start - formatChar.length, start - formatChar.length);
        }, 0);
      } else {
        // Insert formatting characters at cursor position
        const formattedText = `${formatChar}${formatChar}`;
        const newText = bodyText.substring(0, start) + formattedText + bodyText.substring(end);
        setBodyText(newText);

        // Place cursor between formatting characters
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + formatChar.length, start + formatChar.length);
        }, 0);
      }
    }
  };

  const handleBold = () => applyFormatting("*");
  const handleItalic = () => applyFormatting("_");
  const handleStrikethrough = () => applyFormatting("~");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sorts, setSorts] = useState<SortEntry[]>([]);
  const [filters, setFilters] = useState<FilterEntry[]>([]);
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [draggedSortId, setDraggedSortId] = useState<string | null>(null);
  const [openSortColumnDropdown, setOpenSortColumnDropdown] = useState<string | null>(null);
  const [openSortDirectionDropdown, setOpenSortDirectionDropdown] = useState<string | null>(null);
  const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);
  const [openFilterColumnDropdown, setOpenFilterColumnDropdown] = useState<string | null>(null);
  const [openFilterOperatorDropdown, setOpenFilterOperatorDropdown] = useState<string | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<any>(null);

  const queryClient = useQueryClient();

  // ─── Realtime: Meta approval decisions ───────────────────────────────
  // The backend already emits `whatsapp.template_updated` when Meta's
  // message_template_status_update webhook lands, but nothing listened for it,
  // so a template stayed "Pending" on screen until the page was reloaded.
  // Approval can take minutes to hours; this is the whole point of the event.
  const workspaceId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_info");
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      return Number(parsed?.workspace_id ?? parsed?.modelable_id ?? 1) || 1;
    } catch {
      return 1;
    }
  }, []);
  const socket = useSocket(workspaceId);

  useEffect(() => {
    if (!socket) return;
    const refetch = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
    };
    socket.on("whatsapp.template_updated", refetch);
    return () => {
      socket.off("whatsapp.template_updated", refetch);
    };
  }, [socket, queryClient]);

  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["/api/waba/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/waba/templates");
      return res.json();
    }
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/waba/templates", payload);
      return res.json();
    },
    onSuccess: (created: any) => {
      // Show the new template instantly by prepending it to the cached list —
      // no waiting for the invalidate refetch to round-trip.
      if (created && created.id != null) {
        queryClient.setQueryData(["/api/waba/templates"], (old: any) =>
          Array.isArray(old) ? [created, ...old] : [created],
        );
      }
      toast({
        title: t("template_manager.toasts.template_created_title"),
        description: t("template_manager.toasts.template_created_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
      handleCancelCreateTemplate();
    },
    onError: (err: Error) => {
      toast({
        title: t("template_manager.toasts.create_failed_title"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Edit + resubmit a rejected/paused template (PATCH /waba/templates/:id).
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/waba/templates/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("template_manager.toasts.template_resubmitted_title"),
        description: t("template_manager.toasts.template_resubmitted_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
      handleCancelCreateTemplate();
    },
    onError: (err: Error) => {
      toast({
        title: t("template_manager.toasts.update_failed_title"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Pull the authoritative template list from Meta (includes templates created
  // directly in Meta's dashboard, with their live status) and upsert locally.
  const syncTemplatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/waba/templates/sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
    },
    // Silent on error (e.g. no WABA connected yet) — the local list still shows.
    onError: () => {},
  });

  // Auto-sync from Meta once when the page opens, so Meta-created templates and
  // up-to-date statuses appear without the user having to hit Refresh.
  useEffect(() => {
    syncTemplatesMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/waba/templates/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("template_manager.toasts.template_deleted_title"),
        description: t("template_manager.toasts.template_deleted_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates"] });
      // Every other mutation in this file also invalidates the stats panel —
      // this one was missing it, leaving the total/approved/pending counts
      // stale after a single-template delete.
      queryClient.invalidateQueries({ queryKey: ["/api/waba/templates/stats"] });
      setShowDeleteTemplateModal(false);
      setTemplateToDelete(null);
    },
    onError: (err: Error) => {
      toast({
        title: t("template_manager.toasts.delete_failed_title"),
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const whatsappTemplates = useMemo(() => {
    if (!templatesData) return [];
    return (templatesData as any[]).map((tpl: any) => {
      let components = [];
      if (tpl.components) {
        try {
          components = typeof tpl.components === "string" ? JSON.parse(tpl.components) : tpl.components;
        } catch (e) {
          console.error("Failed to parse components for template", tpl.id, e);
        }
      }

      const bodyComponent = components.find((c: any) => c.type === "BODY");
      const headerComponent = components.find((c: any) => c.type === "HEADER");
      const footerComponent = components.find((c: any) => c.type === "FOOTER");
      const buttonsComponent = components.find((c: any) => c.type === "BUTTONS");
      const carouselComponent = components.find((c: any) => c.type === "CAROUSEL");

      // `structure` is the authoring blob the backend keeps alongside every
      // template — it carries the gallery record behind a media header and the
      // value each {{variable}} resolves to. Reading it is what makes "Edit"
      // reopen a template intact; previously these were hardcoded to null/{},
      // so editing silently stripped the media and every sample value.
      let structure: any = null;
      if (tpl.structure) {
        try {
          structure = typeof tpl.structure === "string" ? JSON.parse(tpl.structure) : tpl.structure;
        } catch (e) {
          console.error("Failed to parse structure for template", tpl.id, e);
        }
      }
      const structuredHeader = structure?.header_component ?? null;
      const headerMedia = structuredHeader?.example?.media ?? null;
      const headerFormat = String(structuredHeader?.format ?? "").toUpperCase();

      // Rebuild {{var}} → value from the stored parameters, in the same order
      // the variables appear in the text.
      const samplesFrom = (text: string, component: any): Record<string, string> => {
        const params: any[] = component?.parameters ?? [];
        if (!params.length) return {};
        const names = (String(text ?? "").match(/\{\{([^}]+)\}\}/g) ?? []).map((m) =>
          m.replace(/^\{\{|\}\}$/g, "").trim(),
        );
        const out: Record<string, string> = {};
        names.forEach((name, i) => {
          if (out[name] === undefined && params[i]?.text != null) out[name] = String(params[i].text);
        });
        return out;
      };

      return {
        id: Number(tpl.id),
        name: tpl.name,
        category: tpl.category,
        language: tpl.language,
        status: tpl.status,
        body: bodyComponent?.text || tpl.template || "",
        header: headerComponent?.text || "",
        footer: footerComponent?.text || "",
        buttons: buttonsComponent?.buttons || [],
        lastEdited: tpl.updated_at ? formatInWorkspaceTz(tpl.updated_at, "M/d/yyyy", workspaceTz) : (tpl.created_at ? formatInWorkspaceTz(tpl.created_at, "M/d/yyyy", workspaceTz) : ""),
        statusTypeColor: (tpl.status === "APPROVED" || tpl.status === "Active - HQ") ? "success" : (tpl.status === "PENDING" ? "warning" : "danger"),
        // The column is `reason` (written by the Meta status webhook on a
        // rejection); `rejection_reason` never existed, so this always read
        // undefined and every row claimed "No blocks recorded".
        topBlockReason: tpl.reason || "",
        media: headerMedia,
        mediaSample: ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)
          ? headerFormat.toLowerCase()
          : "none",
        variableSamples: {
          ...samplesFrom(headerComponent?.text ?? "", structure?.header_component),
          ...samplesFrom(bodyComponent?.text ?? "", structure?.body_component),
        },
        type: tpl.type || (tpl.category === "MARKETING" ? "Marketing" : "Utility"),
        // The backend's `type` column actually holds the composer MODE
        // ('template' | 'carousel' | 'notification') — kept under a distinct key
        // since `type` above is repurposed for the display Marketing/Utility tag.
        mode: (["template", "carousel", "notification"].includes(String(tpl.type))
          ? tpl.type
          : "template") as "template" | "carousel" | "notification",
        // Carousel cards, reshaped for the preview (PreviewV2 carouselCards prop)
        // and for reopening in the composer's card editor.
        carouselCards: (carouselComponent?.cards ?? []).map((card: any) => {
          const cardHeader = (card.components ?? []).find((c: any) => c.type === "HEADER");
          const cardBody = (card.components ?? []).find((c: any) => c.type === "BODY");
          const cardButtons = (card.components ?? []).find((c: any) => c.type === "BUTTONS");
          return {
            mediaFormat: cardHeader?.format ?? "IMAGE",
            media: cardHeader?.example?.media ?? (cardHeader?.example?.header_handle?.[0]
              ? { file_url: cardHeader.example.header_handle[0], file_name: "media" }
              : null),
            body: cardBody?.text ?? "",
            buttons: cardButtons?.buttons ?? [],
          };
        }),
      };
    });
  }, [templatesData, workspaceTz]);

  const toggleTemplate = (id: number) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const filteredIds = filteredAndSortedTemplates.map(tpl => tpl.id);
    if (selectedTemplates.length === filteredIds.length && filteredIds.every(id => selectedTemplates.includes(id))) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(filteredIds);
    }
  };

  const statusLabel = (status: string) => {
    switch (String(status).toUpperCase()) {
      case "APPROVED": return t("template_manager.filters.status_approved");
      case "PENDING": return t("template_manager.filters.status_pending");
      case "REJECTED": return t("template_manager.filters.status_rejected");
      case "PAUSED": return t("template_manager.filters.status_paused");
      // Other values (e.g. "Active - HQ", "Quality Pending") come straight from
      // Meta and don't have a fixed translation set — show them as-is.
      default: return status;
    }
  };

  const operatorLabel = (operator: string) => {
    switch (operator) {
      case "contains": return t("template_manager.filter.operator_contains");
      case "does not contain": return t("template_manager.filter.operator_does_not_contain");
      case "is": return t("template_manager.filter.operator_is");
      case "is not": return t("template_manager.filter.operator_is_not");
      case "is empty": return t("template_manager.filter.operator_is_empty");
      default: return t("template_manager.filter.operator_is_not_empty");
    }
  };

  const columnLabel = (column: string) => {
    switch (column) {
      case "name": return t("template_manager.sort.col_template_name");
      case "category": return t("template_manager.sort.col_category");
      case "language": return t("template_manager.sort.col_language");
      case "status": return t("template_manager.sort.col_status");
      case "topBlockReason": return t("template_manager.sort.col_top_block_reason");
      default: return t("template_manager.sort.col_last_edited");
    }
  };

  const getStatusBadgeClasses = (statusTypeColor: string) => {
    switch (statusTypeColor) {
      case "success":
        return "bg-green-100 text-green-700";
      case "warning":
        return "bg-yellow-100 text-yellow-700";
      case "danger":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Cancel dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRowsDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSort(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cancel emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Handle emoji selection from emoji-mart
  const handleEmojiSelect = (emoji: any) => {
    const textarea = bodyTextareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const emojiChar = emoji.native;
      const newText = bodyText.substring(0, start) + emojiChar + bodyText.substring(end);
      setBodyText(newText);
      setShowEmojiPicker(false);

      // Restore cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emojiChar.length, start + emojiChar.length);
      }, 0);
    }
  };

  // Sort functions
  const addSort = () => {
    const availableColumns = ["name", "category", "language", "status", "topBlockReason", "lastEdited"];
    const usedColumns = sorts.map(s => s.column);
    const nextColumn = availableColumns.find(col => !usedColumns.includes(col)) || "name";
    setSorts([...sorts, { id: Date.now().toString(), column: nextColumn, direction: "asc" }]);
  };

  const removeSort = (id: string) => {
    setSorts(sorts.filter(s => s.id !== id));
  };

  const updateSort = (id: string, column: string, direction: "asc" | "desc") => {
    if (sorts.some(s => s.id !== id && s.column === column)) {
      return;
    }
    setSorts(sorts.map(s => s.id === id ? { ...s, column, direction } : s));
  };

  const handleSortDragStart = (id: string) => {
    setDraggedSortId(id);
  };

  const handleSortDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSortDrop = (targetId: string) => {
    if (!draggedSortId || draggedSortId === targetId) return;

    const draggedIndex = sorts.findIndex(s => s.id === draggedSortId);
    const targetIndex = sorts.findIndex(s => s.id === targetId);

    const newSorts = [...sorts];
    [newSorts[draggedIndex], newSorts[targetIndex]] = [newSorts[targetIndex], newSorts[draggedIndex]];
    setSorts(newSorts);
    setDraggedSortId(null);
  };

  const canAddSort = (column: string) => {
    return !sorts.some(s => s.column === column);
  };

  // Filter functions
  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), column: "name", operator: "contains", value: "" }]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, column: string, operator: string, value: string) => {
    setFilters(filters.map(f => f.id === id ? { ...f, column, operator, value } : f));
  };

  const handleFilterDragStart = (id: string) => {
    setDraggedFilterId(id);
  };

  const handleFilterDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFilterDrop = (targetId: string) => {
    if (!draggedFilterId || draggedFilterId === targetId) return;

    const draggedIndex = filters.findIndex(f => f.id === draggedFilterId);
    const targetIndex = filters.findIndex(f => f.id === targetId);

    const newFilters = [...filters];
    [newFilters[draggedIndex], newFilters[targetIndex]] = [newFilters[targetIndex], newFilters[draggedIndex]];
    setFilters(newFilters);
    setDraggedFilterId(null);
  };

  // Sorting functions
  const handleColumnSort = (column: string) => {
    const existingSort = sorts.find(s => s.column === column);
    if (existingSort) {
      if (existingSort.direction === "asc") {
        setSorts(sorts.map(s => s.id === existingSort.id ? { ...s, direction: "desc" } : s));
      } else {
        setSorts(sorts.filter(s => s.id !== existingSort.id));
      }
    } else {
      setSorts([...sorts, { id: Date.now().toString(), column, direction: "asc" }]);
    }
  };

  const renderSortIcon = (column: string) => {
    const sort = sorts.find(s => s.column === column);
    const isActive = !!sort;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!sort) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (sort.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDown size={14} className={color} /></div>;
  };

  // Get filtered and sorted templates
  const getFilteredAndSortedTemplates = () => {
    let data = [...whatsappTemplates];

    // Apply search filter
    if (searchQuery) {
      data = data.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Rows carry Meta's raw values — category `MARKETING`, language `en_US`,
    // status `APPROVED`. These filters used to compare against title-cased
    // display strings ("Marketing", "English", "Approved"), so every one of them
    // matched nothing and silently emptied the table. Compare case-insensitively
    // against the dropdown ids instead.

    // Apply category filter
    if (selectedCategories.length > 0) {
      data = data.filter(item =>
        selectedCategories.some(id => id.toLowerCase() === String(item.category ?? "").toLowerCase()),
      );
    }

    // Apply language filter — dropdown ids are Meta locale codes, and a bare
    // `en` selection should still match the `en_US` / `en_GB` variants.
    if (selectedLanguages.length > 0) {
      data = data.filter(item => {
        const lang = String(item.language ?? "").toLowerCase();
        return selectedLanguages.some(id => {
          const wanted = id.toLowerCase();
          return lang === wanted || lang.startsWith(`${wanted}_`);
        });
      });
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      data = data.filter(item =>
        selectedStatuses.some(id => id.toLowerCase() === String(item.status ?? "").toLowerCase()),
      );
    }

    // Apply advanced filters (from Sort/Filter buttons)
    data = data.filter(item => {
      return filters.every(filter => {
        const itemValue = item[filter.column as keyof typeof item];
        if (typeof itemValue !== "string") return true;

        switch (filter.operator) {
          case "contains":
            return itemValue.toLowerCase().includes(filter.value.toLowerCase());
          case "does not contain":
            return !itemValue.toLowerCase().includes(filter.value.toLowerCase());
          case "is":
            return itemValue.toLowerCase() === filter.value.toLowerCase();
          case "is not":
            return itemValue.toLowerCase() !== filter.value.toLowerCase();
          case "is empty":
            return itemValue === "";
          case "is not empty":
            return itemValue !== "";
          default:
            return true;
        }
      });
    });

    // Apply sorting - Excel-style multi-level sort
    if (sorts.length > 0) {
      // Define custom sort order for status
      const statusOrder = {
        "Active - HQ": 0,
        "Quality Pending": 1,
        "Approved": 2,
        "Pending": 3,
        "Rejected": 4
      };

      data.sort((a, b) => {
        for (const sort of sorts) {
          const aVal = a[sort.column as keyof typeof a];
          const bVal = b[sort.column as keyof typeof b];

          let comparison = 0;

          // Special handling for status column
          if (sort.column === "status" && typeof aVal === "string" && typeof bVal === "string") {
            const aOrder = statusOrder[aVal as keyof typeof statusOrder] ?? 999;
            const bOrder = statusOrder[bVal as keyof typeof statusOrder] ?? 999;
            comparison = sort.direction === "asc" ? aOrder - bOrder : bOrder - aOrder;
          } else if (typeof aVal === "string" && typeof bVal === "string") {
            comparison = sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }

          // If values are different, return the comparison result
          if (comparison !== 0) {
            return comparison;
          }
          // If values are equal, continue to next sort criterion
        }
        return 0; // All criteria are equal
      });
    }

    return data;
  };

  // Pagination logic
  const filteredAndSortedTemplates = getFilteredAndSortedTemplates();
  const totalPages = Math.ceil(filteredAndSortedTemplates.length / rowsPerPage);
  const paginatedTemplates = filteredAndSortedTemplates.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const { data: statsData } = useQuery({
    queryKey: ["/api/waba/templates/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/waba/templates/stats");
      return res.json();
    }
  });

    return (
      <>
        <div className="px-6 py-6 animate-in fade-in duration-700" data-testid="template-manager">
            {/* Unified Main Card */}
            <div className="bg-white dark:bg-slate-900/50 rounded-[20px] border border-slate-300 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col">
                
                {/* 1. Branded Header Section */}
                <div className="py-3 px-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-blue-50/20 dark:bg-transparent">
                    <div className="flex items-center gap-6">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/10 shadow-inner">
                            <FileText size={20} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-0.5">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                                {t("template_manager.header.title")}
                            </h1>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {t("template_manager.header.subtitle")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={() => setCreateTemplateOpen(true)}
                            className="h-8 px-4 rounded-lg bg-blue-600 text-white font-semibold text-[11px] shadow-lg shadow-blue-500/20 transition-all duration-300 active:scale-95 flex items-center gap-2 border-0 hover:bg-blue-700"
                            data-testid="button-create-template"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>{t("template_manager.header.create_button")}</span>
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-lg border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 transition-all"
                                    data-testid="button-refresh"
                                    disabled={syncTemplatesMutation.isPending}
                                    onClick={() => syncTemplatesMutation.mutate()}
                                >
                                    <RefreshCw size={14} className={syncTemplatesMutation.isPending ? "animate-spin" : ""} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("template_manager.header.sync_tooltip")}</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* 2. Unified Stats Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-transparent divide-x divide-slate-200 dark:divide-slate-800/80">
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                            {t("template_manager.stats.total")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.total ?? 0}</p>
                    </div>
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                            {t("template_manager.stats.approved")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.approved ?? 0}</p>
                    </div>
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                            {t("template_manager.stats.pending")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.pending ?? 0}</p>
                    </div>
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                            {t("template_manager.stats.messages_sent")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.delivered?.toLocaleString() ?? 0}</p>
                    </div>
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            {t("template_manager.stats.read_rate")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.readRate ?? '0%'}</p>
                    </div>
                    <div className="p-2.5 flex flex-col justify-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            {t("template_manager.stats.estimated_cost")}
                        </p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{statsData?.cost ?? '$0.00'}</p>
                    </div>
                </div>

                {/* 3. Filter Row Section */}
                <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-transparent flex items-center gap-2 flex-wrap">
                    <div className="relative group flex-1 min-w-[280px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder={t("template_manager.filters.search_placeholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-8.5 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-lg text-[12px] font-medium focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
                            data-testid="input-search"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Option ids are Meta's own values so the filters can
                            compare directly against the rows. */}
                        <CustomDropdown
                            options={[
                                { id: "MARKETING", name: t("template_manager.filters.category_marketing") },
                                { id: "UTILITY", name: t("template_manager.filters.category_utility") },
                                { id: "AUTHENTICATION", name: t("template_manager.filters.category_authentication") },
                            ]}
                            selected={selectedCategories}
                            onChange={setSelectedCategories}
                            placeholder={t("template_manager.filters.categories")}
                            width="140px"
                        />

                        <CustomDropdown
                            options={WA_TEMPLATE_LANGUAGES.map((l) => ({
                                id: l.slug,
                                name: `${l.name} (${l.slug})`,
                            }))}
                            selected={selectedLanguages}
                            onChange={setSelectedLanguages}
                            placeholder={t("template_manager.filters.languages")}
                            width="140px"
                        />

                        <CustomDropdown
                            options={[
                                { id: "APPROVED", name: t("template_manager.filters.status_approved") },
                                { id: "PENDING", name: t("template_manager.filters.status_pending") },
                                { id: "REJECTED", name: t("template_manager.filters.status_rejected") },
                                { id: "PAUSED", name: t("template_manager.filters.status_paused") },
                            ]}
                            selected={selectedStatuses}
                            onChange={setSelectedStatuses}
                            placeholder={t("template_manager.filters.status")}
                            width="160px"
                        />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <div className="relative" ref={sortDropdownRef}>
                            <Button
                                variant="outline"
                                onClick={() => setShowSort(!showSort)}
                                className={cn(
                                    "h-8.5 px-3 rounded-lg text-[11px] font-semibold border-slate-200 dark:border-slate-800 flex items-center gap-2 transition-all",
                                    sorts.length > 0 ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white dark:bg-slate-900 hover:bg-slate-50"
                                )}
                            >
                                <ArrowUpDown size={14} />
                                <span>{t("template_manager.sort.button_label")} {sorts.length > 0 && `(${sorts.length})`}</span>
                            </Button>

                            {showSort && (
                                <div className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl p-4 top-full mt-2 right-0 min-w-[320px] animate-in fade-in zoom-in-95 duration-200">
                                    {sorts.length === 0 ? (
                                        <div className="text-center py-6">
                                            <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <ArrowUpDown size={18} className="text-slate-300" />
                                            </div>
                                            <h3 className="font-black text-[11px] uppercase text-slate-400 mb-4">{t("template_manager.sort.no_sort_applied")}</h3>
                                            <Button onClick={addSort} className="h-8 rounded-lg bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest px-6" variant="outline">{t("template_manager.sort.add_sort")}</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">{t("template_manager.sort.sort_criteria")}</h3>
                                                <Button onClick={() => setSorts([])} variant="ghost" className="h-6 px-2 text-[9px] font-black text-red-500 hover:bg-red-50 hover:text-red-600">{t("template_manager.sort.reset_all")}</Button>
                                            </div>
                                            {sorts.map((sort) => (
                                                <div
                                                    key={sort.id}
                                                    className="flex gap-2 items-center bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-200 dark:border-slate-800"
                                                    draggable
                                                    onDragStart={() => handleSortDragStart(sort.id)}
                                                    onDragOver={handleSortDragOver}
                                                    onDrop={() => handleSortDrop(sort.id)}
                                                >
                                                    <GripVertical size={14} className="text-slate-300 cursor-grab active:cursor-grabbing" />
                                                    <div className="relative flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenSortColumnDropdown(openSortColumnDropdown === sort.id ? null : sort.id)}
                                                            className="w-full flex items-center justify-between px-3 py-1.5 text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none text-[11px] font-black uppercase tracking-tight"
                                                        >
                                                            <span className="truncate">
                                                                {columnLabel(sort.column)}
                                                            </span>
                                                            <ChevronDown className="h-3 w-3 ml-2 text-slate-400" />
                                                        </button>
                                                        {openSortColumnDropdown === sort.id && (
                                                            <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                                                <ul className="py-1">
                                                                    {["name", "category", "language", "status", "topBlockReason", "lastEdited"].map(option => {
                                                                        const isCurrentOption = option === sort.column;
                                                                        const isDisabled = !canAddSort(option) && option !== sort.column;
                                                                        return (
                                                                            <li
                                                                                key={option}
                                                                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-tighter ${isCurrentOption || isDisabled ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"}`}
                                                                                onClick={() => {
                                                                                    if (!isDisabled && !isCurrentOption) {
                                                                                        updateSort(sort.id, option, sort.direction);
                                                                                        setOpenSortColumnDropdown(null);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {columnLabel(option)}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenSortDirectionDropdown(openSortDirectionDropdown === sort.id ? null : sort.id)}
                                                            className="w-[70px] flex items-center justify-between px-3 py-1.5 text-left border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-[11px] font-black uppercase tracking-tight"
                                                        >
                                                            <span>{sort.direction === "asc" ? t("template_manager.sort.direction_asc") : t("template_manager.sort.direction_desc")}</span>
                                                            <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
                                                        </button>
                                                        {openSortDirectionDropdown === sort.id && (
                                                            <div className="absolute z-[60] w-full mt-1 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                                                <ul className="py-1">
                                                                    {["asc", "desc"].map(option => (
                                                                        <li
                                                                            key={option}
                                                                            className="px-3 py-2 text-[10px] font-black uppercase tracking-tighter cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                            onClick={() => {
                                                                                updateSort(sort.id, sort.column, option as "asc" | "desc");
                                                                                setOpenSortDirectionDropdown(null);
                                                                            }}
                                                                        >
                                                                            {option === "asc" ? t("template_manager.sort.direction_asc") : t("template_manager.sort.direction_desc")}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeSort(sort.id)} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-md transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                            ))}
                                            <Button
                                                onClick={addSort}
                                                disabled={sorts.length >= 6}
                                                className="w-full h-8 rounded-lg bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                                            >
                                                {t("template_manager.sort.add_sort_layer")}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={filterDropdownRef}>
                            <Button
                                variant="outline"
                                onClick={() => setShowFilter(!showFilter)}
                                className={cn(
                                    "h-8.5 px-3 rounded-lg text-[10px] font-black border-slate-200 dark:border-slate-800 flex items-center gap-2 transition-all uppercase tracking-wider",
                                    filters.length > 0 ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white dark:bg-slate-900 hover:bg-slate-50"
                                )}
                            >
                                <Filter size={14} />
                                <span>{t("template_manager.filter.button_label")} {filters.length > 0 && `(${filters.length})`}</span>
                            </Button>

                            {showFilter && (
                                <div className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-2xl p-4 top-full mt-2 right-0 min-w-[360px] animate-in fade-in zoom-in-95 duration-200">
                                    {filters.length === 0 ? (
                                        <div className="text-center py-6">
                                            <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <Filter size={18} className="text-slate-300" />
                                            </div>
                                            <h3 className="font-black text-[11px] uppercase text-slate-400 mb-4">{t("template_manager.filter.no_filters_applied")}</h3>
                                            <Button onClick={addFilter} className="h-8 rounded-lg bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest px-6" variant="outline">{t("template_manager.filter.add_filter")}</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">{t("template_manager.filter.active_filters")}</h3>
                                                <Button onClick={() => setFilters([])} variant="ghost" className="h-6 px-2 text-[9px] font-black text-red-500 hover:bg-red-50 hover:text-red-600">{t("template_manager.filter.clear_all")}</Button>
                                            </div>
                                            {filters.map((filter) => (
                                                <div
                                                    key={filter.id}
                                                    className="flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
                                                    draggable
                                                    onDragStart={() => handleFilterDragStart(filter.id)}
                                                    onDragOver={handleFilterDragOver}
                                                    onDrop={() => handleFilterDrop(filter.id)}
                                                >
                                                    <div className="flex gap-2 items-center">
                                                        <GripVertical size={14} className="text-slate-300 cursor-grab active:cursor-grabbing" />
                                                        <div className="relative flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenFilterColumnDropdown(openFilterColumnDropdown === filter.id ? null : filter.id)}
                                                                className="w-full flex items-center justify-between px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-black uppercase tracking-tight"
                                                            >
                                                                <span className="truncate">
                                                                    {columnLabel(filter.column)}
                                                                </span>
                                                                <ChevronDown className="h-3 w-3 ml-2 text-slate-400" />
                                                            </button>
                                                            {openFilterColumnDropdown === filter.id && (
                                                                <div className="absolute z-[60] w-full mt-1 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                                                    <ul className="py-1">
                                                                        {["name", "category", "language", "status", "topBlockReason", "lastEdited"].map(option => (
                                                                            <li
                                                                                key={option}
                                                                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-tighter ${option === filter.column ? "bg-slate-50 text-slate-300" : "cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"}`}
                                                                                onClick={() => {
                                                                                    updateFilter(filter.id, option, filter.operator, filter.value);
                                                                                    setOpenFilterColumnDropdown(null);
                                                                                }}
                                                                            >
                                                                                {columnLabel(option)}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => removeFilter(filter.id)} className="p-1.5 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-md transition-colors"><Trash2 size={14} /></button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="relative w-[130px]">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenFilterOperatorDropdown(openFilterOperatorDropdown === filter.id ? null : filter.id)}
                                                                className="w-full flex items-center justify-between px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-[11px] font-semibold"
                                                            >
                                                                <span className="truncate">{operatorLabel(filter.operator)}</span>
                                                                <ChevronDown className="h-3 w-3 ml-1 text-slate-400" />
                                                            </button>
                                                            {openFilterOperatorDropdown === filter.id && (
                                                                <div className="absolute z-[60] w-full mt-1 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                                                    <ul className="py-1">
                                                                        {["contains", "does not contain", "is", "is not", "is empty", "is not empty"].map(option => (
                                                                            <li
                                                                                key={option}
                                                                                className="px-3 py-2 text-[10px] font-semibold cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                                onClick={() => {
                                                                                    updateFilter(filter.id, filter.column, option, filter.value);
                                                                                    setOpenFilterOperatorDropdown(null);
                                                                                }}
                                                                            >
                                                                                {operatorLabel(option)}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder={t("template_manager.filter.value_placeholder")}
                                                            value={filter.value}
                                                            onChange={(e) => updateFilter(filter.id, filter.column, filter.operator, e.target.value)}
                                                            className="flex-1 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <Button onClick={addFilter} className="w-full h-8 rounded-lg bg-slate-900 text-white font-semibold text-[11px]">{t("template_manager.filter.add_filter_condition")}</Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. Bulk Actions Bar (Conditional) */}
                {selectedTemplates.length > 0 && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between animate-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
                                {selectedTemplates.length}
                            </div>
                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">{t("template_manager.bulk.selected")}</span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleOpenBulkDeleteModal}
                                className="h-7 px-3 rounded-md bg-white dark:bg-slate-900 border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-semibold transition-all"
                            >
                                <Trash2 size={14} className="mr-2" />
                                {t("template_manager.bulk.delete_selected")}
                            </Button>
                        </div>
                    </div>
                )}

                {/* 5. Main Table Section */}
                <div className="flex-1 overflow-auto scrollbar-hide">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80">
                            <tr>
                                <th className="py-2 px-3 w-10">
                                    <Checkbox
                                        checked={filteredAndSortedTemplates.length > 0 && filteredAndSortedTemplates.every(tpl => selectedTemplates.includes(tpl.id))}
                                        onCheckedChange={toggleAll}
                                        className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-blue-600"
                                    />
                                </th>
                                <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("name")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_template_name")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("name")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("category")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_category")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("category")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("language")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_language")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("language")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-3 px-4 font-black text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => handleColumnSort("status")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_status")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("status")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("topBlockReason")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_top_block_reason")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("topBlockReason")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-2 px-3 font-semibold text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer group" onClick={() => handleColumnSort("lastEdited")}>
                                    <div className="flex items-center gap-2">
                                        {t("template_manager.table.col_last_edited")}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            {renderSortIcon("lastEdited")}
                                        </div>
                                    </div>
                                </th>
                                <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 dark:text-slate-400 text-right">{t("template_manager.table.col_actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                            {isLoadingTemplates ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 size={24} className="animate-spin text-blue-500" />
                                            <p className="text-[11px] font-semibold text-slate-400">{t("template_manager.table.fetching")}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedTemplates.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center bg-white dark:bg-transparent">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3.5 rounded-full bg-blue-50 dark:bg-blue-800 text-blue-300 dark:text-blue-600 shadow-inner">
                                                <FileText size={32} strokeWidth={1} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[14px] font-bold text-slate-900 dark:text-white">{t("template_manager.table.no_templates_title")}</p>
                                                <p className="text-[11px] font-medium text-slate-400">{t("template_manager.table.no_templates_desc")}</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedTemplates.map((template) => (
                                    <tr 
                                        key={template.id} 
                                        className={cn(
                                            "group transition-all duration-200 hover:bg-blue-50/30 dark:hover:bg-blue-900/10",
                                            selectedTemplates.includes(template.id) ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
                                        )}
                                        data-testid={`template-row-${template.id}`}
                                    >
                                        <td className="py-2 px-3">
                                            <Checkbox
                                                checked={selectedTemplates.includes(template.id)}
                                                onCheckedChange={() => toggleTemplate(template.id)}
                                                className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-blue-600"
                                            />
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate max-w-[200px]">
                                                    {template.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                {template.category}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                {template.language}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-md text-[10px] font-semibold border shadow-sm",
                                                template.statusTypeColor === "success" ? "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50" :
                                                template.statusTypeColor === "warning" ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50" :
                                                template.statusTypeColor === "danger" ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50" :
                                                "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                            )}>
                                                {statusLabel(template.status)}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="text-[11px] font-medium text-slate-500 italic dark:text-slate-400 truncate max-w-[180px] block">
                                                {template.topBlockReason || t("template_manager.table.no_blocks_recorded")}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                                            {template.lastEdited}
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all shadow-none hover:shadow-sm">
                                                        <MoreVertical size={16} className="text-slate-400 group-hover:text-slate-600" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                                    {/* Meta only allows editing + resubmitting a REJECTED/PAUSED template
                                                        (replyagent parity); approved/pending ones are immutable. */}
                                                    {["REJECTED", "PAUSED"].includes(String(template.status).toUpperCase()) && (
                                                    <DropdownMenuItem
                                                        onClick={() => handleOpenEditTemplate(template.id)}
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                                                    >
                                                        <Edit2 size={14} className="text-blue-500" />
                                                        {t("template_manager.row_menu.edit_template")}
                                                    </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setPreviewTemplateId(template.id);
                                                            setPreviewOpen(true);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                                                    >
                                                        <Eye size={14} className="text-blue-500" />
                                                        {t("template_manager.row_menu.preview")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleOpenCloneDialog(template.id)}
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                                                    >
                                                        <Copy size={14} className="text-blue-500" />
                                                        {t("template_manager.row_menu.clone_kit")}
                                                    </DropdownMenuItem>
                                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-1"></div>
                                                    <DropdownMenuItem
                                                        className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-red-500 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={() => handleOpenDeleteModal(template)}
                                                    >
                                                        <Trash2 size={14} />
                                                        {t("template_manager.row_menu.delete_template")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 6. Integrated Pagination Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-transparent flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-500">{t("template_manager.pagination.rows_per_page")}</span>
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm hover:bg-slate-50 transition-all text-[11px] font-semibold tabular-nums"
                                    onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                                >
                                    {rowsPerPage}
                                    <ChevronDown className="h-3 w-3 text-slate-400" />
                                </button>
                                {rowsDropdownOpen && (
                                    <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[60px] bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                                        <ul className="py-1">
                                            {[10, 25, 50].map(option => (
                                                <li
                                                    key={option}
                                                    className={cn(
                                                        "px-3 py-2 text-[11px] font-semibold tabular-nums cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors text-center",
                                                        rowsPerPage === option ? "bg-blue-50 text-blue-600" : "text-slate-600"
                                                    )}
                                                    onClick={() => {
                                                        setRowsPerPage(option);
                                                        setRowsDropdownOpen(false);
                                                        setPage(1);
                                                    }}
                                                >
                                                    {option}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                            {t("template_manager.pagination.results_total", { count: filteredAndSortedTemplates.length })}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                            {t("template_manager.pagination.page_of", { page, total: totalPages || 1 })}
                        </span>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30"
                                disabled={page === 1}
                                onClick={() => setPage(1)}
                            >
                                <ChevronsLeft size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-slate-50 disabled:opacity-30"
                                disabled={page === totalPages}
                                onClick={() => setPage(totalPages)}
                            >
                                <ChevronsRight size={14} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-preview">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("template_manager.preview_dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {(() => {
              const previewTemplate = whatsappTemplates.find(tpl => tpl.id === previewTemplateId);
              if (!previewTemplate) return null;

              return (
                <div className="h-full max-h-[62vh] w-full max-w-[31vh] flex flex-col items-center">
                  <PreviewV2
                    mode="chat"
                    headerText={previewTemplate.header || ""}
                    bodyText={previewTemplate.body || ""}
                    footerText={previewTemplate.footer || ""}
                    selectedMediaFile={previewTemplate.media?.file_url ?? ""}
                    templateButtons={previewTemplate.buttons || []}
                    variableSamples={previewTemplate.variableSamples || {}}
                    carouselCards={previewTemplate.carouselCards || []}
                    activeCardIndex={previewActiveCard}
                    onCardChange={setPreviewActiveCard}
                  />
                  <p className="text-[10px] py-1">{t("template_manager.preview_dialog.disclaimer")}</p>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createTemplateOpen} onOpenChange={handleCancelCreateTemplate}>
        <DialogContent className={
          templateCreationStep === "content" ? "max-w-5xl" : "max-w-3xl"
        } data-testid="dialog-create-template">
          {templateCreationStep === "category" && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <DialogTitle>{editingTemplateId ? t("template_manager.create_dialog.edit_title") : t("template_manager.create_dialog.create_title")}</DialogTitle>
                </div>
                <div className="space-y-3">
                  {/* 3-segment progress bar */}
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex-1 h-2 rounded-full transition-colors ${index < 1 ? "bg-primary" : "bg-muted"
                          }`}
                      />
                    ))}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("template_manager.create_dialog.category_step.heading")}</h3>
                    <p className="text-sm text-muted-foreground">{t("template_manager.create_dialog.category_step.description")}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Category Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card
                    className={`cursor-pointer hover-elevate active-elevate-2 shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0 ${selectedCategory === "Marketing" ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleCategorySelect("Marketing")}
                    data-testid="card-category-marketing"
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <ShoppingCart size={24} className="text-orange-600" />
                      </div>
                      <CardTitle className="text-base">{t("template_manager.create_dialog.category_step.marketing_title")}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground">{t("template_manager.create_dialog.category_step.marketing_desc")}</p>
                    </CardContent>
                  </Card>

                  <Card
                    className={`cursor-pointer hover-elevate active-elevate-2 shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0 ${selectedCategory === "Utility" ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleCategorySelect("Utility")}
                    data-testid="card-category-utility"
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bell size={24} className="text-blue-600" />
                      </div>
                      <CardTitle className="text-base">{t("template_manager.create_dialog.category_step.utility_title")}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground">{t("template_manager.create_dialog.category_step.utility_desc")}</p>
                    </CardContent>
                  </Card>

                </div>
                {/* Category Guidelines Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300">
                  <h4 className="font-semibold text-base text-blue-800 mb-2 dark:text-blue-300">{t("template_manager.create_dialog.category_step.guidelines_title")}</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc pl-5 dark:text-blue-300">
                    <li><strong>{t("template_manager.create_dialog.category_step.marketing_title")}:</strong> {t("template_manager.create_dialog.category_step.guideline_marketing_text")}</li>
                    <li><strong>{t("template_manager.create_dialog.category_step.utility_title")}:</strong> {t("template_manager.create_dialog.category_step.guideline_utility_text")}</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelCreateTemplate}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    {t("template_manager.create_dialog.cancel")}
                  </Button>
                  <Button
                    onClick={handleNextFromCategory}
                    disabled={!selectedCategory}
                    className="gap-2 font-normal btn-outline-primary"
                    variant="outline"
                  >
                    {t("template_manager.create_dialog.next")}
                  </Button>
                </div>
              </div>
            </>
          )}

          {templateCreationStep === "form" && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowLeft size={18} className="cursor-pointer" onClick={handleBackToCategory} />
                  <DialogTitle>{editingTemplateId ? t("template_manager.create_dialog.edit_title") : t("template_manager.create_dialog.create_title")}</DialogTitle>
                </div>
                <div className="space-y-3">
                  {/* 3-segment progress bar */}
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex-1 h-2 rounded-full transition-colors ${index < 2 ? "bg-primary" : "bg-muted"
                          }`}
                      />
                    ))}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("template_manager.create_dialog.form_step.heading")}</h3>
                    <p className="text-sm text-muted-foreground">{t("template_manager.create_dialog.form_step.description")}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Template Form */}
                <div className="space-y-4">
                  {/* Template Name and Language - Side by Side */}
                  <div>

                    <div className="flex gap-4">
                      {/* Template Name */}
                      <div className="space-y-2 w-full">
                        <label className="text-sm font-medium text-foreground">
                          {t("template_manager.create_dialog.form_step.template_name_label")}<span className="text-red-500 pl-0.5">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            id="template-name"
                            placeholder={t("template_manager.create_dialog.form_step.name_placeholder")}
                            value={templateName}
                            onChange={(e) => {
                              // Auto-decapitalize and allow only lowercase, numbers, underscores
                              const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 512);
                              setTemplateName(value);
                            }}
                            className="pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {templateName.length}/512
                          </span>
                        </div>
                      </div>

                      {/* Language Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          {t("template_manager.create_dialog.form_step.language_label")}<span className="text-red-500 pl-0.5">*</span>
                        </label>
                        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={t("template_manager.create_dialog.form_step.language_placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Values are Meta locale codes. The old list sent
                                English words ("French"), which Meta rejects. */}
                            {WA_TEMPLATE_LANGUAGES.map((lang) => (
                              <SelectItem key={lang.slug} value={lang.slug}>
                                {lang.name} ({lang.slug})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    </div>
                    {/* Template Name Guidelines */}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("template_manager.create_dialog.form_step.name_hint")}
                    </p>
                  </div>

                  {/* Template Type */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      {t("template_manager.create_dialog.form_step.type_label")}<span className="text-red-500 pl-0.5">*</span>
                    </label>

                    {/* Template Type Cards */}
                    <div>
                      <div className="max-h-[calc(100vh-30rem)] overflow-y-auto space-y-2">
                        {selectedCategory === "Utility" && (
                          <>
                            <div
                              onClick={() => setTemplateType("utility-default")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-default"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_default_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_default_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-appointment")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-appointment"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_appointment_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_appointment_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-issue")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-issue"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_issue_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_issue_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-payment")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-payment"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_payment_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_payment_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-shipping")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-shipping"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_shipping_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_shipping_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-reservation")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-reservation"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_reservation_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_reservation_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("utility-account")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "utility-account"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.utility_account_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.utility_account_desc")}</p>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedCategory === "Marketing" && (
                          <>
                            <div
                              onClick={() => setTemplateType("marketing-default")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "marketing-default"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.marketing_default_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.marketing_default_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("marketing-catalog")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "marketing-catalog"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.marketing_catalog_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.marketing_catalog_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("marketing-flows")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "marketing-flows"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.marketing_flows_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.marketing_flows_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("marketing-calling")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "marketing-calling"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.marketing_calling_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.marketing_calling_desc")}</p>
                              </div>
                            </div>
                          </>
                        )}

                        {selectedCategory === "Authentication" && (
                          <>
                            <div
                              onClick={() => setTemplateType("auth-default")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "auth-default"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.auth_default_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.auth_default_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("auth-account")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "auth-account"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.auth_account_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.auth_account_desc")}</p>
                              </div>
                            </div>

                            <div
                              onClick={() => setTemplateType("auth-alert")}
                              className={`px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${templateType === "auth-alert"
                                ? "border-primary bg-primary/10"
                                : "border-input"
                                }`}
                            >
                              <div>
                                <h4 className="font-semibold text-sm mb-1">{t("template_manager.create_dialog.form_step.auth_alert_title")}</h4>
                                <p className="text-xs text-muted-foreground">{t("template_manager.create_dialog.form_step.auth_alert_desc")}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-2">
                  <Button
                    variant="outline"
                    onClick={handleBackToCategory}
                    className="border-input [border-color:hsl(var(--input))] font-normal"
                  >
                    {t("template_manager.create_dialog.back")}
                  </Button>
                  <Button
                    onClick={handleNextFromForm}
                    disabled={!templateName.trim() || !templateType.trim()}
                    className="gap-2 font-normal btn-outline-primary"
                    variant="outline"
                  >
                    {t("template_manager.create_dialog.next")}
                  </Button>
                </div>
              </div>
            </>
          )}

          {templateCreationStep === "content" && (
            <>
              <DialogHeader className="mb-2">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowLeft size={18} className="cursor-pointer" onClick={handleBackToForm} />
                  <DialogTitle>{editingTemplateId ? t("template_manager.create_dialog.edit_title") : t("template_manager.create_dialog.create_title")}</DialogTitle>
                </div>
                <div className="space-y-3">
                  {/* 3-segment progress bar */}
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className={`flex-1 h-2 rounded-full transition-colors ${index < 3 ? "bg-primary" : "bg-muted"
                          }`}
                      />
                    ))}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex gap-4">
                {/* Left: Template Form */}
                <div className="flex-1 !max-h-[62vh] overflow-y-auto pr-2 -ml-1">
                  <div className="space-y-6 pl-1 pb-1">
                    {/* Template Content Heading */}
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t("template_manager.create_dialog.content_step.heading")}</h3>
                      <p className="text-sm text-muted-foreground">{t("template_manager.create_dialog.content_step.description")}</p>
                    </div>

                    {/* Template shape — Meta validates against this, so the
                        sections below change with it rather than all rendering. */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.structure_label")}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: "template", label: t("template_manager.create_dialog.content_step.structure_template_label"), hint: t("template_manager.create_dialog.content_step.structure_template_hint") },
                          { id: "carousel", label: t("template_manager.create_dialog.content_step.structure_carousel_label"), hint: t("template_manager.create_dialog.content_step.structure_carousel_hint") },
                          { id: "notification", label: t("template_manager.create_dialog.content_step.structure_notification_label"), hint: t("template_manager.create_dialog.content_step.structure_notification_hint") },
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setTemplateMode(opt.id);
                              if (opt.id === "carousel" && carouselCards.length === 0) {
                                setCarouselCards([{ mediaFormat: "IMAGE", media: null, body: "", buttons: [] }]);
                              }
                            }}
                            className={cn(
                              "rounded-lg border p-3 text-left transition-all",
                              templateMode === opt.id
                                ? "border-primary ring-1 ring-primary bg-primary/5"
                                : "border-input hover:border-primary/40",
                            )}
                          >
                            <p className="text-[12px] font-semibold text-foreground">{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{opt.hint}</p>
                          </button>
                        ))}
                      </div>
                    </div>
{templateMode !== "carousel" && (<>
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.header_label")}</label>
                          <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">{t("template_manager.create_dialog.content_step.optional")}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => setHeaderText(headerText + `{{${getNextVariableNumber()}}}`)}
                        >
                          <Plus size={12} />
                          {t("template_manager.create_dialog.content_step.add_variable")}
                        </Button>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder={t("template_manager.create_dialog.content_step.header_placeholder")}
                          value={headerText}
                          onChange={(e) => setHeaderText(e.target.value.slice(0, 60))}
                          className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {headerText.length}/60
                        </span>
                      </div>
                    </div>

                    </>)}

                    {/* Media Sample — single-card templates only. A carousel's
                        media lives on each card; an agent notification is text. */}
                    {templateMode === "template" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.media_sample_label")}</label>
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">{t("template_manager.create_dialog.content_step.optional")}</span>
                      </div>
                      {/* The header media is chosen from the media gallery, not
                          from a local file input. Meta needs the bytes uploaded
                          to the app to issue a header handle, and the backend
                          does that from the gallery file's URL at submit time —
                          a browser File object never reached the server, which
                          is why the old "Browse" button silently did nothing. */}
                      {selectedMedia ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded border border-input [border-color:hsl(var(--input))]">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-foreground text-sm">{selectedMedia.file_name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              ({(selectedMedia.file_length / 1024).toFixed(1)}KB)
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedMedia(null)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select
                            value={mediaSample}
                            onValueChange={(v) => {
                              setMediaSample(v);
                              setSelectedMedia(null);
                            }}
                          >
                            <SelectTrigger className="w-[160px] border border-input [border-color:hsl(var(--input))] hover-elevate">
                              <SelectValue placeholder={t("template_manager.create_dialog.content_step.media_type_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t("template_manager.create_dialog.content_step.media_none")}</SelectItem>
                              <SelectItem value="image">{t("template_manager.create_dialog.content_step.media_image")}</SelectItem>
                              <SelectItem value="video">{t("template_manager.create_dialog.content_step.media_video")}</SelectItem>
                              <SelectItem value="document">{t("template_manager.create_dialog.content_step.media_document")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {(mediaSample === "image" || mediaSample === "video" || mediaSample === "document") && (
                            <Button className="font-normal" onClick={() => setMediaPickerOpen(true)}>
                              {t("template_manager.create_dialog.content_step.choose_from_gallery")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    )}

                    {/* Body — for a carousel this is the message bubble that
                        appears above the cards, which Meta also requires. */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">
                          {t("template_manager.create_dialog.content_step.body_label")}<span className="text-red-500 pl-0.5">*</span>
                        </label>
                        <div className="flex gap-1 items-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleBold}
                              >
                                <Bold size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("template_manager.create_dialog.content_step.bold_tooltip")}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleItalic}
                              >
                                <Italic size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("template_manager.create_dialog.content_step.italic_tooltip")}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={handleStrikethrough}
                              >
                                <Strikethrough size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("template_manager.create_dialog.content_step.strikethrough_tooltip")}</TooltipContent>
                          </Tooltip>
                          <div className="relative">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                  <Smile size={14} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("template_manager.create_dialog.content_step.add_emoji_tooltip")}</TooltipContent>
                            </Tooltip>
                            {showEmojiPicker && (
                              <div
                                ref={emojiPickerRef}
                                className="absolute top-8 right-0 z-50"
                              >
                                <Picker
                                  data={data}
                                  onEmojiSelect={handleEmojiSelect}
                                  theme="light"
                                  previewPosition="none"
                                  skinTonePosition="top"
                                  maxFrequentRows={1}
                                  perLine={8}
                                  set="native"
                                />
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => setBodyText(bodyText + `{{${getNextVariableNumber()}}}`)}
                          >
                            <Plus size={12} />
                            {t("template_manager.create_dialog.content_step.add_variable")}
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <textarea
                          ref={bodyTextareaRef}
                          placeholder={t("template_manager.create_dialog.content_step.body_placeholder")}
                          value={bodyText}
                          onChange={(e) => setBodyText(e.target.value.slice(0, 1024))}
                          className="w-full min-h-[120px] p-3 pr-16 pb-8 border border-input [border-color:hsl(var(--input))] rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-[0.90rem] hover-elevate"
                        />
                        <span className="absolute bottom-4 right-2 text-xs text-muted-foreground">
                          {bodyText.length}/1024
                        </span>
                      </div>
                    </div>

                    {/* Variable Samples */}
                    {getAllVariables().length > 0 && (
                      <div className="space-y-2">
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-1">
                            {t("template_manager.create_dialog.content_step.variable_samples_label")}<span className="text-red-500 pl-0.5">*</span>
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {t("template_manager.create_dialog.content_step.variable_samples_desc")}
                          </p>
                        </div>
                        <div className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-3 items-center">
                          {getAllVariables().map((variable) => {
                            // Extract the content inside the braces (could be number or text)
                            const variableKey = variable.match(/\{\{([^}]+)\}\}/)?.[1] || "";
                            const currentValue = variableSamples[variableKey] || "";
                            // A mapped key looks like "[SLUG]" — if the current value matches
                            // one of the known merge tags, the select shows it as selected.
                            const mappedKey = templateKeyOptions.find((k) => k.value === currentValue);
                            return (
                              <>
                                <div key={`${variable}-label`} className="font-medium text-sm">{variable}</div>
                                <Select
                                  key={`${variable}-map`}
                                  value={mappedKey?.value ?? "__custom__"}
                                  onValueChange={(v) => {
                                    if (v === "__custom__") return;
                                    setVariableSamples({ ...variableSamples, [variableKey]: v });
                                  }}
                                >
                                  <SelectTrigger className="w-[150px] h-9 text-xs border border-input [border-color:hsl(var(--input))]">
                                    <SelectValue placeholder={t("template_manager.create_dialog.content_step.map_to_field_placeholder")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__custom__">{t("template_manager.create_dialog.content_step.custom_sample_option")}</SelectItem>
                                    {templateKeyOptions.map((k) => (
                                      <SelectItem key={k.value} value={k.value}>
                                        {k.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  key={`${variable}-input`}
                                  placeholder={t("template_manager.create_dialog.content_step.sample_text_placeholder", { variable })}
                                  value={currentValue}
                                  onChange={(e) => setVariableSamples({ ...variableSamples, [variableKey]: e.target.value })}
                                  className="border border-input [border-color:hsl(var(--input))] hover-elevate"
                                />
                              </>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Buttons - single-card only. Carousel buttons belong to
                        each card, and agent notifications have none. */}
                    {templateMode === "template" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.buttons_label")}</label>
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">{t("template_manager.create_dialog.content_step.optional")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("template_manager.create_dialog.content_step.buttons_desc")}
                      </p>
                      <Select onValueChange={(value) => {
                        if (value && templateButtons.length < 10) {
                          // Add button to list instead of selecting
                          const newButton: any = { id: Date.now(), type: value };

                          // Initialize with default values based on button type
                          if (value === "visit-website") {
                            newButton.urlType = "static";
                          } else if (value === "call-phone") {
                            newButton.country = "+1";
                          } else if (value === "complete-flow") {
                            newButton.flowButton = "default";
                          } else if (value === "copy-offer") {
                            newButton.activeFor = "7";
                          }

                          setTemplateButtons([...templateButtons, newButton]);
                        }
                      }} value="" disabled={templateButtons.length >= 10}>
                        <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate pl-3 disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue placeholder={templateButtons.length >= 10 ? t("template_manager.create_dialog.content_step.max_buttons_reached") : t("template_manager.create_dialog.content_step.add_button_placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick-reply" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_quick_reply_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_quick_reply_desc")}</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="visit-website" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_visit_website_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_visit_website_desc")}</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="call-whatsapp" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_call_whatsapp_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_call_whatsapp_desc")}</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="call-phone" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_call_phone_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_call_phone_desc")}</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="complete-flow" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_complete_flow_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_complete_flow_desc")}</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="copy-offer" className="pl-4">
                            <div>
                              <div className="font-medium">{t("template_manager.create_dialog.content_step.button_copy_offer_label")}</div>
                              <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.button_copy_offer_desc")}</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Added Buttons List */}
                      {templateButtons.length > 0 && (
                        <div className="space-y-4 mt-4">
                          {templateButtons.map((button) => {
                            const buttonLabels: Record<string, { label: string; description: string }> = {
                              "quick-reply": { label: t("template_manager.create_dialog.content_step.button_quick_reply_label"), description: t("template_manager.create_dialog.content_step.button_quick_reply_desc") },
                              "visit-website": { label: t("template_manager.create_dialog.content_step.button_visit_website_label"), description: t("template_manager.create_dialog.content_step.button_visit_website_desc") },
                              "call-whatsapp": { label: t("template_manager.create_dialog.content_step.button_call_whatsapp_label"), description: t("template_manager.create_dialog.content_step.button_call_whatsapp_desc") },
                              "call-phone": { label: t("template_manager.create_dialog.content_step.button_call_phone_label"), description: t("template_manager.create_dialog.content_step.button_call_phone_desc") },
                              "complete-flow": { label: t("template_manager.create_dialog.content_step.button_complete_flow_label"), description: t("template_manager.create_dialog.content_step.button_complete_flow_desc") },
                              "copy-offer": { label: t("template_manager.create_dialog.content_step.button_copy_offer_label"), description: t("template_manager.create_dialog.content_step.button_copy_offer_desc") }
                            };
                            const buttonInfo = buttonLabels[button.type];
                            return (
                              <div
                                key={button.id}
                                className="border border-input rounded-lg bg-muted/30 overflow-hidden"
                                draggable
                                onDragStart={() => handleButtonDragStart(button.id)}
                                onDragOver={handleButtonDragOver}
                                onDrop={() => handleButtonDrop(button.id)}
                              >
                                {/* Button Header */}
                                <div className="flex gap-2 items-center p-3 border-b border-input">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{buttonInfo?.label}</p>
                                    <p className="text-xs text-muted-foreground">{buttonInfo?.description}</p>
                                  </div>
                                  <button onClick={() => setTemplateButtons(templateButtons.filter(b => b.id !== button.id))} className="p-2 hover:bg-muted rounded"><Trash2 size={14} /></button>
                                  <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                                </div>

                                {/* Button Configuration */}
                                <div className="p-4 space-y-3">
                                  {/* Quick Reply */}
                                  {button.type === "quick-reply" && (
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                      <div className="relative">
                                        <Input
                                          placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                          value={button.buttonText || ""}
                                          onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                          className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                          {(button.buttonText || "").length}/25
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Visit Website */}
                                  {button.type === "visit-website" && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                            value={button.buttonText || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.buttonText || "").length}/25
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.url_type_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <Select value={button.urlType || "static"} onValueChange={(value) => updateButtonConfig(button.id, "urlType", value)}>
                                          <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                                            <SelectValue placeholder={t("template_manager.create_dialog.content_step.select_url_type")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="static">{t("template_manager.create_dialog.content_step.url_type_static")}</SelectItem>
                                            <SelectItem value="dynamic">{t("template_manager.create_dialog.content_step.url_type_dynamic")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.website_url_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_website_url")}
                                            value={button.websiteUrl || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "websiteUrl", e.target.value.slice(0, 2000))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.websiteUrl || "").length}/2000
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          id={`track-conversion-${button.id}`}
                                          checked={button.trackAppConversion || false}
                                          onCheckedChange={(checked) => updateButtonConfig(button.id, "trackAppConversion", checked)}
                                        />
                                        <label htmlFor={`track-conversion-${button.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                                          {t("template_manager.create_dialog.content_step.track_conversion_label")}
                                        </label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Checkbox
                                          id={`enable-meta-${button.id}`}
                                          checked={button.enableMetaTracking || false}
                                          onCheckedChange={(checked) => updateButtonConfig(button.id, "enableMetaTracking", checked)}
                                        />
                                        <label htmlFor={`enable-meta-${button.id}`} className="text-sm font-medium text-foreground cursor-pointer">
                                          {t("template_manager.create_dialog.content_step.enable_meta_tracking_label")}
                                        </label>
                                      </div>
                                    </div>
                                  )}

                                  {/* Call on WhatsApp */}
                                  {button.type === "call-whatsapp" && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                            value={button.buttonText || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.buttonText || "").length}/25
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.active_for_label")}</label>
                                        <Select value={button.activeFor || "7"} onValueChange={(value) => updateButtonConfig(button.id, "activeFor", value)}>
                                          <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                                            <SelectValue placeholder={t("template_manager.create_dialog.content_step.select_duration")} />
                                          </SelectTrigger>
                                          <SelectContent className="max-h-[200px]">
                                            {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                                              <SelectItem key={day} value={`${day}`}>
                                                {day === 1
                                                  ? t("template_manager.create_dialog.content_step.day_one", { count: day })
                                                  : t("template_manager.create_dialog.content_step.day_other", { count: day })}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )}

                                  {/* Call Phone Number */}
                                  {button.type === "call-phone" && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                            value={button.buttonText || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.buttonText || "").length}/25
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.country_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <Select value={button.country || "+1"} onValueChange={(value) => updateButtonConfig(button.id, "country", value)}>
                                          <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                                            <SelectValue placeholder={t("template_manager.create_dialog.content_step.select_country")} />
                                          </SelectTrigger>
                                          <SelectContent className="max-h-[200px]">
                                            <SelectItem value="+1">{t("template_manager.create_dialog.content_step.country_us_ca")}</SelectItem>
                                            <SelectItem value="+44">{t("template_manager.create_dialog.content_step.country_uk")}</SelectItem>
                                            <SelectItem value="+33">{t("template_manager.create_dialog.content_step.country_fr")}</SelectItem>
                                            <SelectItem value="+49">{t("template_manager.create_dialog.content_step.country_de")}</SelectItem>
                                            <SelectItem value="+39">{t("template_manager.create_dialog.content_step.country_it")}</SelectItem>
                                            <SelectItem value="+34">{t("template_manager.create_dialog.content_step.country_es")}</SelectItem>
                                            <SelectItem value="+91">{t("template_manager.create_dialog.content_step.country_in")}</SelectItem>
                                            <SelectItem value="+86">{t("template_manager.create_dialog.content_step.country_cn")}</SelectItem>
                                            <SelectItem value="+81">{t("template_manager.create_dialog.content_step.country_jp")}</SelectItem>
                                            <SelectItem value="+55">{t("template_manager.create_dialog.content_step.country_br")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.phone_number_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_phone_number")}
                                            value={button.phoneNumber || ""}
                                            onChange={(e) => {
                                              const numbersOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 20);
                                              updateButtonConfig(button.id, "phoneNumber", numbersOnly);
                                            }}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.phoneNumber || "").length}/20
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Complete Flow */}
                                  {button.type === "complete-flow" && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                            value={button.buttonText || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.buttonText || "").length}/25
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.flow_button_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <Select value={button.flowButton || "default"} onValueChange={(value) => updateButtonConfig(button.id, "flowButton", value)}>
                                          <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate">
                                            <SelectValue placeholder={t("template_manager.create_dialog.content_step.select_button_type")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="default">{t("template_manager.create_dialog.content_step.flow_default")}</SelectItem>
                                            <SelectItem value="document">{t("template_manager.create_dialog.content_step.flow_document")}</SelectItem>
                                            <SelectItem value="promotion">{t("template_manager.create_dialog.content_step.flow_promotion")}</SelectItem>
                                            <SelectItem value="review">{t("template_manager.create_dialog.content_step.flow_review")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.flow_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <Select value={button.flowId || ""} onValueChange={(value) => updateButtonConfig(button.id, "flowId", value)}>
                                          <SelectTrigger className="border border-input [border-color:hsl(var(--input))] hover-elevate pl-3">
                                            <SelectValue placeholder={t("template_manager.create_dialog.content_step.select_flow")}>
                                              {button.flowId && (
                                                <span className="font-normal">
                                                  {button.flowId === "product-inquiry" && t("template_manager.create_dialog.content_step.flow_product_inquiry_label")}
                                                  {button.flowId === "support-request" && t("template_manager.create_dialog.content_step.flow_support_request_label")}
                                                  {button.flowId === "promotional-survey" && t("template_manager.create_dialog.content_step.flow_promotional_survey_label")}
                                                  {button.flowId === "review-collection" && t("template_manager.create_dialog.content_step.flow_review_collection_label")}
                                                </span>
                                              )}
                                            </SelectValue>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="product-inquiry">
                                              <div>
                                                <div className="font-medium flex items-center gap-2">
                                                  {t("template_manager.create_dialog.content_step.flow_product_inquiry_label")}
                                                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{t("template_manager.create_dialog.content_step.flow_default")}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.flow_product_inquiry_desc")}</div>
                                              </div>
                                            </SelectItem>
                                            <SelectItem value="support-request">
                                              <div>
                                                <div className="font-medium flex items-center gap-2">
                                                  {t("template_manager.create_dialog.content_step.flow_support_request_label")}
                                                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{t("template_manager.create_dialog.content_step.flow_document")}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.flow_support_request_desc")}</div>
                                              </div>
                                            </SelectItem>
                                            <SelectItem value="promotional-survey">
                                              <div>
                                                <div className="font-medium flex items-center gap-2">
                                                  {t("template_manager.create_dialog.content_step.flow_promotional_survey_label")}
                                                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{t("template_manager.create_dialog.content_step.flow_promotion")}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.flow_promotional_survey_desc")}</div>
                                              </div>
                                            </SelectItem>
                                            <SelectItem value="review-collection">
                                              <div>
                                                <div className="font-medium flex items-center gap-2">
                                                  {t("template_manager.create_dialog.content_step.flow_review_collection_label")}
                                                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded">{t("template_manager.create_dialog.content_step.flow_review")}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{t("template_manager.create_dialog.content_step.flow_review_collection_desc")}</div>
                                              </div>
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )}

                                  {/* Copy Offer */}
                                  {button.type === "copy-offer" && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.button_text_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_button_text")}
                                            value={button.buttonText || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "buttonText", e.target.value.slice(0, 25))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.buttonText || "").length}/25
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.offer_code_label")}<span className="text-red-500 pl-0.5">*</span></label>
                                        <div className="relative">
                                          <Input
                                            placeholder={t("template_manager.create_dialog.content_step.enter_offer_code")}
                                            value={button.offerCode || ""}
                                            onChange={(e) => updateButtonConfig(button.id, "offerCode", e.target.value.slice(0, 15))}
                                            className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            {(button.offerCode || "").length}/15
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>
                            );
                          }
                          )}
                        </div>
                      )}
                    </div>

                    )}

                    {/* Footer - a carousel bubble has no footer. */}
                    {templateMode !== "carousel" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.footer_label")}</label>
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">{t("template_manager.create_dialog.content_step.optional")}</span>
                      </div>
                      <div className="relative">
                        <Input
                          placeholder={t("template_manager.create_dialog.content_step.footer_placeholder")}
                          value={footerText}
                          onChange={(e) => setFooterText(e.target.value.slice(0, 60))}
                          className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {footerText.length}/60
                        </span>
                      </div>
                    </div>
                    )}

                    {/* Carousel cards */}
                    {templateMode === "carousel" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-foreground">{t("template_manager.create_dialog.content_step.cards_label")}</label>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {t("template_manager.create_dialog.content_step.cards_desc")}
                            </p>
                          </div>
                          {carouselCards.length < 10 && (
                            <Button
                              variant="outline"
                              className="font-normal"
                              onClick={() =>
                                setCarouselCards((prev) => [
                                  ...prev,
                                  { mediaFormat: "IMAGE", media: null, body: "", buttons: [] },
                                ])
                              }
                            >
                              <Plus size={14} className="mr-1" /> {t("template_manager.create_dialog.content_step.add_card")}
                            </Button>
                          )}
                        </div>

                        {carouselCards.map((card: any, index: number) => (
                          <div
                            key={index}
                            className="rounded-lg border border-input [border-color:hsl(var(--input))] p-3 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[12px] font-semibold text-foreground">
                                {t("template_manager.create_dialog.content_step.card_number", { number: index + 1 })}
                              </span>
                              {carouselCards.length > 1 && (
                                <button
                                  onClick={() =>
                                    setCarouselCards((prev) => prev.filter((_, i) => i !== index))
                                  }
                                  className="text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Select
                                value={card.mediaFormat}
                                onValueChange={(v) =>
                                  setCarouselCards((prev) =>
                                    prev.map((c, i) =>
                                      i === index ? { ...c, mediaFormat: v, media: null } : c,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="w-[130px] border border-input [border-color:hsl(var(--input))]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="IMAGE">{t("template_manager.create_dialog.content_step.media_image")}</SelectItem>
                                  <SelectItem value="VIDEO">{t("template_manager.create_dialog.content_step.media_video")}</SelectItem>
                                </SelectContent>
                              </Select>
                              {card.media ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded border border-input [border-color:hsl(var(--input))] flex-1 min-w-0">
                                  <Paperclip size={13} className="text-muted-foreground shrink-0" />
                                  <span className="truncate text-foreground text-xs flex-1">
                                    {card.media.file_name}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setCarouselCards((prev) =>
                                        prev.map((c, i) => (i === index ? { ...c, media: null } : c)),
                                      )
                                    }
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="font-normal"
                                  onClick={() => setCardPickerIndex(index)}
                                >
                                  {t("template_manager.create_dialog.content_step.choose_from_gallery")}
                                </Button>
                              )}
                            </div>

                            <div className="relative">
                              <Textarea
                                placeholder={t("template_manager.create_dialog.content_step.card_body_placeholder")}
                                value={card.body}
                                onChange={(e) =>
                                  setCarouselCards((prev) =>
                                    prev.map((c, i) =>
                                      i === index ? { ...c, body: e.target.value.slice(0, 160) } : c,
                                    ),
                                  )
                                }
                                className="min-h-[70px] pr-14 border border-input [border-color:hsl(var(--input))]"
                              />
                              <span className="absolute right-3 bottom-2 text-xs text-muted-foreground">
                                {String(card.body ?? "").length}/160
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  {t("template_manager.create_dialog.content_step.card_buttons_count", { count: (card.buttons ?? []).length })}
                                </span>
                                {(card.buttons ?? []).length < 2 && (
                                  <Select
                                    value=""
                                    onValueChange={(v) =>
                                      setCarouselCards((prev) =>
                                        prev.map((c, i) =>
                                          i === index
                                            ? { ...c, buttons: [...(c.buttons ?? []), { type: v, buttonText: "" }] }
                                            : c,
                                        ),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-[150px] h-8 text-xs border border-input [border-color:hsl(var(--input))]">
                                      <SelectValue placeholder={t("template_manager.create_dialog.content_step.add_a_button")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="quick-reply">{t("template_manager.create_dialog.content_step.button_quick_reply_label")}</SelectItem>
                                      <SelectItem value="visit-website">{t("template_manager.create_dialog.content_step.button_visit_website_label")}</SelectItem>
                                      <SelectItem value="call-phone">{t("template_manager.create_dialog.content_step.button_call_phone_label")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              {(card.buttons ?? []).map((btn: any, bi: number) => (
                                <div key={bi} className="flex gap-2 items-center">
                                  <Input
                                    placeholder={t("template_manager.create_dialog.content_step.button_text_placeholder")}
                                    value={btn.buttonText ?? ""}
                                    onChange={(e) =>
                                      setCarouselCards((prev) =>
                                        prev.map((c, i) =>
                                          i === index
                                            ? {
                                                ...c,
                                                buttons: c.buttons.map((b: any, k: number) =>
                                                  k === bi ? { ...b, buttonText: e.target.value.slice(0, 25) } : b,
                                                ),
                                              }
                                            : c,
                                        ),
                                      )
                                    }
                                    className="h-8 text-xs border border-input [border-color:hsl(var(--input))]"
                                  />
                                  {btn.type === "visit-website" && (
                                    <Input
                                      placeholder={t("template_manager.create_dialog.content_step.website_url_placeholder")}
                                      value={btn.websiteUrl ?? ""}
                                      onChange={(e) =>
                                        setCarouselCards((prev) =>
                                          prev.map((c, i) =>
                                            i === index
                                              ? {
                                                  ...c,
                                                  buttons: c.buttons.map((b: any, k: number) =>
                                                    k === bi ? { ...b, websiteUrl: e.target.value } : b,
                                                  ),
                                                }
                                              : c,
                                          ),
                                        )
                                      }
                                      className="h-8 text-xs border border-input [border-color:hsl(var(--input))]"
                                    />
                                  )}
                                  {btn.type === "call-phone" && (
                                    <Input
                                      placeholder={t("template_manager.create_dialog.content_step.phone_placeholder")}
                                      value={btn.phoneNumber ?? ""}
                                      onChange={(e) =>
                                        setCarouselCards((prev) =>
                                          prev.map((c, i) =>
                                            i === index
                                              ? {
                                                  ...c,
                                                  buttons: c.buttons.map((b: any, k: number) =>
                                                    k === bi ? { ...b, phoneNumber: e.target.value } : b,
                                                  ),
                                                }
                                              : c,
                                          ),
                                        )
                                      }
                                      className="h-8 text-xs border border-input [border-color:hsl(var(--input))]"
                                    />
                                  )}
                                  <button
                                    onClick={() =>
                                      setCarouselCards((prev) =>
                                        prev.map((c, i) =>
                                          i === index
                                            ? { ...c, buttons: c.buttons.filter((_: any, k: number) => k !== bi) }
                                            : c,
                                        ),
                                      )
                                    }
                                    className="text-muted-foreground hover:text-red-500 shrink-0"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Template Preview */}
                <div>
                  <h3 className="font-semibold text-lg mb-1">{t("template_manager.create_dialog.content_step.preview_title")}</h3>
                  <div className="h-full max-h-[62vh] w-full max-w-[31vh] flex flex-col items-center">
                    <PreviewV2
                      mode="chat"
                      headerText={headerText}
                      bodyText={bodyText}
                      footerText={footerText}
                      selectedMediaFile={selectedMedia?.file_url ?? ""}
                      templateButtons={templateButtons}
                      variableSamples={variableSamples}
                      carouselCards={templateMode === "carousel" ? carouselCards : []}
                      activeCardIndex={composerActiveCard}
                      onCardChange={setComposerActiveCard}
                    />
                    <p className="text-[10px] py-1">{t("template_manager.create_dialog.content_step.preview_disclaimer")}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handleBackToForm}
                  className="border-input [border-color:hsl(var(--input))] font-normal"
                >
                  {t("template_manager.create_dialog.back")}
                </Button>
                <div className="flex gap-2">
                  <Button
                    className="gap-2 font-normal btn-outline-primary"
                    variant="outline"
                    disabled={
                      editingTemplateId === null
                        ? !isTemplateFormValid() || createTemplateMutation.isPending
                        : !isTemplateFormValid() || !hasTemplateChanged()
                    }
                    onClick={
                      editingTemplateId === null
                        ? handleCreateTemplate
                        : handleSaveEditedTemplate
                    }
                  >
                    {editingTemplateId === null
                      ? createTemplateMutation.isPending
                        ? t("template_manager.create_dialog.creating")
                        : t("template_manager.create_dialog.create_template_button")
                      : t("template_manager.create_dialog.save_template_button")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Clone Template Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={handleCancelCloneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("template_manager.clone_dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("template_manager.clone_dialog.name_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <div className="relative">
                <Input
                  placeholder={t("template_manager.clone_dialog.name_placeholder")}
                  value={cloneTemplateName}
                  onChange={(e) => setCloneTemplateName(e.target.value.slice(0, 512))}
                  className="pr-12 border border-input [border-color:hsl(var(--input))] hover-elevate"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {cloneTemplateName.length}/512
                </span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelCloneDialog}>
                {t("template_manager.clone_dialog.cancel")}
              </Button>
              <Button
                onClick={handleCloneTemplate}
                disabled={!cloneTemplateName.trim()}
              >
                {t("template_manager.clone_dialog.clone_button")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteTemplateModal} onOpenChange={setShowDeleteTemplateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("template_manager.delete_dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("template_manager.delete_dialog.confirm", { name: templateToDelete?.name ?? "" })}
            </p>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowDeleteTemplateModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("template_manager.delete_dialog.cancel")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 border-red-600 text-white"
            >
              {t("template_manager.delete_dialog.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-card media picker for carousel cards. */}
      <TemplateMediaPicker
        open={cardPickerIndex !== null}
        format={
          (String(
            carouselCards[cardPickerIndex ?? 0]?.mediaFormat ?? "IMAGE",
          ).toUpperCase() as "IMAGE" | "VIDEO" | "DOCUMENT")
        }
        onClose={() => setCardPickerIndex(null)}
        onSelect={(media) =>
          setCarouselCards((prev) =>
            prev.map((c, i) => (i === cardPickerIndex ? { ...c, media } : c)),
          )
        }
      />

      {/* Header media picker — gallery-backed, see the Media Sample block. */}
      <TemplateMediaPicker
        open={mediaPickerOpen}
        format={(mediaSample.toUpperCase() as "IMAGE" | "VIDEO" | "DOCUMENT") || "IMAGE"}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={setSelectedMedia}
      />

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("template_manager.bulk_delete_dialog.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("template_manager.bulk_delete_dialog.confirm", { count: selectedTemplates.length })}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowBulkDeleteModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("template_manager.bulk_delete_dialog.cancel")}
            </Button>
            <Button
              onClick={handleConfirmBulkDelete}
              className="bg-red-500 hover:bg-red-600 border-red-600 text-white"
            >
              {t("template_manager.bulk_delete_dialog.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}