import { useState } from "react";
import { useLocation } from "wouter"; // Import useLocation from wouter
import { useTranslation } from "react-i18next";
import {
  Menu,
  Bell,
  User,
  Lock,
  LogOut,
  Check,
  Clock,
  Info,
  Settings,
  BellOff
} from "react-feather";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getAvatarColor } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

interface TopNavbarProps {
  onToggleSidebar: () => void;
}

export default function TopNavbar({ onToggleSidebar }: TopNavbarProps) {
  const { t } = useTranslation();
  const [agentStatus, setAgentStatus] = useState<"available" | "away">("available");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "chat",
      message: "New message from John Doe",
      time: "2m ago",
      read: false,
    },
    {
      id: 2,
      type: "alert",
      message: "Campaign 'Summer Sale' delivered",
      time: "15m ago",
      read: false,
    },
    {
      id: 3,
      type: "info",
      message: "System update available",
      time: "1h ago",
      read: true,
    },
    {
      id: 4,
      type: "chat",
      message: "New message from Sarah Smith",
      time: "45m ago",
      read: false,
    },
    {
      id: 5,
      type: "alert",
      message: "API rate limit warning",
      time: "2h ago",
      read: true,
    },
  ]);

  const mockNotifications = {
    all: notifications,
    chats: notifications.filter((n) => n.type === "chat"),
    alerts: notifications.filter((n) => n.type === "alert"),
    info: notifications.filter((n) => n.type === "info"),
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  const [, navigate] = useLocation(); // Get navigate function from wouter

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    navigate('/login'); // Redirect to login page
  };

  return (
    <header
      className="h-16 bg-card border-b border-card-border px-4 flex items-center justify-between"
      data-testid="navbar"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="hover-elevate"
        data-testid="button-sidebar-toggle"
      >
        <Menu size={20} />
      </Button>


      <div className="flex items-center gap-3">
        {/* Agent Status */}


        {/* Workspace Dropdown */}
        <Select defaultValue="workspace-a">
          <SelectTrigger className="w-[150px] h-9 text-[12px] font-bold border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg">
            <SelectValue placeholder={t("top_navbar.select_workspace")} />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
            <SelectItem value="workspace-a" className="text-[12px] font-medium">Workspace A</SelectItem>
            <SelectItem value="workspace-b" className="text-[12px] font-medium">Workspace B</SelectItem>
            <SelectItem value="workspace-c" className="text-[12px] font-medium">Workspace C</SelectItem>
          </SelectContent>
        </Select>

        <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative hover-elevate flex items-center justify-center w-10 h-10 z-[60]"
              onClick={(e) => {
                e.preventDefault();
                setNotificationsOpen(!notificationsOpen);
              }}
            >
              <Bell size={20} className="text-slate-600 dark:text-slate-300" />
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[360px] p-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[100]"
            sideOffset={8}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between bg-white dark:bg-[#1e293b]">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-slate-600 dark:text-slate-400" />
                <h3 className="font-bold text-[14px] text-slate-900 dark:text-white">{t("top_navbar.notifications")}</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <Settings size={16} className="text-slate-600 dark:text-slate-400" />
              </Button>
            </div>
            
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-[#0f172a]">
              <div className="mb-4 relative">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                  <BellOff size={32} className="text-slate-300 dark:text-slate-600" />
                </div>
              </div>
              <p className="text-[14px] font-bold text-slate-900 dark:text-white mb-1">
                {t("top_navbar.no_notifications")}
              </p>
              <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
                {t("top_navbar.notifications_retention_note")}
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="group flex items-center gap-3 px-3 py-1.5 h-auto hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              data-testid="button-user-menu"
            >
              <div className="relative">
                <Avatar className="h-9 w-9 border-2 border-white dark:border-slate-800 shadow-sm">
                  <AvatarFallback className={cn(getAvatarColor("Talha Agency"), "text-[12px] font-bold")}>
                    TA
                  </AvatarFallback>
                </Avatar>
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900", 
                  agentStatus === "available" ? "bg-green-500" : "bg-amber-500")} />
              </div>
              <div className="flex flex-col items-start gap-0">
                <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight">
                  Talha Agency
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", agentStatus === "available" ? "bg-green-500" : "bg-amber-500")} />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                    {agentStatus === "available" ? t("top_navbar.status_available") : t("top_navbar.status_away")}
                  </span>
                </div>
              </div>
              <Menu className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-1 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 p-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl"
            data-testid="dropdown-user-menu"
          >
            <div className="px-2 py-3 mb-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">Talha Agency</p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5 uppercase tracking-tight">{t("top_navbar.organization_owner")}</p>
            </div>
            
            <DropdownMenuLabel className="px-2 text-[10px] font-bold text-slate-400 mb-1">{t("top_navbar.account")}</DropdownMenuLabel>
            <DropdownMenuItem
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setAgentStatus(agentStatus === "available" ? "away" : "available")}
            >
              <div className={cn("w-2 h-2 rounded-full", agentStatus === "available" ? "bg-green-500" : "bg-amber-500")} />
              <span className="text-[12px] font-bold">
                {agentStatus === "available" ? t("top_navbar.set_as_away") : t("top_navbar.set_as_available")}
              </span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-2 bg-slate-100 dark:bg-slate-800" />
            
            <DropdownMenuItem
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => navigate("/settings?tab=My Profile")}
            >
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-[12px] font-bold">{t("top_navbar.profile_settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => navigate("/settings?tab=Change Password")}
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span className="text-[12px] font-bold">{t("top_navbar.change_password")}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-2 bg-slate-100 dark:bg-slate-800" />

            <DropdownMenuItem
              className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[12px] font-bold">{t("top_navbar.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
