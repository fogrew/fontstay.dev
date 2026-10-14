import type { WebMcpTool } from './types';

interface ModelContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
}

interface Scope {
  document?: unknown;
  navigator?: unknown;
}

export function findModelContext(scope: Scope): ModelContext | undefined {
  const candidates = [
    (scope.document as { modelContext?: ModelContext } | undefined)?.modelContext,
    (scope.navigator as { modelContext?: ModelContext } | undefined)?.modelContext,
  ];
  return candidates.find((item) => typeof item?.registerTool === 'function');
}

export function registerWebMcp(
  tools: readonly WebMcpTool[],
  scope: Scope = globalThis,
): (() => void) | undefined {
  const context = findModelContext(scope);
  if (!context) return undefined;
  const controller = new AbortController();
  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(
        () => undefined,
      );
    } catch {
      // the API is experimental and may reject a tool
    }
  }
  return () => controller.abort();
}
