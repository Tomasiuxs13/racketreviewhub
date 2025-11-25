import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { useI18n } from "@/i18n/useI18n";
import { getQueryFn } from "@/lib/queryClient";

/**
 * Wrapper around useQuery that automatically includes locale in API requests
 */
export function useLocalizedQuery<TData = unknown, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, "queryFn"> & {
    queryKey: QueryKey;
  },
) {
  const { locale } = useI18n();
  
  return useQuery<TData, TError>({
    ...options,
    queryKey: [...options.queryKey, locale], // Include locale in query key for cache invalidation
    queryFn: getQueryFn({ on401: "throw" }), // Locale will be extracted from queryKey
  });
}

