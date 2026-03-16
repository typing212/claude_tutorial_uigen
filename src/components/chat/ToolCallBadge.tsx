import { Loader2 } from "lucide-react";

export type ParsedToolCall = { verb: string; filename?: string };

export function parseToolCall(
  toolName: string,
  args: Record<string, unknown>
): ParsedToolCall {
  const basename = (p: unknown) =>
    typeof p === "string" ? p.split("/").pop() ?? p : undefined;

  if (toolName === "str_replace_editor") {
    const command = args.command as string | undefined;
    const file = basename(args.path);
    switch (command) {
      case "create":      return { verb: "Creating", filename: file };
      case "str_replace": return { verb: "Editing", filename: file };
      case "insert":      return { verb: "Inserting into", filename: file };
      case "view":        return { verb: "Reading", filename: file };
      case "undo_edit":   return { verb: "Reverting", filename: file };
    }
  }

  if (toolName === "file_manager") {
    const command = args.command as string | undefined;
    if (command === "delete") return { verb: "Deleting", filename: basename(args.path) };
    if (command === "rename") {
      const from = basename(args.path);
      const to = basename(args.new_path);
      return { verb: "Renaming", filename: from && to ? `${from} → ${to}` : from ?? to };
    }
  }

  return { verb: toolName };
}

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: unknown;
}

export function ToolCallBadge({ toolInvocation }: { toolInvocation: ToolInvocation }) {
  const { verb, filename } = parseToolCall(toolInvocation.toolName, toolInvocation.args);
  const isDone = toolInvocation.state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">
        {verb}
        {filename && <> <span className="font-mono font-medium">{filename}</span></>}
      </span>
    </div>
  );
}
