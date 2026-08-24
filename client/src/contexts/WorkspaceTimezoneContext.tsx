import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getUserInfo } from "@/lib/auth";
import { formatInTimeZone } from "date-fns-tz";

interface WorkspaceTimezoneContextType {
  timezone: string;
}

const WorkspaceTimezoneContext = createContext<WorkspaceTimezoneContextType>({ timezone: "UTC" });

/**
 * Fetches the current workspace's chosen timezone once and provides it app-wide,
 * so every displayed timestamp reflects the workspace's own timezone instead of
 * the visitor's browser timezone (or the server's UTC). Falls back to "UTC"
 * silently on any failure (e.g. agency-only sessions with no current workspace) —
 * matching ThemeContext's resilient pattern, never blocks rendering.
 */
export function WorkspaceTimezoneProvider({ children }: { children: React.ReactNode }) {
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/workspaces/current");
        const data = await res.json();
        if (!cancelled && data?.timezone) setTimezone(data.timezone);
      } catch {
        // No current workspace (e.g. agency-only session) — keep UTC.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <WorkspaceTimezoneContext.Provider value={{ timezone }}>{children}</WorkspaceTimezoneContext.Provider>;
}

export function useWorkspaceTimezone(): string {
  return useContext(WorkspaceTimezoneContext).timezone;
}

/**
 * Format a date in the given IANA timezone (defaults to "UTC" if omitted).
 * Use this in place of date-fns's bare `format()` anywhere a timestamp is
 * shown to the user — accepts the same format-string syntax as date-fns.
 */
export function formatInWorkspaceTz(date: Date | number | string, formatStr: string, timezone: string): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return formatInTimeZone(d, timezone || "UTC", formatStr);
}

/**
 * Agency-level equivalent of useWorkspaceTimezone(), for pages that show
 * data spanning multiple workspaces (org-wide audit logs, dashboard activity,
 * billing/invoices, voice wallet). An agency-level session has no "current
 * workspace" — /api/workspaces/current silently falls back to a hardcoded
 * workspace id, which is meaningless for cross-workspace views — so those
 * pages must read the agency's own timezone (Settings → General) instead.
 * Reuses the TanStack Query cache, so this is a no-op refetch if
 * AgencyGeneralSettings already has the same query loaded.
 */
export function useAgencyTimezone(): string {
  const agencyId = getUserInfo()?.modelable_id;
  const { data } = useQuery<{ agency?: { timezone?: string } }>({
    queryKey: [`/api/organizations/${agencyId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${agencyId}`);
      return res.json();
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
  });
  return data?.agency?.timezone || "UTC";
}
