import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// Error subclass carries the HTTP status so global cache handlers can branch on it
// without re-parsing the message string.
export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const raw = (await res.text()) || res.statusText;
    let humanMsg = raw;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
      // NestJS error shape: { message, error, statusCode }. Fall back to raw if absent.
      if (parsed && typeof parsed === 'object') {
        humanMsg = parsed.message || parsed.error || raw;
      }
    } catch {
      // not JSON — keep raw
    }
    throw new ApiError(res.status, humanMsg, parsed);
  }
}

// Global error handler — mirrors replyagent's axios interceptor pattern:
//   - 401 → clear auth + redirect to /login
//   - Validation errors (body has `errors: { field: msg }`) → silent, caller
//     surfaces them per-field
//   - Everything else (incl. 403) → generic destructive toast with the server's message
function handleApiError(error: unknown) {
  const isApi = error instanceof ApiError;
  const status = isApi ? error.status : 0;
  const description = isApi ? error.message : (error instanceof Error ? error.message : 'An error occurred');

  if (status === 401) {
    // Public/unauthenticated pages routinely get a 401 from background fetches
    // (branding, theme) since there's no session yet — that's expected there,
    // not a reason to clear storage or bounce the user away. /sso in
    // particular is actively WRITING a fresh token when these background
    // fetches race in — clearing it here would erase a token that isn't
    // even stale, just not yet attached to every in-flight request.
    const publicPaths = ['/login', '/signup', '/forgot-password', '/accept-invitation', '/find-account', '/sso'];
    if (typeof window !== 'undefined' && publicPaths.some((p) => window.location.pathname.endsWith(p))) {
      return;
    }
    // A 401 carrying LOGIN_BLOCKED isn't an expired session — the agent's
    // login policy (allowed hours / IP) closed on them mid-session. Carry the
    // reason across the redirect so /login can say why, instead of dumping
    // them on a blank form. sessionStorage: one tab, one time, auto-cleared.
    if (isApi && (error.body as any)?.error_code === 'LOGIN_BLOCKED') {
      try {
        sessionStorage.setItem('login_blocked_reason', error.message);
      } catch {
        /* private mode / storage disabled — the redirect still happens */
      }
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return;
  }

  // Field-level validation errors (e.g. POST /users/change-password with a wrong
  // current password) come back as `{ errors: { field: 'message' } }`. The
  // caller surfaces them under the offending input; a generic toast on top
  // would just be noise.
  if (isApi && error.body && typeof error.body === 'object' && error.body.errors) {
    return;
  }

  toast({
    title: status === 403 ? 'Access denied' : 'Error',
    description,
    variant: 'destructive',
  });
}

// API base URL: prefer window.__API_BASE_URL__ (injected into index.html at build
// time, never cached) so the correct backend URL is always used even if the JS
// bundle is served from browser cache. Falls back to the Vite env var for local dev.
const API_BASE_URL = (
  (typeof window !== "undefined" && (window as any).__API_BASE_URL__) ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).replace(/\/$/, "");

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | FormData | undefined,
  options?: { silentStatuses?: number[] },
): Promise<Response> {
  const isFormData = data instanceof FormData;
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {};
  if (!isFormData && data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // With an absolute backend base, strip the /api prefix (NestJS serves at root).
  // With an empty base (dev proxy mode), keep /api so Vite's proxy matches it.
  let processedUrl = url;
  if (API_BASE_URL && processedUrl.startsWith("/api")) {
    processedUrl = processedUrl.substring(4);
  }
  const fullUrl = `${API_BASE_URL}${processedUrl.startsWith("/") ? "" : "/"}${processedUrl}`;

  console.log("Requesting:", fullUrl);

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: isFormData ? (data as FormData) : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  try {
    await throwIfResNotOk(res);
  } catch (error) {
    // Some callers (e.g. polling a conversation that may have just been deleted)
    // expect certain statuses and handle them silently. Skip the global toast for
    // those, but still throw so the caller's catch can react.
    const status = error instanceof ApiError ? error.status : 0;
    if (!options?.silentStatuses?.includes(status)) {
      handleApiError(error);
    }
    throw error;
  }
  return res;
}

/**
 * Upload via XHR so the caller can track upload progress (fetch can't).
 * Mirrors apiRequest's auth + URL processing.
 */
export function apiUploadWithProgress(
  method: string,
  url: string,
  formData: FormData,
  onProgress?: (percent: number) => void,
): Promise<Response> {
  const token = localStorage.getItem("auth_token");

  let processedUrl = url;
  if (API_BASE_URL && processedUrl.startsWith("/api")) {
    processedUrl = processedUrl.substring(4);
  }
  const fullUrl = `${API_BASE_URL}${processedUrl.startsWith("/") ? "" : "/"}${processedUrl}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, fullUrl);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = async () => {
      // Build a Response-like object so callers using throwIfResNotOk work.
      const res = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
      });
      try {
        await throwIfResNotOk(res);
        resolve(res);
      } catch (error) {
        handleApiError(error);
        reject(error);
      }
    };

    xhr.onerror = () => {
      const err = new ApiError(0, "Network error during upload");
      handleApiError(err);
      reject(err);
    };

    xhr.send(formData);
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let path = queryKey.join("/");
    if (API_BASE_URL && path.startsWith("/api")) {
      path = path.substring(4);
    }

    const fullUrl = `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    try {
      await throwIfResNotOk(res);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
