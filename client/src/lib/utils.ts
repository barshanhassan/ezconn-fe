import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatInTimeZone } from "date-fns-tz"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConversationTime(dateStr: string, timezone: string = "UTC") {
  if (!dateStr) return "";
  const date = new Date(dateStr);

  // User requested to remove invalid date handling fallback.

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 23) {
    // Show relative time
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return `${Math.floor(diffHours)}h ago`;
  } else {
    // Show date DD-MM-YYYY, in the workspace's own timezone
    return formatInTimeZone(date, timezone || "UTC", "dd-MM-yyyy");
  }
}

export function formatMessageDate(date: Date | string, timezone: string = "UTC") {
  if (!date) return "";
  let d = new Date(date);

  /*
   * User requested to remove invalid date handling fallback to allow bugs to be visible.
   * If parsing fails, this will result in NaN calculations downstream.
   */

  const tz = timezone || "UTC";
  const now = new Date();
  // Compare calendar days in the workspace's timezone, not the browser's.
  const todayKey = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const dKey = formatInTimeZone(d, tz, "yyyy-MM-dd");
  if (dKey === todayKey) return "Today";

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = formatInTimeZone(yesterday, tz, "yyyy-MM-dd");
  if (dKey === yesterdayKey) return "Yesterday";

  return formatInTimeZone(d, tz, "dd/MM/yyyy");
}

export function formatMessageTime(dateStr: string, timezone: string = "UTC") {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; // Fallback to original string if invalid

  return formatInTimeZone(date, timezone || "UTC", "h:mm a");
}
