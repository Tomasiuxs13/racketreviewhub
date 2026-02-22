import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if data is FormData (for file uploads)
  const isFormData = data instanceof FormData;

  // Get auth headers
  const authHeaders = getAuthHeaders();

  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      // Don't set Content-Type for FormData - browser will set it with boundary
      ...(data && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    // Don't stringify FormData - send it as-is
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr"];

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      // Extract locale from queryKey if it's the last element and is a valid locale
      const keyArray = [...queryKey];
      const lastElement = keyArray[keyArray.length - 1];
      const extractedLocale = typeof lastElement === "string" && SUPPORTED_LOCALES.includes(lastElement)
        ? keyArray.pop() as string
        : undefined;

      // Build URL from remaining queryKey elements
      let url = keyArray.join("/") as string;

      // Append locale query parameter if provided and not English
      if (extractedLocale && extractedLocale !== "en") {
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}lang=${extractedLocale}`;
      }

      // Get auth headers for admin routes
      const authHeaders = getAuthHeaders();

      const res = await fetch(url, {
        credentials: "include",
        headers: authHeaders,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000, // 5 minutes — data is fresh for 5 min, then refetched
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
