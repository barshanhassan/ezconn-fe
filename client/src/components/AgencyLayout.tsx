import React from 'react';
import AgencySidebar from './AgencySidebar';
import AgencyBrandingFetcher from './AgencyBrandingFetcher';
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  ChevronRight,
  Circle,
  Mail,
  Send,
  Check,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BellOff } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { formatInWorkspaceTz, useAgencyTimezone } from "@/contexts/WorkspaceTimezoneContext";
import { useLocation } from "wouter";
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";

const AgencyLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, i18n } = useTranslation();
  const [user, setUser] = React.useState<any>(null);
  const [status, setStatus] = React.useState("Available");
  const [language, setLanguage] = React.useState("English (U.S)");
  const [openStatus, setOpenStatus] = React.useState(false);
  const [openTheme, setOpenTheme] = React.useState(false);
  const [openLang, setOpenLang] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const workspaceTz = useAgencyTimezone();
  const queryClient = useQueryClient();
  const { data: notifResp, refetch: refetchNotifs } = useQuery<any>({
    queryKey: ["/api/notifications", { limit: 2 }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications?limit=2");
      return res.json();
    },
    refetchInterval: 15 * 1000,
  });
  const notifications: any[] = notifResp?.notifications || [];
  const unreadCount: number = notifResp?.unread || 0;

  // Warm the Billing page's data as soon as the agency panel mounts (once per
  // session — this component stays mounted across every agency route, it
  // never remounts on navigation) so Billing shows instantly instead of a
  // loading skeleton whenever the user actually clicks into it. Same
  // queryKey/queryFn shape as AgencyBillingPlans.tsx so the cache hit lines
  // up exactly — combined with the app's global staleTime: Infinity, this
  // fires once and is never refetched until a full page reload.
  React.useEffect(() => {
    const agencyId = getUserInfo()?.modelable_id;
    if (!agencyId) return;
    queryClient.prefetchQuery({
      queryKey: ["/api/organizations/billing-plans"],
      queryFn: async () => {
        const res = await apiRequest("GET", "/api/organizations/billing-plans");
        return res.json();
      },
    });
    queryClient.prefetchQuery({
      queryKey: [`/api/organizations/${agencyId}/current-plan`],
      queryFn: async () => {
        const res = await apiRequest("GET", `/api/organizations/${agencyId}/current-plan`);
        return res.json();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const getNotifIcon = (slug?: string): { Icon: any; color: string } => {
    const s = (slug || "").toLowerCase();
    if (s.includes("message") || s.includes("mail")) return { Icon: Mail, color: "text-blue-500" };
    if (s.includes("campaign") || s.includes("send")) return { Icon: Send, color: "text-green-500" };
    if (s.includes("approved") || s.includes("complete")) return { Icon: Check, color: "text-emerald-500" };
    if (s.includes("chat") || s.includes("conversation")) return { Icon: MessageSquare, color: "text-purple-500" };
    return { Icon: Bell, color: "text-slate-500" };
  };

  const { mode, setMode } = useTheme();
  const [location, setLocation] = useLocation();

  const handleNotifClick = async (n: any) => {
    if (!n.read) {
      try {
        await apiRequest("POST", `/api/notifications/${n.id}/read`, {});
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      } catch {}
    }
    setNotifOpen(false);
    setLocation("/org/notifications");
  };
  const mainRef = React.useRef<HTMLElement>(null);

  // Reset scroll to the top whenever the route changes — the layout doesn't
  // remount between modules, so the <main> scroll position would otherwise carry
  // over and a new page could open scrolled half-way down.
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location]);

  // Sync initial language state with i18n
  React.useEffect(() => {
    const currentLng = i18n.language;
    if (currentLng.startsWith('pt')) setLanguage("Português do Brasil");
    else if (currentLng.startsWith('es')) setLanguage("Español");
    else setLanguage("English (U.S)");
  }, [i18n.language]);

  React.useEffect(() => {
    const userInfo = localStorage.getItem("user_info");
    if (userInfo) {
      setUser(JSON.parse(userInfo));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setLocation("/login");
  };

  return (
    <div className={cn("flex flex-col md:flex-row h-auto md:h-[calc(100vh-1.5rem)] overflow-y-auto md:overflow-hidden gap-3 p-3 transition-colors duration-300", mode === "dark" ? "bg-[#0b1120]" : "bg-slate-50/80")}>
      <AgencyBrandingFetcher />
      {/* Sidebar */}
      <AgencySidebar />

      {/* Main Content Area — floating rounded card, matching the sidebar's
          treatment so both read as separate panels over the page background. */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 rounded-2xl border overflow-hidden shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)]",
        mode === "dark" ? "border-slate-800" : "border-slate-200/70"
      )}>
        {/* Top Header */}
        <header className={cn("h-14 flex items-center justify-end px-6 border-b transition-colors duration-300 shrink-0",
          mode === "dark" ? "bg-[#0f172a] border-slate-800" : "bg-white border-slate-200")}>
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <DropdownMenu open={notifOpen} onOpenChange={(open) => { setNotifOpen(open); if (open) refetchNotifs(); }}>
              <DropdownMenuTrigger asChild>
                <button className={cn("relative p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center group",
                  mode === "dark" ? "text-gray-400 hover:text-white hover:bg-slate-800" : "text-gray-500 hover:text-slate-900 hover:bg-slate-100")}>
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
                mode === "dark" ? "bg-[#1e293b] border-slate-700" : "bg-white border-slate-100"
              )}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm">{t("Notifications")}</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto p-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <BellOff size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-[12px] text-gray-500 font-medium">You're all caught up</p>
                      <p className="text-[10px] text-gray-400 mt-1">No new notifications</p>
                    </div>
                  ) : (
                    notifications.map((n: any) => {
                      const { Icon, color } = getNotifIcon(n.slug);
                      const notifTitle =
                        n.data?.title ||
                        (n.data?.contact_name ? `New message from ${n.data.contact_name}` : null) ||
                        n.data?.message ||
                        "New Notification";
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
                              <p className="text-sm font-semibold truncate">{notifTitle}</p>
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
                    onClick={() => { setNotifOpen(false); setLocation("/org/notifications"); }}
                    className="w-full py-2 text-[12px] font-bold text-primary hover:bg-primary/10 dark:hover:bg-primary/10 rounded-xl transition-colors"
                  >
                    View all notifications
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Dropdown */}
            <DropdownMenu onOpenChange={(open) => {
              if (!open) {
                setOpenStatus(false);
                setOpenTheme(false);
                setOpenLang(false);
              }
            }}>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all outline-none group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="relative">
                    <Avatar className={cn("w-9 h-9 border-2 border-white dark:border-slate-800 shadow-sm", mode === "dark" ? "" : "")}>
                      <AvatarFallback className="text-[12px] font-bold bg-primary text-primary-foreground">
                        {(user?.first_name?.[0] || "") + (user?.last_name?.[0] || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="text-left hidden sm:block leading-tight">
                    <p className={cn("text-[13px] font-bold transition-colors",
                      mode === "dark" ? "text-white" : "text-slate-900")}>
                      {user ? `${user.first_name} ${user.last_name || ""}` : "Loading..."}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full", status === "Available" ? "bg-green-500" : "bg-slate-400")}></div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{t(status)}</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-gray-500 group-hover:text-blue-500 transition-colors ml-1" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={cn("w-64 border-slate-700 p-2 shadow-2xl transition-colors duration-200", 
                mode === "dark" ? "bg-[#1e293b] text-slate-300" : "bg-white text-slate-600 border-slate-200")} align="end">
                {/* Profile Link */}
                <DropdownMenuItem className={cn("flex items-center justify-between p-3 rounded-md cursor-pointer group outline-none",
                  mode === "dark" ? "hover:bg-[#334155] focus:bg-[#334155] focus:text-white" : "hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900")}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                       {(user?.first_name?.[0] || "H") + (user?.last_name?.[0] || "B")}
                    </div>
                    <span className={cn("font-semibold text-[14px]", mode === "dark" ? "text-white" : "text-slate-900")}>{t("Profile")}</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </DropdownMenuItem>

                {/* Change Password */}
                <DropdownMenuItem
                  onClick={() => setLocation("/org/settings/change-password")}
                  className={cn("flex items-center gap-3 p-3 rounded-md cursor-pointer group outline-none",
                    mode === "dark" ? "hover:bg-[#334155] focus:bg-[#334155] focus:text-white" : "hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900")}
                >
                  <Lock size={16} className="text-gray-500 group-hover:text-primary transition-colors" />
                  <span className={cn("font-semibold text-[14px]", mode === "dark" ? "text-white" : "text-slate-900")}>{t("Change Password")}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className={mode === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

                {/* Online Status Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Online Status")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenStatus(!openStatus); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", 
                          status === "Available" ? (mode === "dark" ? "bg-white" : "bg-green-500") : (mode === "dark" ? "border-2 border-white" : "border-2 border-slate-400"))}></div>
                        <span className={cn("text-sm font-medium", mode === "dark" ? "text-white" : "text-slate-900")}>{t(status)}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openStatus ? "rotate-180" : "")} />
                  </div>
                  {openStatus && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { setStatus("Available"); setOpenStatus(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <div className={mode === "dark" ? "w-2.5 h-2.5 bg-white rounded-full" : "w-2.5 h-2.5 bg-green-500 rounded-full"}></div>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Available")}</span>
                      </div>
                      <div 
                        onClick={() => { setStatus("Unavailable"); setOpenStatus(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Circle size={10} className={mode === "dark" ? "text-white" : "text-slate-400"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Busy")}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Theme Switcher Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Theme")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenTheme(!openTheme); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        {mode === "dark" ? <Moon size={16} className="text-white" /> : <Sun size={16} className="text-slate-900" />}
                        <span className={cn("text-sm font-medium capitalize", mode === "dark" ? "text-white" : "text-slate-900")}>{t(mode)}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openTheme ? "rotate-180" : "")} />
                  </div>
                  {openTheme && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { setMode("light"); setOpenTheme(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Sun size={16} className={mode === "dark" ? "text-white" : "text-slate-600"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Light")}</span>
                      </div>
                      <div 
                        onClick={() => { setMode("dark"); setOpenTheme(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <Moon size={16} className={mode === "dark" ? "text-white" : "text-slate-600"} />
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>{t("Dark")}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Language Section */}
                <div className="px-2 py-1">
                  <p className="text-[11px] font-bold text-gray-500 uppercase mb-2 px-1">{t("Language")}</p>
                  <div 
                    onClick={(e) => { e.stopPropagation(); setOpenLang(!openLang); }}
                    className={cn("border rounded p-2 flex items-center justify-between cursor-pointer transition-colors group",
                      mode === "dark" ? "bg-[#0f172a]/50 border-slate-700 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
                  >
                     <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {language === "English (U.S)" ? "🇺🇸" : language === "Português do Brasil" ? "🇧🇷" : "🇪🇸"}
                        </span>
                        <span className={cn("text-sm font-medium", mode === "dark" ? "text-white" : "text-slate-900")}>{language}</span>
                     </div>
                     <ChevronDown size={14} className={cn("text-gray-500 transition-transform", openLang ? "rotate-180" : "")} />
                  </div>
                  {openLang && (
                    <div className={cn("mt-1 border rounded overflow-hidden shadow-sm", 
                      mode === "dark" ? "bg-[#0f172a]/30 border-slate-800" : "bg-white border-slate-100")}>
                      <div 
                        onClick={() => { i18n.changeLanguage('en'); setLanguage("English (U.S)"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇺🇸</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>English (U.S)</span>
                      </div>
                      <div 
                        onClick={() => { i18n.changeLanguage('pt'); setLanguage("Português do Brasil"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇧🇷</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>Português do Brasil</span>
                      </div>
                      <div 
                        onClick={() => { i18n.changeLanguage('es'); setLanguage("Español"); setOpenLang(false); }}
                        className={cn("flex items-center gap-2 p-2 cursor-pointer text-sm transition-colors",
                          mode === "dark" ? "hover:bg-[#334155]" : "hover:bg-slate-50")}
                      >
                         <span className="text-lg">🇪🇸</span>
                         <span className={mode === "dark" ? "text-white" : "text-slate-700"}>Español</span>
                      </div>
                    </div>
                  )}
                </div>

                <DropdownMenuSeparator className={mode === "dark" ? "bg-slate-700 my-2" : "bg-slate-100 my-2"} />

                {/* Sign Out */}
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className={cn("flex items-center gap-3 p-3 rounded-md cursor-pointer text-slate-300 hover:text-red-400 group transition-colors outline-none",
                    mode === "dark" ? "hover:bg-red-500/10 focus:bg-red-500/10" : "hover:bg-red-50 focus:bg-red-50 focus:text-red-600")}
                >
                  <LogOut size={18} className="group-hover:text-red-400" />
                  <span className={cn("font-semibold text-[14px]", mode === "dark" ? "" : "text-slate-600")}>{t("Sign out")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main ref={mainRef} className={cn("flex-1 overflow-auto transition-colors duration-300",
          mode === "dark" ? "bg-[#0f172a]" : "bg-slate-50")}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AgencyLayout;
