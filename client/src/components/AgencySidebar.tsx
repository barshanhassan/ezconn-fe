import React from 'react';
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Network,
  Users,
  ShieldCheck,
  Cloud,
  Gavel,
  HelpCircle,
  Monitor,
  ChevronDown,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Briefcase,
  Plug,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type SubItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  status?: string;
};

type MenuItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  hasSubmenu?: boolean;
  subItems?: SubItem[];
  // Visible if user has ANY of these slugs. Empty/undefined = always visible.
  permissions?: string[];
  // Kept in the list (not deleted) but never rendered — flip to false/remove to bring back.
  hidden?: boolean;
};

type BottomItem = {
  label: string;
  icon: React.ReactElement;
  href: string;
  hasSubmenu?: boolean;
  subItems?: SubItem[];
  permissions?: string[];
  hidden?: boolean;
};

type MenuGroup = {
  section: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    section: "MAIN MENU",
    items: [
      { label: "Dashboard", icon: <LayoutDashboard size={18} />, href: "/org" },
      { label: "Workspaces", icon: <Network size={18} />, href: "/org/workspaces", permissions: ["agency.workspace.*"] },
      { label: "Users", icon: <Users size={18} />, href: "/org/team", permissions: ["agency.users.*"] },
      { label: "Roles", icon: <ShieldCheck size={18} />, href: "/org/roles", permissions: ["agency.acl.*"] },
    ],
  },
  {
    section: "MANAGEMENT",
    items: [
      {
        label: "Audit Trail",
        icon: <ScrollText size={18} />,
        href: "#",
        hasSubmenu: true,
        permissions: ["agency.*"],
        subItems: [
          { label: "Organization Logs", icon: <Briefcase size={15} />, href: "/org/audit-logs/org" },
          { label: "Workspace Logs", icon: <Network size={15} />, href: "/org/audit-logs/workspace" },
        ],
      },
      {
        label: "Billing",
        icon: <CreditCard size={18} />,
        href: "/org/billing/plans",
        permissions: ["agency.*"],
      },
      {
        label: "Notifications",
        icon: <Bell size={18} />,
        href: "/org/settings/notifications",
        permissions: ["agency.*"],
      },
      {
        label: "SaaS",
        icon: <Cloud size={18} />,
        href: "#",
        hasSubmenu: true,
        permissions: ["agency.*"],
        hidden: true,
        subItems: [
          { label: "Plans", icon: <Briefcase size={15} />, href: "/org/saas/plans", status: "Soon" },
          { label: "API", icon: <Plug size={15} />, href: "/org/saas/api" },
        ],
      },
      { label: "Legal", icon: <Gavel size={18} />, href: "/org/legal", permissions: ["agency.legal.*"], hidden: true },
    ],
  },
];

const bottomItems: BottomItem[] = [
  {
    label: "Settings",
    icon: <Settings size={18} />,
    href: "#",
    hasSubmenu: true,
    permissions: ["agency.settings.*"],
    subItems: [
      { label: "General", icon: <Settings size={15} />, href: "/org/settings/general" },
      { label: "API", icon: <Plug size={15} />, href: "/org/saas/api" },
    ],
  },
  { label: "White Label", icon: <Monitor size={18} />, href: "/org/settings/white-label", permissions: ["agency.*"], hidden: true },
  { label: "Help & Support", icon: <HelpCircle size={18} />, href: "/org/help", permissions: ["agency.*"], hidden: true },
];

// Default (no white-label logo uploaded) mark — same icon used on the auth pages.
const BotMark = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 40 52" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M6 3 H34 A4 4 0 0 1 38 7 V17 A4 4 0 0 1 34 21 H6 A4 4 0 0 1 2 17 V7 A4 4 0 0 1 6 3 Z M11 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M22.6 12 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z" fill="#25d366" />
    <rect x="4" y="25" width="32" height="5.5" rx="2" fill="#25d366" />
    <rect x="16.5" y="30" width="7" height="20" rx="2" fill="#25d366" />
  </svg>
);

const AgencySidebar = () => {
  const [location] = useLocation();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { mode } = useTheme();

  const user = React.useMemo(() => {
    try { return getUserInfo(); } catch { return {}; }
  }, []);
  const userPerms = (user.permissions as string[]) ?? [];

  const visibleMenuItems = React.useMemo(
    () => menuGroups.flatMap((g) => g.items).filter((item) => !item.hidden && hasAnyPerm(userPerms, item.permissions ?? [])),
    [userPerms]
  );
  const visibleBottomItems = React.useMemo(
    () => bottomItems.filter((item) => !item.hidden && hasAnyPerm(userPerms, item.permissions ?? [])),
    [userPerms]
  );

  const isActive = (href: string) => href !== "#" && location === href;
  const isParentActive = (item: MenuItem) => {
    if (isActive(item.href)) return true;
    return item.subItems?.some(s => isActive(s.href)) ?? false;
  };

  const dark = mode === "dark";

  // White-label: agency logo (uploaded via /agency/settings/white-label) overrides
  // the default "EC" + "EZCONN" mark. Falls back when no logo is set.
  const agencyId = user?.modelable_id;
  // localStorage cache → instant logo on revisit. 30-min TTL keeps signed URLs valid.
  const AGENCY_CACHE_KEY = agencyId ? `agency_cache_v1_${agencyId}` : null;
  const AGENCY_CACHE_TTL = 30 * 60 * 1000;
  const cachedAgency = (() => {
    if (!AGENCY_CACHE_KEY) return undefined;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(AGENCY_CACHE_KEY) : null;
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > AGENCY_CACHE_TTL) return undefined;
      return data;
    } catch {
      return undefined;
    }
  })();
  const { data: agencyResp, isLoading: isAgencyLoading } = useQuery<any>({
    queryKey: [`/api/organizations/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}`);
      return res.json();
    },
    enabled: !!agencyId,
    initialData: cachedAgency,
    staleTime: 5 * 60 * 1000,
  });
  React.useEffect(() => {
    if (agencyResp && AGENCY_CACHE_KEY) {
      try {
        localStorage.setItem(AGENCY_CACHE_KEY, JSON.stringify({ data: agencyResp, ts: Date.now() }));
      } catch { /* ignore quota errors */ }
    }
  }, [agencyResp, AGENCY_CACHE_KEY]);
  // Theme-aware logo selection (replyagent parity). Light mode → small light → small dark
  // → wide light → wide dark → null. Dark mode mirrors with dark variants first. The
  // small/square variant is preferred for the 32x32 badge slot.
  const b = agencyResp?.agency?.branding;
  const agencyLogoUrl: string | null = dark
    ? b?.logo_dark_small || b?.logo_light_small || b?.logo_dark || b?.logo_light || null
    : b?.logo_light_small || b?.logo_dark_small || b?.logo_light || b?.logo_dark || null;

  return (
    <div className={cn(
      "relative h-auto md:h-full flex flex-col border rounded-2xl transition-all duration-300 ease-in-out z-50 md:shrink-0 w-full",
      "shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)]",
      isCollapsed ? "md:w-[70px]" : "md:w-[240px]",
      dark ? "bg-[#18181b] border-zinc-800" : "bg-[#fafaf9] border-slate-200"
    )}>

      {/* Collapse toggle — desktop-only; on mobile the sidebar is full-width
          and stacked above the content, so a slim icon-only mode doesn't apply. */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute -right-3 top-16 w-6 h-6 rounded-full border items-center justify-center z-[100] shadow-md transition-all hover:scale-110 hidden md:flex",
          dark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-300 text-slate-500"
        )}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo — white-label aware. Uploaded agency logo wins; otherwise default mark.
          Clicking it returns to the Agency Dashboard, like any standard site logo. */}
      <Link href="/org">
        <div className={cn(
          "flex items-center gap-3 px-4 py-5 border-b shrink-0",
          dark ? "border-slate-800" : "border-slate-100"
        )}>
          {isAgencyLoading ? (
            // Invisible placeholder during initial fetch — prevents the EC-badge flash
            // before the actual branded logo arrives.
            <div className="w-8 h-8 shrink-0" aria-hidden="true" />
          ) : agencyLogoUrl ? (
            // Plain image — replyagent parity. The agency uploads light/dark variants
            // separately so each version renders correctly against its background.
            <img
              src={agencyLogoUrl}
              alt="Organization logo"
              className="w-8 h-8 object-contain shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <BotMark className="w-8 h-8 shrink-0" />
          )}
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className={cn("font-bold text-sm leading-tight truncate", dark ? "text-white" : "text-slate-900")}>
                AGEN<span className="text-[#25d366]">TAWK</span>
              </p>
              <p className="text-[11px] text-slate-400 truncate">Organization Manager</p>
            </div>
          )}
        </div>
      </Link>

      {/* Navigation — capped height with its own scroll on mobile (where the
          sidebar stacks above the page content, full width) so the nav list
          doesn't push all page content off-screen; fills naturally via flex-1
          within the h-screen sidebar at md+ where it sits beside the content. */}
      <nav className="flex-1 flex flex-col max-h-[50vh] md:max-h-none overflow-y-auto overflow-x-hidden py-4 px-2">
        <div className="space-y-2">
        {visibleMenuItems.map((item) => {
          const active = isActive(item.href) || isParentActive(item);
          const open = expanded === item.label;

          return (
            <div key={item.label}>
              <div
                onClick={() => {
                  if (item.hasSubmenu) {
                    if (isCollapsed) setIsCollapsed(false);
                    setExpanded(open ? null : item.label);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group relative",
                  active
                    ? (dark ? "bg-primary/10 text-white" : "bg-primary/10 text-primary")
                    : (dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"),
                  isCollapsed && "justify-center"
                )}
              >
                <span className={cn("shrink-0", active ? (dark ? "text-white" : "text-primary") : "")}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <>
                    {item.hasSubmenu ? (
                      <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    ) : (
                      <Link href={item.href} className="flex-1 text-[13px] font-medium">
                        {item.label}
                      </Link>
                    )}
                    {item.hasSubmenu && (
                      <ChevronDown size={13} className={cn("transition-transform shrink-0", open ? "rotate-180" : "", dark ? "text-slate-500" : "text-slate-400")} />
                    )}
                  </>
                )}

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className={cn(
                    "absolute left-full ml-3 px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[200] shadow-lg",
                    dark ? "bg-slate-800 text-white border border-slate-700" : "bg-slate-900 text-white"
                  )}>
                    {item.label}
                  </div>
                )}
              </div>

              {/* Submenu */}
              {!isCollapsed && item.hasSubmenu && open && item.subItems && (
                <div className="mt-0.5 ml-4 pl-4 space-y-0.5">
                  {item.subItems.map((sub) => (
                    <Link key={sub.label} href={sub.href}>
                      <div className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all",
                        isActive(sub.href)
                          ? (dark ? "text-white bg-primary/10" : "text-primary bg-primary/5")
                          : (dark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")
                      )}>
                        <div className="flex items-center gap-2">
                          {sub.icon}
                          <span>{sub.label}</span>
                        </div>
                        {sub.status && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">{sub.status}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* Bottom items — pinned to the bottom of the nav with a divider,
            separated from the main menu list above (matches the reference design). */}
        <div className={cn("mt-auto pt-3 space-y-2 border-t", dark ? "border-slate-800" : "border-slate-200")}>
        {visibleBottomItems.map((item) => {
          const active = isActive(item.href) || (item.subItems?.some(s => isActive(s.href)) ?? false);
          const open = expanded === item.label;
          return (
            <div key={item.label}>
              {/* Bottom section is pinned at the sidebar's bottom edge, so its
                  submenu opens UPWARD (rendered above the trigger row) instead
                  of downward, where it would otherwise run off-screen. */}
              {!isCollapsed && item.hasSubmenu && open && item.subItems && (
                <div className="mb-0.5 ml-4 pl-4 space-y-0.5">
                  {item.subItems.map((sub) => (
                    <Link key={sub.label} href={sub.href}>
                      <div className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all",
                        isActive(sub.href)
                          ? (dark ? "text-white bg-primary/10" : "text-primary bg-primary/5")
                          : (dark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50")
                      )}>
                        <div className="flex items-center gap-2">
                          {sub.icon}
                          <span>{sub.label}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              <div
                onClick={() => {
                  if (item.hasSubmenu) {
                    if (isCollapsed) setIsCollapsed(false);
                    setExpanded(open ? null : item.label);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group relative",
                  active
                    ? (dark ? "bg-primary/10 text-white" : "bg-primary/10 text-primary")
                    : (dark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"),
                  isCollapsed && "justify-center"
                )}
              >
                <span className={cn("shrink-0", active ? (dark ? "text-white" : "text-primary") : "")}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <>
                    {item.hasSubmenu ? (
                      <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                    ) : (
                      <Link href={item.href} className="flex-1 text-[13px] font-medium">
                        {item.label}
                      </Link>
                    )}
                    {item.hasSubmenu && (
                      <ChevronDown size={13} className={cn("transition-transform shrink-0", open ? "" : "rotate-180", dark ? "text-slate-500" : "text-slate-400")} />
                    )}
                  </>
                )}

                {isCollapsed && (
                  <div className={cn(
                    "absolute left-full ml-3 px-2.5 py-1.5 text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[200] shadow-lg",
                    dark ? "bg-slate-800 text-white border border-slate-700" : "bg-slate-900 text-white"
                  )}>
                    {item.label}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </nav>

      {/* User footer removed */}
    </div>
  );
};

export default AgencySidebar;
