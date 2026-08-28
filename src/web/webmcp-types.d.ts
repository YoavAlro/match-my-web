interface WebMcpAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpAnnotations;
  execute: (input?: unknown) => unknown | Promise<unknown>;
}

interface WebMcpModelContext {
  registerTool(tool: WebMcpToolDefinition): Promise<void>;
}

interface Document {
  modelContext?: WebMcpModelContext;
}
