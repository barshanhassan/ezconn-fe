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
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useWorkspaceTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { SiWhatsapp } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import CustomDropdown from "@/components/CustomDropdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
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

  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState<string[]>(["en-us"]);
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
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
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
    { label: "Contact ID", icon: <Hash size={14} /> }
  ];

  const workspaceOptions = accessibleWorkspaces.map((w) => ({
    id: w.sub_domain || w.slug,
    name: w.name,
  }));

  const statusOptions = [
    { id: "available", name: "Available", icon: <div className="w-3 h-3 bg-green-500 rounded-full" /> },
    { id: "unavailable", name: "Unavailable", icon: <Circle size={12} className="text-gray-400" /> },
  ];

  const themeOptions = [
    { id: "light", name: "Light", icon: <Sun size={14} /> },
    { id: "dark", name: "Dark", icon: <Moon size={14} /> },
  ];

  const languageOptions = [
    {
      id: "en-us",
      name: "English (U.S)",
      icon: (
        <img
          src="https://flagcdn.com/w40/us.png"
          alt="US Flag"
          className="w-4 h-4 object-cover rounded-sm"
        />
      ),
    },
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
  const allMenuItems: Array<{ label: string; href: string; icon: any; permissions?: string[]; hidden?: boolean }> = [
    { label: "Insights", href: "/insights", icon: BarChart2 },
    { label: "Smart Flows", href: "/automations", icon: GitMerge },
    { label: "Campaign", href: "/campaigns", icon: Send, permissions: ["workspace.broadcast.view"] },
    { label: "Contacts", href: "/contacts", icon: Users, permissions: ["workspace.company.view"] },
    { label: "Inbox", href: "/conversations/inbox", icon: Mail, permissions: ["workspace.inbox.access"] },
    { label: "Conversation Logs", href: "/conversations/conversation-logs", icon: FileText, hidden: true },
    { label: "Call Logs", href: "/conversations/call-logs", icon: Phone, hidden: true },
    { label: "Settings", href: "/settings", icon: Settings },
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
          {/* Logo — white-label aware. The uploaded logo only replaces the "EC" badge and is
              tinted to the white-label primary color. The "EZCONN" wordmark always stays. */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              {isBrandingLoading ? (
                // Invisible placeholder during initial fetch — prevents the EC-badge flash
                // before the actual branded logo arrives.
                <div className="w-9 h-9 shrink-0" aria-hidden="true" />
              ) : headerLogoUrl ? (
                <img
                  src={headerLogoUrl}
                  alt="Workspace logo"
                  className="w-9 h-9 object-contain shrink-0 transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <BotMark className="w-9 h-9 shrink-0 transition-transform duration-300 group-hover:scale-110" />
              )}
              <span className={cn(
                "font-black text-xl tracking-tighter uppercase hidden md:block transition-colors duration-300",
                theme === "dark" ? "text-white" : "text-slate-900"
              )}>
                agen<span className="text-[#25d366]">tawk</span>
              </span>
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
                <span className="hidden md:block text-[14px] font-bold tracking-tight">Menu</span>
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
              <DropdownMenuLabel className="px-3 py-2 text-[11px] font-bold text-gray-500">Navigation</DropdownMenuLabel>
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
                      <span>{item.label}</span>
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
                    {searchType}
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
                      <span className="text-xs">{option.label}</span>
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
                placeholder="Search anything..."
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
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No contacts found</div>
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
                <h3 className="font-bold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto p-1">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[12px] text-gray-500 font-medium">You're all caught up</p>
                    <p className="text-[10px] text-gray-400 mt-1">No new notifications</p>
                  </div>
                ) : (
                  notifications.map((n: any) => {
                    const { Icon, color } = getNotifIcon(n.slug);
                    const slugLabels: Record<string, string> = {
                      'inbox.message_received': 'New Message',
                      'conversation_assigned': 'Conversation Assigned',
                      'task_assigned': 'Task Assigned',
                      'chat_note_mention': 'Mentioned in Note',
                    };
                    const notifTitle =
                      n.data?.title ||
                      (n.data?.contact_name ? `New message from ${n.data.contact_name}` : null) ||
                      n.data?.message ||
                      slugLabels[n.slug] ||
                      'New Notification';
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
                  View all notifications
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
                  <AvatarFallback className="text-[12px] font-bold bg-primary text-primary-foreground">
                    {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                  </AvatarFallback>
                </Avatar>

                <div className="text-left hidden sm:block">
                  <p className={cn("text-[13px] font-bold leading-none truncate max-w-[100px]", theme === "dark" ? "text-white" : "text-slate-900")}>
                    {user ? `${user.first_name} ${user.last_name || ""}` : "Profile"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={cn("w-2 h-2 rounded-full", status === "available" ? "bg-green-500 animate-pulse" : "bg-slate-400")} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                      {status === "available" ? "Online" : "Away"}
                    </span>
                  </div>
                </div>

                <ChevronDown size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={12} className={cn(
              "w-72 p-2 border rounded-2xl shadow-2xl no-focus-outline overflow-hidden",
              theme === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-100"
            )}>
              {/* Header */}
              <div 
                className="p-4 mb-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-4 cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 dark:hover:border-primary/20"
                onClick={() => setLocation("/settings?tab=My%20Profile")}
              >
                <Avatar className="w-10 h-10 ring-2 ring-white shadow-md">
                  <AvatarFallback className={cn("text-xs font-black text-white", "bg-primary")}>
                    {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="font-bold text-sm truncate">{user ? `${user.first_name} ${user.last_name || ""}` : "Loading..."}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email || "admin@example.com"}</p>
                </div>
              </div>

              {/* Selectors Group */}
              <div className="space-y-1">
                <div className="px-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase px-3 py-1 tracking-widest">Preferences</p>
                  
                  <div className="space-y-3 p-2">
                    {/* Status Dropdown */}
                    <div>
                      <CustomDropdown
                        options={statusOptions}
                        selected={[status]}
                        onChange={(val) => setStatus(val[0] as "available" | "unavailable")}
                        placeholder="Status"
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                      />
                    </div>

                    {/* Theme Dropdown */}
                    <div>
                      <CustomDropdown
                        options={themeOptions}
                        selected={[theme]}
                        onChange={(val) => setTheme(val[0] as "light" | "dark")}
                        placeholder="Theme"
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                      />
                    </div>

                    {/* Language Dropdown */}
                    <div>
                      <CustomDropdown
                        options={languageOptions}
                        selected={language}
                        onChange={(val) => setLanguage(val)}
                        placeholder="Language"
                        width="100%"
                        showSelectedOption={true}
                        showSearch={false}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("user_info");
                    window.location.href = "/login";
                  }}
                  className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl px-3 py-2.5 text-sm font-bold transition-all"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
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