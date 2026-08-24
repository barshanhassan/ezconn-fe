import React, { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo, hasAnyPerm } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutGrid,
  User,
  Settings,
  Clock,
  Bot,
  CalendarX,
  UserCog,
  MessageSquare,
  Tag,

  Code,
  Lock,
  ChevronDown,
  Film,
  Sliders,
  Book,

  Plug, // Added Plug icon
  Code2,
  Network,
  Search,
  Sparkles,
  Zap,
  MessageCircle,
  Palette,
  ShieldCheck,
  Users,
  Mic,
  BarChart3,
  ListChecks,
  Layout,
} from "lucide-react";
import ManageSection from "@/components/workspace/ManageSection";
import LiveChatSection from "@/components/workspace/LiveChatSection";
import ProfileSection from "@/components/sections/ProfileSection";
import PreferencesSection from "@/components/sections/PreferencesSection";

import AIChatAssistantsSection from "@/components/sections/ai/AIChatAssistantsSection";
import AIVoiceAssistantsSection from "@/components/sections/ai/AIVoiceAssistantsSection";
import AIKnowledgeBaseSection from "@/components/sections/ai/AIKnowledgeBaseSection";
import AIReportBuilderSection from "@/components/sections/ai/AIReportBuilderSection";


import IntegrationsSection from "@/components/sections/connect/IntegrationsSection";
import APISection from "@/components/sections/connect/APISection";
import VisualAPISection from "@/components/sections/connect/VisualAPISection";


import DeveloperSettingsSection from "@/components/sections/DeveloperSettingsSection";
import ChangePasswordSection from "@/components/sections/ChangePasswordSection";


import WhiteLabelSection from "@/components/workspace/WhiteLabelSection";
import RolesSection from "@/components/workspace/RolesSection";
import TeamsSection from "@/components/workspace/TeamsSection";
import ManageAgentsSection from "@/components/workspace/ManageAgentsSection";
import MediaGallerySection from "@/components/workspace/MediaGallerySection";
import CustomizationSection from "@/components/sections/CustomizationSection";
import CustomFieldsSection from "@/components/sections/CustomFieldsSection";
import ChatWidgetSection from "@/components/sections/ChatWidgetSection";
import IframeSection from "@/components/sections/IframeSection";
import TagsSection from "@/components/sections/TagsSection";
import QuickRepliesSection from "@/components/sections/QuickRepliesSection";

// Channel Sections
import WhatsAppSection from "@/components/sections/channels/WhatsAppSection";
import InstagramSection from "@/components/sections/channels/InstagramSection";
import MessengerSection from "@/components/sections/channels/MessengerSection";
import TelegramSection from "@/components/sections/channels/TelegramSection";
import SmsCallsSection from "@/components/sections/channels/SmsCallsSection";
import WebchatSection from "@/components/sections/channels/WebchatSection";


export default function SettingsPage() {
  // Workspace settings drive feature gating (White Label, etc). Fetched once and
  // the result is reused below to filter the sidebar children — mirrors how the
  // agency edit form persists these flags.
  const { data: currentWorkspace } = useQuery<any>({
    queryKey: ["/api/workspaces/current"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/current");
      return res.json();
    },
  });
  const allowBranding = currentWorkspace?.allow_branding ?? true;
  // Gate the Live Chat settings by `workspace.inbox.manage` (replyagent: settings
  // nav item + route both require it). Owners hold `workspace.*` so they pass.
  const canManageLiveChat = hasAnyPerm(
    (getUserInfo().permissions as string[] | undefined) ?? [],
    ["workspace.inbox.manage"],
  );

  // Connect settings — gate each nav sub-item (replyagent Settings.vue):
  //  - Integrations → $canAny over the 6 integration permissions
  //  - API          → public_api
  //  - Visual API   → visual_api
  // Owners hold `workspace.*` so they pass via the wildcard.
  const _connectPerms = (getUserInfo().permissions as string[] | undefined) ?? [];
  const canConnectIntegrations = hasAnyPerm(_connectPerms, [
    "workspace.settings.open_ai",
    "workspace.settings.cloudinary",
    "workspace.settings.active_campaign",
    "workspace.settings.make_dot_com",
    "workspace.settings.ms_tts",
    "workspace.settings.eleven_labs",
  ]);
  const canPublicApi = hasAnyPerm(_connectPerms, ["workspace.settings.public_api"]);
  const canVisualApi = hasAnyPerm(_connectPerms, ["workspace.settings.visual_api"]);

  // AI (ChatGPT) settings — gate each sub-section by its permissions (replyagent
  // Settings.vue $canAny per AI sub-area). Owners hold `workspace.*`.
  //  - AI Chat Assistants ← create/edit/delete_knowledgebase
  const canAiAssistants = hasAnyPerm(_connectPerms, [
    "workspace.ai.create_knowledgebase",
    "workspace.ai.edit_knowledgebase",
    "workspace.ai.delete_knowledgebase",
  ]);
  //  - AI Knowledge base ← create_kb / delete_kb
  const canAiKnowledgeBase = hasAnyPerm(_connectPerms, [
    "workspace.ai.create_kb",
    "workspace.ai.delete_kb",
  ]);
  //  - AI Voice Assistants ← voice.view
  const canAiVoice = hasAnyPerm(_connectPerms, ["workspace.ai.voice.view"]);
  //  - AI Report Builder ← manage_reports (single perm gates the whole screen)
  const canAiReports = hasAnyPerm(_connectPerms, ["workspace.ai.manage_reports"]);
  const chatGptChildren = [
    ...(canAiAssistants ? [{ name: "AI Chat Assistants", icon: Sparkles }] : []),
    ...(canAiVoice ? [{ name: "AI Voice Assistants", icon: Mic }] : []),
    ...(canAiKnowledgeBase ? [{ name: "AI Knowledge base", icon: Book }] : []),
    ...(canAiReports ? [{ name: "AI Report Builder", icon: BarChart3 }] : []),
  ];

  const connectChildren = [
    ...(canConnectIntegrations ? [{ name: "Integrations", icon: Plug }] : []),
    ...(canPublicApi ? [{ name: "API", icon: Code2 }] : []),
    ...(canVisualApi ? [{ name: "Visual API", icon: Network }] : []),
  ];

  const workspaceChildren = [
    { name: "Manage", path: "/settings/workspace/ManageSection", icon: Settings },
    // Hide the Live Chat settings sub-item unless the agent may manage live chat.
    ...(canManageLiveChat
      ? [{ name: "Live Chat", path: "/settings/workspace/live-chat", icon: MessageCircle }]
      : []),
    // Hide the Theme (branding) sub-item when the agency has turned branding off for this workspace.
    ...(allowBranding
      ? [{ name: "Theme", path: "/settings/workspace/white-label", icon: Palette }]
      : []),
    { name: "Manage User", path: "/settings/workspace/manage-agents", icon: UserCog },
    { name: "Roles & Permissions", path: "/settings/workspace/roles", icon: ShieldCheck },
    { name: "Teams", path: "/settings/workspace/teams", icon: Users },
  ];

  const sections = [
    {
      name: "Workspace",
      icon: LayoutGrid,
      children: workspaceChildren,
    },
    // SETTINGS (existing ones)
    {
      name: "Conversation channels",
      icon: MessageSquare,
      children: [
        { name: "WhatsApp", iconPath: "/images/automations/whatsapp.svg" },
        { name: "Instagram", iconPath: "/images/automations/instagram.svg" },
        { name: "Messenger", iconPath: "/images/automations/messenger.svg" },
        { name: "Telegram", iconPath: "/images/automations/telegram.svg" },
        { name: "SMS & Calls", iconPath: "/images/automations/sms.svg" },
        { name: "Webchat", iconPath: "/images/automations/webchat.svg" },
      ],
    },
    {
      name: "ChatGPT",
      icon: Bot,
      children: chatGptChildren,
    },
    {
      name: "Connect",
      icon: Plug,
      children: connectChildren,
    },

    {
      name: "Customization",
      icon: Sliders,
      children: [
        { name: "Custom fields", icon: ListChecks },
        { name: "Chat Widget", icon: Layout },
        { name: "Iframe", icon: Code },
        { name: "Tags", icon: Tag },
        { name: "Quick Replies", icon: Zap },
      ],
    },





    { name: "Media Gallery", icon: Film },
    { name: "Developer Settings", icon: Code },
    { name: "Change Password", icon: Lock },
  ];




  // Calculate initial activeSection directly from URL
  const initialTabParam = new URLSearchParams(window.location.search).get("tab");
  const initialActiveSection = (initialTabParam && (sections.some(s => s.name === initialTabParam) || sections.some(s => s.children?.some((c: any) => c.name === initialTabParam)))) ? initialTabParam : "Manage";

  const channelNames = ["WhatsApp","Instagram","Messenger","Telegram","SMS & Calls","Webchat"];
  const chatGptNames = ["AI Chat Assistants","AI Voice Assistants","AI Knowledge base","AI Report Builder"];
  const connectNames = ["Integrations","API","Visual API"];
  const customizationNames = ["Custom fields","Chat Widget","Iframe","Tags","Quick Replies"];
  const workspaceNames = ["Manage","Live Chat","Theme","Manage User","Roles & Permissions","Teams"];

  const [activeSection, setActiveSection] = useState(initialActiveSection);

  // Accordion: only one sidebar group stays expanded at a time (matches
  // AgencySidebar's `expanded` behavior) — opening a new group auto-closes
  // whichever one was open before, instead of letting several stack up.
  const initialExpandedGroup =
    workspaceNames.includes(initialActiveSection) || initialActiveSection === "Manage" ? "workspace"
    : customizationNames.includes(initialActiveSection) ? "customization"
    : channelNames.includes(initialActiveSection) ? "channels"
    : chatGptNames.includes(initialActiveSection) ? "chatgpt"
    : connectNames.includes(initialActiveSection) ? "connect"
    : null;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(initialExpandedGroup);
  const workspaceOpen = expandedGroup === "workspace";
  const setWorkspaceOpen = (open: boolean) => setExpandedGroup(open ? "workspace" : null);
  const customizationOpen = expandedGroup === "customization";
  const setCustomizationOpen = (open: boolean) => setExpandedGroup(open ? "customization" : null);
  const channelsOpen = expandedGroup === "channels";
  const setChannelsOpen = (open: boolean) => setExpandedGroup(open ? "channels" : null);
  const chatGptOpen = expandedGroup === "chatgpt";
  const setChatGptOpen = (open: boolean) => setExpandedGroup(open ? "chatgpt" : null);
  const connectOpen = expandedGroup === "connect";
  const setConnectOpen = (open: boolean) => setExpandedGroup(open ? "connect" : null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(""); // Default profile picture
  const [notificationsEnabled, setNotificationsEnabled] = useState(false); // User preference for notifications, off by default
  const [browserNotificationsDenied, setBrowserNotificationsDenied] = useState(Notification.permission === 'denied'); // Initialize based on actual browser permission
  const [preferences, setPreferences] = useState({
    timezone: "(GMT+05:00) Islamabad, Karachi, Tashkent",
    twoFactorAuth: false,
    autoHide: false,
    disableCSAT: false,
    manualHandoff: false,
    enableTranscript: false,
    emailTranscript: false,
    transcriptEmails: "",
  });
  const [, navigate] = useLocation(); // Get navigate function from wouter
  const search = useSearch(); // Get the query string from wouter
  const [searchQuery, setSearchQuery] = useState("");

  const goToSection = (name: string) => {
    setActiveSection(name);
    navigate(`/settings?tab=${encodeURIComponent(name)}`, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");

    if (tabParam) {
      const found = sections.some(s => s.name === tabParam) || sections.some(s => s.children?.some((c: any) => c.name === tabParam));
      if (found) setActiveSection(tabParam);
    }
  }, [search]); // Depend on search and sections

  const handleTestNotification = () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notification");
    } else if (Notification.permission === "granted") {
      new Notification("Test Notification", {
        body: "This is a test desktop notification from your app!",
        icon: "/favicon.ico", // You might want to use a proper icon path
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Test Notification", {
            body: "This is a test desktop notification from your app!",
            icon: "/favicon.ico",
          });
          setBrowserNotificationsDenied(false); // Update state if permission is granted
        } else if (permission === "denied") {
          setBrowserNotificationsDenied(true); // Update state if permission is denied
        }
      });
    }
  };

  // Sentence-case a sidebar label for display: keep the first word's
  // leading letter capitalised, force everything else lowercase, and
  // preserve product names / acronyms verbatim ("AI", "WhatsApp",
  // "ChatGPT", …). Internal state keys stay in their original casing so
  // activeSection matchers keep working — this is display only.
  const displayLabel = (raw: string): string => {
    const preserve = new Set([
      "AI", "URL", "ID", "API", "CSV", "SMS",
      "WhatsApp", "Instagram", "Messenger", "Telegram", "Webchat",
      "ChatGPT", "Iframe",
    ]);
    return raw
      .split(/(\s+|&)/)
      .map((tok, i) => {
        if (/^\s+$/.test(tok) || tok === "&") return tok;
        if (preserve.has(tok)) return tok;
        return i === 0
          ? tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()
          : tok.toLowerCase();
      })
      .join("");
  };

  // Filter sections based on search query
  const filteredSections = sections.map(section => {
    if (!searchQuery.trim()) return section;

    const matchesParent = section.name.toLowerCase().includes(searchQuery.toLowerCase());
    const filteredChildren = section.children?.filter((child: any) =>
      child.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchesParent || (filteredChildren && filteredChildren.length > 0)) {
      return {
        ...section,
        children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : section.children
      };
    }
    return null;
  }).filter(Boolean);


  return (
    <>
      {/* Google Font - Inter */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Outer wrapper — matches the floating header pattern: 12px gap on
          all sides so the sidebar + content read as separate rounded
          cards, not an edge-to-edge sheet. Height budgets 88px for the
          floating header + 12px bottom breathing room. */}
      <div className="h-auto md:h-[calc(100vh-88px)] overflow-y-auto md:overflow-hidden p-3 bg-slate-50/80 dark:bg-[#0b1120]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="flex flex-col md:flex-row h-auto md:h-full gap-3">
          {/* Left Sidebar Navigation — floating rounded card, all-side
              border + shadow so the separation from the header (and the
              content panel to the right) reads clearly. */}
          <Card className="w-full md:h-full md:w-64 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl flex-shrink-0 z-10 flex flex-col overflow-hidden shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)]">
            <CardContent className="p-0 flex flex-col flex-1 overflow-y-auto scrollbar-hide max-h-[50vh] md:max-h-full min-h-0">

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 relative z-10">
                <div className="relative group">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Search settings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-[13px] border border-slate-200 dark:border-slate-700 rounded-[10px]
                             focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                             bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
                             placeholder:text-slate-400 dark:placeholder:text-slate-500
                             transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600"
                  />
                </div>
              </div>

              <div className="p-2 relative z-10">


                {/* WORKSPACE DROPDOWN */}
                <div className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                  <button
                    onClick={() => setWorkspaceOpen(!workspaceOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors
                text-slate-600 hover:bg-slate-100 hover:text-slate-900
                dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <div className="flex items-center gap-2.5">
                      <LayoutGrid size={16} className="text-primary" />
                      <span>Workspace</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`transition-transform text-slate-400 ${workspaceOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {workspaceOpen && (
                    <div className="ml-1 mt-1 space-y-0.5">
                      {filteredSections[0]?.children?.map((item: any, idx: number) => {
                        const ItemIcon = item.icon;
                        return (
                        <React.Fragment key={item.path}>
                          <button
                            onClick={() => goToSection(item.name)}
                            className={`w-full flex items-center gap-2 text-left pl-8 pr-3 py-1.5 text-[13px] rounded-[9px] transition-all duration-200
          ${activeSection === item.name
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                              }`}
                          >
                            {ItemIcon && <ItemIcon size={14} className={activeSection === item.name ? "text-primary" : "text-slate-400"} />}
                            {displayLabel(item.name)}
                          </button>

                        </React.Fragment>
                        );
                      })}
                    </div>

                  )}

                </div>
                {/* SETTINGS */}
                {filteredSections.slice(1).map((section, index) => {
                  if (!section) return null;
                  const Icon = section.icon;
                  // Render Customization as a dropdown with children
                  if (section.name === "Conversation channels") {
                    return (
                      <div key={section.name} className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                        <button
                          onClick={() => setChannelsOpen(!channelsOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors ${activeSection === section.name
                            ? "bg-primary/10 text-primary"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {Icon && <Icon size={16} className="text-slate-400" />}
                            <span>{displayLabel(section.name)}</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 ${channelsOpen ? "rotate-180" : ""}`} />
                        </button>

                        {channelsOpen && (
                          <div className="ml-1 mt-1 space-y-0.5">
                            {section.children?.map((child: any, childIndex: number) => {
                              const ChildIcon = child.icon;
                              return (
                                <React.Fragment key={child.name}>
                                  <button
                                    onClick={() => goToSection(child.name)}
                                    className={`w-full flex items-center gap-2 text-left pl-8 pr-3 py-1.5 text-[13px] rounded-[9px] transition-colors ${activeSection === child.name
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                      }`}
                                  >
                                    {child.iconPath ? (
                                      <img src={child.iconPath} alt={child.name} className="w-3.5 h-3.5" />
                                    ) : ChildIcon ? (
                                      <ChildIcon size={14} className={activeSection === child.name ? "text-white" : child.color} />
                                    ) : null}
                                    {displayLabel(child.name)}
                                  </button>

                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (section.name === "Customization") {
                    return (
                      <div key={section.name} className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                        <button
                          onClick={() => setCustomizationOpen(!customizationOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors ${activeSection === section.name
                            ? "bg-primary/10 text-primary"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {Icon && <Icon size={16} className="text-slate-400" />}
                            <span>{displayLabel(section.name)}</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 ${customizationOpen ? "rotate-180" : ""}`} />
                        </button>

                        {customizationOpen && (
                          <div className="ml-1 mt-1 space-y-0.5">
                            {section.children?.map((child: any, idx: number) => {
                              const ChildIcon = child.icon;
                              return (
                              <React.Fragment key={child.name}>
                                <button
                                  onClick={() => goToSection(child.name)}
                                  className={`w-full flex items-center gap-2 text-left pl-8 pr-3 py-1.5 text-[13px] rounded-[9px] transition-colors ${activeSection === child.name
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                  {ChildIcon && <ChildIcon size={14} className={activeSection === child.name ? "text-primary" : "text-slate-400"} />}
                                  {displayLabel(child.name)}
                                </button>

                              </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (section.name === "ChatGPT") {
                    if (!section.children || section.children.length === 0) return null;
                    return (
                      <div key={section.name} className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                        <button
                          onClick={() => setChatGptOpen(!chatGptOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors ${activeSection === section.name
                            ? "bg-primary/10 text-primary"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {Icon && <Icon size={16} className="text-slate-400" />}
                            <span>{displayLabel(section.name)}</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 ${chatGptOpen ? "rotate-180" : ""}`} />
                        </button>

                        {chatGptOpen && (
                          <div className="ml-1 mt-1 space-y-0.5">
                            {section.children?.map((child: any, idx: number) => {
                              const ChildIcon = child.icon;
                              return (
                              <React.Fragment key={child.name}>
                                <button
                                  onClick={() => goToSection(child.name)}
                                  className={`w-full flex items-center gap-2 text-left pl-8 pr-3 py-1.5 text-[13px] rounded-[9px] transition-colors ${activeSection === child.name
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                  {ChildIcon && <ChildIcon size={14} className={activeSection === child.name ? "text-primary" : "text-slate-400"} />}
                                  {displayLabel(child.name)}
                                </button>

                              </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (section.name === "Connect") {
                    if (!section.children || section.children.length === 0) return null;
                    return (
                      <div key={section.name} className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                        <button
                          onClick={() => setConnectOpen(!connectOpen)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors ${activeSection === section.name
                            ? "bg-primary/10 text-primary"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {Icon && <Icon size={16} className="text-slate-400" />}
                            <span>{displayLabel(section.name)}</span>
                          </div>
                          <ChevronDown size={14} className={`text-slate-400 ${connectOpen ? "rotate-180" : ""}`} />
                        </button>

                        {connectOpen && (
                          <div className="ml-1 mt-1 space-y-0.5">
                            {section.children?.map((child: any, idx: number) => {
                              const ChildIcon = child.icon;
                              return (
                              <React.Fragment key={child.name}>
                                <button
                                  onClick={() => goToSection(child.name)}
                                  className={`w-full flex items-center gap-2 text-left pl-8 pr-3 py-1.5 text-[13px] rounded-[9px] transition-colors ${activeSection === child.name
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                                    }`}
                                >
                                  {ChildIcon && <ChildIcon size={14} className={activeSection === child.name ? "text-primary" : "text-slate-400"} />}
                                  {displayLabel(child.name)}
                                </button>

                              </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={section.name} className="border-b border-slate-200/60 dark:border-slate-800 pb-3 mb-3 relative">
                          <button
                        onClick={() => goToSection(section.name)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-colors ${activeSection === section.name
                          ? "bg-primary/10 text-primary"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          }`}
                      >
                        {Icon && <Icon size={16} className={activeSection === section.name ? "text-primary" : "text-slate-400"} />}
                        <span>{displayLabel(section.name)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>

          </Card>

          {/* Right Content Area — same floating-card treatment as the
              sidebar so both panels read as separate rounded blocks
              with the header floating above. Padding gives the nested
              section cards breathing room from the outer card edge. */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18),0_4px_10px_-2px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.55),0_4px_10px_-2px_rgba(0,0,0,0.35)] settings-pane">
            <Card className="flex-1 overflow-auto scrollbar-hide border-0 shadow-none bg-transparent dark:bg-transparent p-4">
              {activeSection === "Manage" && (
                <ManageSection />)}

              {activeSection === "Live Chat" && canManageLiveChat && (
                <LiveChatSection />
              )}

              {activeSection === "Theme" && allowBranding && (
                <WhiteLabelSection />)}
              {activeSection === "Manage User" && (
                <ManageAgentsSection />)}
              {activeSection === "Roles & Permissions" && (
                <RolesSection />)}
              {activeSection === "Teams" && (
                <TeamsSection />)}
              {activeSection === "Media Gallery" && (
                <MediaGallerySection />)}


              {activeSection === "My Profile" && (
                <ProfileSection
                  profilePictureUrl={profilePictureUrl}
                  setProfilePictureUrl={setProfilePictureUrl}
                  notificationsEnabled={notificationsEnabled}
                  setNotificationsEnabled={setNotificationsEnabled}
                  browserNotificationsDenied={browserNotificationsDenied}
                  handleTestNotification={handleTestNotification}
                />
              )}

              {activeSection === "Preferences" && (
                <PreferencesSection
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
              )}


              {activeSection === "AI Chat Assistants" && canAiAssistants && (
                <AIChatAssistantsSection />
              )}
              {activeSection === "AI Voice Assistants" && canAiVoice && (
                <AIVoiceAssistantsSection />
              )}
              {activeSection === "AI Knowledge base" && canAiKnowledgeBase && (
                <AIKnowledgeBaseSection />
              )}
              {activeSection === "AI Report Builder" && canAiReports && (
                <AIReportBuilderSection />
              )}


              {activeSection === "Integrations" && canConnectIntegrations && (
                <IntegrationsSection />
              )}
              {activeSection === "API" && canPublicApi && (
                <APISection />
              )}
              {activeSection === "Visual API" && canVisualApi && (
                <VisualAPISection />
              )}


              {activeSection === "Quick Replies" && (
                <QuickRepliesSection />
              )}
              {activeSection === "Tags" && (
                <TagsSection />
              )}

              {activeSection === "Developer Settings" && (
                <DeveloperSettingsSection />
              )}
              {activeSection === "Custom fields" && (
                <CustomFieldsSection />
              )}
              {activeSection === "Chat Widget" && (
                <ChatWidgetSection />
              )}
              {activeSection === "Iframe" && (
                <IframeSection />
              )}
              {activeSection === "Change Password" && (
                <ChangePasswordSection />
              )}

              {/* Channel Sections */}
              {activeSection === "WhatsApp" && <WhatsAppSection />}
              {activeSection === "Instagram" && <InstagramSection />}
              {activeSection === "Messenger" && <MessengerSection />}
              {activeSection === "Telegram" && <TelegramSection />}
              {activeSection === "SMS & Calls" && <SmsCallsSection />}
              {activeSection === "Webchat" && <WebchatSection />}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
