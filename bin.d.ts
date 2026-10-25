
export const TOOL_NAMES: string[];

export function handleRpc(
  message: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> },
  env?: Record<string, string | undefined>,
): Promise<{
  result?: {
    isError?: boolean;
    content?: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
  };
} | null>;


