"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail,
  BarChart2,
  MessageSquare,
  FileText,
  Send,
  Users,
  Settings,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  GitMerge,
  Search,
  Sun,
  Moon,
  Circle,
  Phone,
  Check,
  User,
  Hash,
  Instagram,
  MessageCircle,

  LifeBuoy,
  Plus,
  LogOut
} from "react-feather";
import { LayoutGrid } from "lucide-react"; // Import for the new grid icon
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { SiWhatsapp } from "react-icons/si";
import { FaTelegramPlane } from "react-icons/fa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import CustomDropdown from "@/components/CustomDropdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { SUPPORTED_LANGUAGES } from "@/lib/supportedLanguages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ContactProfileModal from "@/components/ContactProfileModal";

// Default (no white-label logo uploaded) mark — same icon used on the auth pages.
const BotMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill="#25d366" />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill="#25d366" />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill="#25d366" />
  </svg>
);

export default function AppSidebar() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  // State for Theme and Online Status
  const { mode: theme, setMode: setTheme } = useTheme();
  const workspaceTz = useWorkspaceTimezone();
  const [status, setStatus] = useState<"available" | "unavailable">("available");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userInfo = localStorage.getItem("user_info");
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
  }, []);

  // Shares the same query key ProfileSection uses for /api/users/me, so a
  // photo saved there is reflected here too (react-query dedupes/updates
  // both from the same cache entry) instead of this header staying stuck
  // on initials from the login-time localStorage snapshot forever.
  const { data: meData } = useQuery<any>({
    queryKey: ["/api/users/me"],
    queryFn: async () => (await apiRequest("GET", "/api/users/me")).json(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState<string[]>([i18n.language || "en"]);
  const [openLang, setOpenLang] = useState(false);

  // Keep the dropdown's selected language in sync with i18n — mirrors the
  // Agency sidebar fix so a language picked elsewhere (or the persisted
  // choice on load) shows correctly here too.
  useEffect(() => {
    const match = SUPPORTED_LANGUAGES.find((l) => i18n.language?.startsWith(l.code));
    setLanguage([match ? match.code : "en"]);
  }, [i18n.language]);
  const [searchType, setSearchType] = useState("WhatsApp Number");
  const [profileContact, setProfileContact] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Real workspaces this user can switch to (replyagent parity). Owner sees all
  // agency workspaces; an agent sees only the ones assigned to them.
  const { data: wsResp } = useQuery<any>({
    queryKey: ["/api/workspaces/accessible"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/accessible");
      return res.json();
    },
  });

  // White-label branding — drives the header logo (replyagent Branding.logo accessor parity).
  // Falls back to "EC" + "EZCONN" when no logo is uploaded.
  // 1) localStorage initialData → instant render on revisit (no API wait, no flicker).
  // 2) Background refetch keeps the cache fresh.
  // 3) 30-min TTL — well under the 1-hour signed-URL expiry so URLs stay valid.
  const BRANDING_CACHE_KEY = "ws_branding_cache_v1";
  const BRANDING_CACHE_TTL = 30 * 60 * 1000;
  const cachedBranding = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(BRANDING_CACHE_KEY) : null;
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > BRANDING_CACHE_TTL) return undefined;
      return data;
    } catch {
      return undefined;
    }
  })();
  const { data: brandingData, isLoading: isBrandingLoading } = useQuery<any>({
    queryKey: ["/api/workspaces/branding"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/branding");
      return res.json();
    },
    initialData: cachedBranding,
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (brandingData) {
      try {
        localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({ data: brandingData, ts: Date.now() }));
      } catch { /* ignore quota errors */ }
    }
  }, [brandingData]);

  // Notifications — top-bell dropdown. Shows 2 previews; "View all" navigates to /notifications page.
  const [notifOpen, setNotifOpen] = useState(false);
  const { data: notifResp, refetch: refetchNotifs } = useQuery<any>({
    queryKey: ["/api/notifications", { limit: 2 }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/notifications?limit=2`);
      return res.json();
    },
    refetchInterval: 15 * 1000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const notifications: any[] = notifResp?.notifications || [];
  const unreadCount: number = notifResp?.unread || 0;

  /** Human-readable relative time without pulling in a date library. */
  const formatRelativeTime = (iso: string | Date | null | undefined): string => {
    if (!iso) return "";
    const date = typeof iso === "string" ? new Date(iso) : iso;
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return t("app_sidebar.time_just_now");
    if (diffSec < 3600) return t("app_sidebar.time_minutes_ago", { count: Math.floor(diffSec / 60) });
    if (diffSec < 86400) return t("app_sidebar.time_hours_ago", { count: Math.floor(diffSec / 3600) });
    if (diffSec < 604800) return t("app_sidebar.time_days_ago", { count: Math.floor(diffSec / 86400) });
    return formatInWorkspaceTz(date, "M/d/yyyy", workspaceTz);
  };

  const handleNotifClick = async (n: any) => {
    if (!n.read) {
      try {
        await apiRequest("POST", `/api/notifications/${n.id}/read`, {});
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      } catch {}
    }
    setNotifOpen(false);
    setLocation("/notifications");
  };

  /** Map a notification slug to the right icon/colour. */
  const getNotifIcon = (slug?: string): { Icon: any; color: string } => {
    const s = (slug || "").toLowerCase();
    if (s.includes("message") || s.includes("mail")) return { Icon: Mail, color: "text-blue-500" };
    if (s.includes("campaign") || s.includes("broadcast") || s.includes("send")) return { Icon: Send, color: "text-green-500" };
    if (s.includes("approved") || s.includes("complete") || s.includes("success")) return { Icon: Check, color: "text-indigo-500" };
    if (s.includes("chat") || s.includes("conversation")) return { Icon: MessageSquare, color: "text-purple-500" };
    return { Icon: Bell, color: "text-slate-500" };
  };
  // Theme-aware logo selection (replyagent parity). Small/square variant preferred for
  // the 36x36 header badge. Workspace branding API already includes parent agency
  // fallback baked into these URLs (workspace logo → agency logo).
  const headerLogoUrl: string | null = theme === "dark"
    ? brandingData?.logo_dark_small_url ||
      brandingData?.logo_light_small_url ||
      brandingData?.logo_dark_url ||
      brandingData?.logo_light_url ||
      null
    : brandingData?.logo_light_small_url ||
      brandingData?.logo_dark_small_url ||
      brandingData?.logo_light_url ||
      brandingData?.logo_dark_url ||
      null;
  const accessibleWorkspaces: any[] = wsResp?.workspaces || [];
  // Current workspace = the one matching the host's subdomain (set the dropdown to it).
  const currentSub = typeof window !== "undefined" ? window.location.hostname.split(".")[0] : "";
  const workspaceSelected = (() => {
    const cur = accessibleWorkspaces.find((w) => (w.sub_domain || w.slug) === currentSub);
    return cur ? [cur.sub_domain || cur.slug] : [];
  })();
  // Switching navigates to the target workspace's subdomain, keeping the current
  // root domain + port (so it works the same in local dev and production).
  const switchWorkspace = (val: string[]) => {
    const targetId = val[0];
    if (!targetId || targetId === currentSub) return;
    const target = accessibleWorkspaces.find((w) => (w.sub_domain || w.slug) === targetId);
    if (!target) return;
    const parts = window.location.hostname.split(".");
    const root = parts.length > 1 ? parts.slice(1).join(".") : parts[0];
    const port = window.location.port ? `:${window.location.port}` : "";
    window.location.href = `${window.location.protocol}//${target.sub_domain || target.slug}.${root}${port}`;
  };

  const searchOptions = [
    { label: "WhatsApp Number", icon: <SiWhatsapp size={14} /> },
    { label: "Email", icon: <Mail size={14} /> },
    { label: "Phone Number", icon: <Phone size={14} /> },
    { label: "First Name", icon: <User size={14} /> },
    { label: "Last Name", icon: <User size={14} /> },
    { label: "Full Name", icon: <Users size={14} /> },
    { label: "Support Ticket", icon: <LifeBuoy size={14} /> },
    { label: "Instagram Handle", icon: <Instagram size={14} /> },
    { label: "Messenger Username", icon: <MessageCircle size={14} /> },
    { label: "Telegram Username", icon: <FaTelegramPlane size={14} /> },
    { label: "Contact ID", icon: <Hash size={14} /> }
  ];

  // Display-only translation for the raw English labels used internally as
  // both React state values and searchTypeMap keys — translating the value
  // itself would break that lookup, so we translate only at render time.
  const searchLabelKeys: Record<string, string> = {
    "WhatsApp Number": "app_sidebar.search_whatsapp_number",
    "Email": "app_sidebar.search_email",
    "Phone Number": "app_sidebar.search_phone_number",
    "First Name": "app_sidebar.search_first_name",
    "Last Name": "app_sidebar.search_last_name",
    "Full Name": "app_sidebar.search_full_name",
    "Support Ticket": "app_sidebar.search_support_ticket",
    "Instagram Handle": "app_sidebar.search_instagram_handle",
    "Messenger Username": "app_sidebar.search_messenger_username",
    "Telegram Username": "app_sidebar.search_telegram_username",
    "Contact ID": "app_sidebar.search_contact_id",
  };
  const tSearchLabel = (label: string) => t(searchLabelKeys[label] ?? label);

  const workspaceOptions = accessibleWorkspaces.map((w) => ({
    id: w.sub_domain || w.slug,
    name: w.name,
  }));

  const statusOptions = [
    { id: "available", name: t("app_sidebar.available"), icon: <div className="w-3 h-3 bg-green-500 rounded-full" /> },
    { id: "unavailable", name: t("app_sidebar.unavailable"), icon: <Circle size={12} className="text-gray-400" /> },
  ];

  const themeOptions = [
    { id: "light", name: t("app_sidebar.light"), icon: <Sun size={14} /> },
    { id: "dark", name: t("app_sidebar.dark"), icon: <Moon size={14} /> },
  ];

  const isActive = (path: string) => {
    if (path === "/insights") return location === "/" || location === "/insights" || location === "/workspace";
    return location.startsWith(path);
  };

  const hoverClass = "hover:bg-primary hover:text-white data-[highlighted]:bg-primary data-[highlighted]:text-white transition-all duration-200";
  const activeClass = "bg-primary text-white shadow-md scale-[1.02]";

  const subTriggerClass =
    "hover:bg-primary hover:text-white " +
    "data-[highlighted]:bg-primary data-[highlighted]:text-white " +
    "data-[state=open]:bg-primary data-[state=open]:text-white transition-all duration-200";

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Map frontend label → backend type key
  const searchTypeMap: Record<string, string> = {
    "WhatsApp Number": "whatsapp",
    "Email": "email",
    "Phone Number": "phone",
    "First Name": "first_name",
    "Last Name": "last_name",
    "Full Name": "full_name",
    "Instagram Handle": "instagram",
    "Messenger Username": "messenger",
    "Telegram Username": "telegram",
    "Contact ID": "id",
    "Support Ticket": "support_ticket",
  };

  const { data: searchResp } = useQuery<any>({
    queryKey: ["/api/contacts/search/simple", searchValue, searchType],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/contacts/search/simple", {
        search: searchValue,
        type: searchTypeMap[searchType] ?? "full_name",
      });
      return res.json();
    },
    enabled: searchValue.trim().length >= 2,
    staleTime: 5000,
  });
  const searchResults: any[] = searchResp?.contacts || [];

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Menu items for search filtering
  // Per-item permission gating (replyagent: each nav link has a `v-canany`).
  // An item with `permissions` is hidden unless the user has one of them; items
  // without `permissions` are always shown (gated in their own chunks later).
  const allMenuItems: Array<{ label: string; labelKey: string; href: string; icon: any; permissions?: string[]; hidden?: boolean }> = [
    { label: "Insights", labelKey: "app_sidebar.nav_insights", href: "/insights", icon: BarChart2 },
    { label: "Smart Flows", labelKey: "app_sidebar.nav_smart_flows", href: "/automations", icon: GitMerge },
    { label: "Campaign", labelKey: "app_sidebar.nav_campaign", href: "/campaigns", icon: Send, permissions: ["workspace.broadcast.view"] },
    { label: "Contacts", labelKey: "app_sidebar.nav_contacts", href: "/contacts", icon: Users, permissions: ["workspace.company.view"] },
    { label: "Inbox", labelKey: "app_sidebar.nav_inbox", href: "/conversations/inbox", icon: Mail, permissions: ["workspace.inbox.access"] },
    { label: "Conversation Logs", labelKey: "app_sidebar.nav_conversation_logs", href: "/conversations/conversation-logs", icon: FileText, hidden: true },
    { label: "Call Logs", labelKey: "app_sidebar.nav_call_logs", href: "/conversations/call-logs", icon: Phone, hidden: true },
    { label: "Settings", labelKey: "app_sidebar.nav_settings", href: "/settings", icon: Settings },
  ];

  // Hide nav items the current user lacks permission for (replyagent v-canany parity).
  const userPerms = (getUserInfo().permissions as string[] | undefined) ?? [];
  const menuItems = allMenuItems.filter((item) => !item.hidden && hasAnyPerm(userPerms, item.permissions ?? []));

  return (
    <>
    <header className={cn(
      // Replyagent-parity floating header — inset from every edge so the
      // header reads as its own rounded card separated from the content
      // panel below. Custom drop-shadow tokens push more weight below the
      // card than Tailwind's stock shadow-lg, so the "floating above the
      // content" cue reads clearly the way it does on replyagent's
      // dashboard.
      "fixed top-3 left-3 right-3 z-50 h-16 transition-all duration-300 border rounded-2xl no-focus-outline",
      theme === "dark"
        ? "bg-[#0f172a] border-slate-800 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)]"
        : "bg-white border-slate-200/70 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)]"
    )}>
      <div className="flex items-center justify-between h-full px-5">
        {/* Left: Logo + EZCONN + Menu + Search */}
        <div className="flex items-center gap-6">
          {/* Logo — white-label aware. When a custom logo is uploaded it fully
              replaces the default agentawk mark (icon + wordmark) — a
              white-labeled workspace shows the client's own brand, not ours.
              The default BotMark + "agentawk" wordmark is the fallback when
              no branding logo has been set. */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              {isBrandingLoading ? (
                // Invisible placeholder during initial fetch — prevents the logo flash
                // before the actual branded logo arrives.
                <div className="w-9 h-9 shrink-0" aria-hidden="true" />
              ) : headerLogoUrl ? (
                <img
                  src={headerLogoUrl}
                  alt="Workspace logo"
                  className="h-9 w-auto max-w-[180px] object-contain shrink-0 transition-transform duration-300"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <>
                  <BotMark className="w-9 h-9 shrink-0 transition-transform duration-300" />
                  <div className="overflow-hidden hidden md:flex items-center cursor-pointer">
                    <p className={cn("font-black text-xl tracking-tighter uppercase transition-colors duration-300", theme === "dark" ? "text-white" : "text-slate-900")}>
                      agen<span className="text-[#25d366]">tawk</span>
                    </p>
                  </div>
                </>
              )}
            </div>
          </Link>

          {/* Menu with Premium Styling */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-300 group shadow-sm",
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  : "bg-primary/5 border-primary/10 text-slate-700 hover:bg-white hover:shadow-md hover:scale-[1.02] hover:text-primary"
              )}>
                {/* Nine-dot waffle icon — matches replyagent's app-launcher
                    style menu. Rendered inline so we get exactly the 3×3
                    filled-circle pattern rather than lucide's 2×2 grid. */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="text-slate-900 dark:text-white"
                  aria-hidden="true"
                >
                  <circle cx="4" cy="4" r="1.5" />
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="16" cy="4" r="1.5" />
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                  <circle cx="4" cy="16" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                  <circle cx="16" cy="16" r="1.5" />
                </svg>
                <span className="hidden md:block text-[14px] font-bold tracking-tight">{t("app_sidebar.menu")}</span>
                <ChevronDown size={14} className="text-gray-400 group-hover:rotate-180 transition-transform duration-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="start"
              sideOffset={8}
              className={cn(
                "w-60 p-1.5 transition-all duration-200 border rounded-2xl shadow-2xl no-focus-outline",
                theme === "dark" ? "bg-[#1e293b] border-slate-700 text-slate-300" : "bg-white border-slate-100 text-slate-600"
              )}
            >
              <DropdownMenuLabel className="px-3 py-2 text-[11px] font-bold text-gray-500">{t("app_sidebar.navigation")}</DropdownMenuLabel>
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.label} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 text-[13px]",
                        isActive(item.href)
                          ? (theme === "dark" ? "bg-primary/10 text-white font-bold" : "bg-primary/10 text-primary font-bold")
                          : theme === "dark" ? "hover:bg-slate-800 hover:text-white" : "hover:bg-slate-50 hover:text-primary"
                      )}
                    >
                      <item.icon size={15} className={isActive(item.href) ? (theme === "dark" ? "text-white" : "text-primary") : "text-gray-400"} />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search Section Premium Styling */}
          <div className="relative flex items-center h-10">
            <button
              onClick={() => setIsSearchOpen(true)}
              className={cn(
                "p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-center",
                isSearchOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100",
                theme === "dark"
                  ? "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white"
                  : "bg-primary/5 border-primary/10 text-slate-500 hover:bg-white hover:shadow-md hover:scale-[1.05] hover:text-primary"
              )}
            >
              <Search size={16} />
            </button>

            {/* Premium Expanding Search Bar */}
            <div
              className={cn(
                "absolute left-0 z-20 flex items-center h-11 border transition-all duration-500 ease-in-out shadow-xl rounded-xl px-3",
                theme === "dark" ? "bg-[#1e293b] border-slate-700 shadow-black/40" : "bg-white border-primary/20 shadow-primary/10",
                isSearchOpen ? "w-[500px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none overflow-hidden"
              )}
            >
              <Search size={16} className="text-primary mr-3 shrink-0" />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors",
                    theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50"
                  )}>
                    {tSearchLabel(searchType)}
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={cn(
                  "p-1 border shadow-2xl rounded-xl z-[60]",
                  theme === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-100"
                )}>
                  {searchOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.label}
                      onClick={() => setSearchType(option.label)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        searchType === option.label
                          ? "bg-primary text-primary-foreground font-bold"
                          : theme === "dark" ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className="shrink-0">{option.icon}</div>
                      <span className="text-xs">{tSearchLabel(option.label)}</span>
                      {searchType === option.label && <Check size={14} className="ml-auto text-primary-foreground" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-3 shrink-0" />

              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => { setSearchValue(e.target.value); setShowSearchResults(true); }}
                onFocus={() => setShowSearchResults(true)}
                placeholder={t("app_sidebar.search_anything_placeholder")}
                className="flex-1 bg-transparent text-sm font-medium outline-none border-none shadow-none focus:ring-0 placeholder-gray-400"
              />

              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchValue("");
                  setShowSearchResults(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-400 hover:text-red-500 transition-all shrink-0 ml-2"
              >
                ✕
              </button>

              {/* Search results dropdown */}
              {showSearchResults && searchValue.trim().length >= 2 && (
                <div className={cn(
                  "absolute left-0 top-full mt-1 w-full border rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto",
                  theme === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-200"
                )}>
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">{t("app_sidebar.no_contacts_found")}</div>
                  ) : (
                    searchResults.map((c: any) => (
                      <button
                        key={c.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          theme === "dark" ? "hover:bg-slate-800" : "hover:bg-slate-50"
                        )}
                        onClick={() => {
                          setProfileContact({ id: c.id, name: c.full_name });
                          setShowProfileModal(true);
                          setSearchValue("");
                          setShowSearchResults(false);
                          setIsSearchOpen(false);
                        }}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                          "bg-primary"
                        )}>
                          {(c.full_name?.[0] || "?").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{c.full_name}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-5">
          {/* Notifications Premium Button */}
          <DropdownMenu open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open) refetchNotifs(); }}>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "relative p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center group",
                theme === "dark"
                  ? "text-gray-400 hover:text-white hover:bg-slate-800"
                  : "text-gray-500 hover:text-slate-900 hover:bg-slate-100"
              )}>
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-[#0f172a] leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className={cn(
              "w-80 p-0 border rounded-2xl shadow-2xl overflow-hidden",
              theme === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-100"
            )}>
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                <h3 className="font-bold text-sm">{t("app_sidebar.notifications")}</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">{t("app_sidebar.unread_count", { count: unreadCount })}</span>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto p-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[12px] text-gray-500 font-medium">{t("app_sidebar.all_caught_up")}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{t("app_sidebar.no_new_notifications")}</p>
                  </div>
                ) : (
                  notifications.map((n: any) => {
                    const { Icon, color } = getNotifIcon(n.slug);
                    const slugLabels: Record<string, string> = {
                      'inbox.message_received': t("app_sidebar.notif_new_message"),
                      'conversation_assigned': t("app_sidebar.notif_conversation_assigned"),
                      'task_assigned': t("app_sidebar.notif_task_assigned"),
                      'chat_note_mention': t("app_sidebar.notif_mentioned_in_note"),
                    };
                    const notifTitle =
                      n.data?.title ||
                      (n.data?.contact_name ? t("app_sidebar.notif_new_message_from", { name: n.data.contact_name }) : null) ||
                      n.data?.message ||
                      slugLabels[n.slug] ||
                      t("app_sidebar.notif_new_notification");
                    return (
                      <DropdownMenuItem
                        key={n.id}
                        className={cn(
                          "p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer mb-1 outline-none",
                          !n.read && "bg-primary/5 dark:bg-primary/10"
                        )}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="flex gap-3 w-full">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700 shrink-0", color)}>
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                              {notifTitle}
                            </p>
                            {n.data?.message && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.data.message}</p>
                            )}
                            <p className="text-[11px] text-gray-500 mt-0.5">{formatRelativeTime(n.created_at)}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
              </div>
              <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    setLocation("/notifications");
                  }}
                  className="w-full py-2 text-[12px] font-bold text-primary hover:bg-primary/10 dark:hover:bg-primary/10 rounded-xl transition-colors"
                >
                  {t("app_sidebar.view_all_notifications")}
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Premium Styling */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-pointer transition-all outline-none group border border-transparent",
                theme === "dark"
                  ? "hover:bg-slate-800/50 hover:border-slate-700"
                  : "hover:bg-slate-100 hover:border-slate-200"
              )}>
                <Avatar className="w-9 h-9 border-2 border-white dark:border-slate-800">
                  {meData?.avatar_url && <AvatarImage src={meData.avatar_url} alt="Profile" />}
                  <AvatarFallback className="text-[12px] font-bold bg-primary text-primary-foreground">
                    {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                  </AvatarFallback>
                </Avatar>

                <div className="text-left hidden sm:block">
                  <p className={cn("text-[13px] font-bold leading-none truncate max-w-[100px]", theme === "dark" ? "text-white" : "text-slate-900")}>
                    {user ? `${user.first_name} ${user.last_name || ""}` : t("app_sidebar.profile")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={cn("w-2 h-2 rounded-full", status === "available" ? "bg-green-500 animate-pulse" : "bg-slate-400")} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                      {status === "available" ? t("app_sidebar.online") : t("app_sidebar.away")}
                    </span>
                  </div>
                </div>

                <ChevronDown size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={12} className={cn(
              "w-64 p-2 border shadow-2xl no-focus-outline overflow-visible",
              theme === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-100"
            )}>
              {/* Profile Link */}
              <DropdownMenuItem
                onClick={() => setLocation("/settings?tab=My%20Profile")}
                className={cn(
                  "flex items-center justify-between p-3 rounded-md cursor-pointer group outline-none",
                  theme === "dark" ? "hover:bg-[#334155] focus:bg-[#334155] focus:text-white" : "hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    {meData?.avatar_url && <AvatarImage src={meData.avatar_url} alt="Profile" />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("font-semibold text-[14px]", theme === "dark" ? "text-white" : "text-slate-900")}>{t("app_sidebar.profile")}</span>
                </div>
                <ChevronRight size={16} className="text-gray-500 group-hover:text-primary transition-colors" />
              </DropdownMenuItem>

              <DropdownMenuSeparator className={theme === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

              {/* Selectors Group */}
              <div className="space-y-1">
                <div className="px-1">
                  <div className="space-y-3 p-2">
                    {/* Status Dropdown */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("app_sidebar.online_status")}</p>
                      <CustomDropdown
                        options={statusOptions}
                        selected={[status]}
                        onChange={(val) => setStatus(val[0] as "available" | "unavailable")}
                        placeholder={t("app_sidebar.online_status")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                      />
                    </div>

                    {/* Theme Dropdown */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("app_sidebar.theme")}</p>
                      <CustomDropdown
                        options={themeOptions}
                        selected={[theme]}
                        onChange={(val) => setTheme(val[0] as "light" | "dark")}
                        placeholder={t("app_sidebar.theme")}
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                      />
                    </div>

                    {/* Language Dropdown */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("app_sidebar.language")}</p>
                      <div
                        onClick={(e) => { e.stopPropagation(); setOpenLang(!openLang); }}
                        className={cn(
                          "border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                          theme === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://flagcdn.com/w20/${SUPPORTED_LANGUAGES.find((l) => l.code === language[0])?.flag ?? "us"}.png`}
                            width="18"
                            alt=""
                            className="rounded-sm"
                          />
                          <span className={cn("text-sm font-medium", theme === "dark" ? "text-white" : "text-slate-900")}>
                            {SUPPORTED_LANGUAGES.find((l) => l.code === language[0])?.label ?? language[0]}
                          </span>
                        </div>
                        <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openLang ? "rotate-180" : "")} />
                      </div>
                      {openLang && (
                        <div className={cn(
                          "mt-1 border rounded overflow-hidden shadow-sm max-h-64 overflow-y-auto",
                          theme === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100"
                        )}>
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <div
                              key={l.code}
                              onClick={() => { i18n.changeLanguage(l.code); setLanguage([l.code]); setOpenLang(false); }}
                              className={cn(
                                "flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                                theme === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50"
                              )}
                            >
                              <img src={`https://flagcdn.com/w20/${l.flag}.png`} width="18" alt="" className="rounded-sm" />
                              <span className={theme === "dark" ? "text-white" : "text-slate-700"}>{l.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className={theme === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

              {/* Sign Out */}
              <DropdownMenuItem
                onClick={() => {
                  localStorage.removeItem("auth_token");
                  localStorage.removeItem("user_info");
                  window.location.href = "/login";
                }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-md cursor-pointer text-slate-300 hover:text-red-400 group transition-colors outline-none",
                  theme === "dark" ? "hover:bg-red-500/10 focus:bg-red-500/10" : "hover:bg-red-50 focus:bg-red-50 focus:text-red-600"
                )}
              >
                <LogOut size={18} className="group-hover:text-red-400" />
                <span className={cn("font-semibold text-[14px]", theme === "dark" ? "" : "text-slate-600")}>{t("app_sidebar.sign_out")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    <ContactProfileModal
      open={showProfileModal}
      onOpenChange={setShowProfileModal}
      contact={profileContact}
    />
    </>
  );
}