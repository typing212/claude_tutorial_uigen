import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { parseToolCall, ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// --- Unit tests for parseToolCall ---

test("parseToolCall: str_replace_editor create", () => {
  expect(parseToolCall("str_replace_editor", { command: "create", path: "/src/App.jsx" }))
    .toEqual({ verb: "Creating", filename: "App.jsx" });
});

test("parseToolCall: str_replace_editor str_replace", () => {
  expect(parseToolCall("str_replace_editor", { command: "str_replace", path: "/src/Card.jsx" }))
    .toEqual({ verb: "Editing", filename: "Card.jsx" });
});

test("parseToolCall: str_replace_editor insert", () => {
  expect(parseToolCall("str_replace_editor", { command: "insert", path: "/src/App.jsx" }))
    .toEqual({ verb: "Inserting into", filename: "App.jsx" });
});

test("parseToolCall: str_replace_editor view", () => {
  expect(parseToolCall("str_replace_editor", { command: "view", path: "/src/App.jsx" }))
    .toEqual({ verb: "Reading", filename: "App.jsx" });
});

test("parseToolCall: str_replace_editor undo_edit", () => {
  expect(parseToolCall("str_replace_editor", { command: "undo_edit", path: "/src/App.jsx" }))
    .toEqual({ verb: "Reverting", filename: "App.jsx" });
});

test("parseToolCall: file_manager delete", () => {
  expect(parseToolCall("file_manager", { command: "delete", path: "/src/Old.jsx" }))
    .toEqual({ verb: "Deleting", filename: "Old.jsx" });
});

test("parseToolCall: file_manager rename formats both basenames with arrow", () => {
  expect(parseToolCall("file_manager", { command: "rename", path: "/src/Old.jsx", new_path: "/src/New.jsx" }))
    .toEqual({ verb: "Renaming", filename: "Old.jsx → New.jsx" });
});

test("parseToolCall: nested path extracts basename only", () => {
  expect(parseToolCall("str_replace_editor", { command: "create", path: "/a/b/c/Deep.jsx" }))
    .toEqual({ verb: "Creating", filename: "Deep.jsx" });
});

test("parseToolCall: unknown tool name returns verb = toolName", () => {
  expect(parseToolCall("some_unknown_tool", { command: "foo" }))
    .toEqual({ verb: "some_unknown_tool" });
});

test("parseToolCall: missing command in args falls back to tool name", () => {
  expect(parseToolCall("str_replace_editor", {}))
    .toEqual({ verb: "str_replace_editor" });
});

test("parseToolCall: missing path yields undefined filename", () => {
  const result = parseToolCall("str_replace_editor", { command: "create" });
  expect(result.verb).toBe("Creating");
  expect(result.filename).toBeUndefined();
});

test("parseToolCall: rename with only path (no new_path) returns just from", () => {
  const result = parseToolCall("file_manager", { command: "rename", path: "/src/Old.jsx" });
  expect(result.verb).toBe("Renaming");
  expect(result.filename).toBe("Old.jsx");
});

// --- Component rendering tests ---

test("ToolCallBadge shows spinner when state is 'call'", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: { command: "create", path: "/App.jsx" }, state: "call" }}
    />
  );
  expect(document.querySelector("svg")).toBeTruthy();
  expect(document.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows spinner when state is 'partial-call'", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: { command: "create", path: "/App.jsx" }, state: "partial-call" }}
    />
  );
  expect(document.querySelector("svg")).toBeTruthy();
  expect(document.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows green dot when state is 'result'", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: { command: "create", path: "/App.jsx" }, state: "result", result: "ok" }}
    />
  );
  expect(document.querySelector(".bg-emerald-500")).toBeTruthy();
});

test("ToolCallBadge renders 'Creating' and 'App.jsx' for str_replace_editor create", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: { command: "create", path: "/App.jsx" }, state: "result" }}
    />
  );
  expect(screen.getByText("Creating")).toBeDefined();
  expect(screen.getByText("App.jsx")).toBeDefined();
});

test("ToolCallBadge renders 'Editing' and 'Card.jsx' for str_replace_editor str_replace", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: { command: "str_replace", path: "/Card.jsx" }, state: "result" }}
    />
  );
  expect(screen.getByText("Editing")).toBeDefined();
  expect(screen.getByText("Card.jsx")).toBeDefined();
});

test("ToolCallBadge renders 'Renaming' and 'Old.jsx → New.jsx' for file_manager rename", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "file_manager", args: { command: "rename", path: "/Old.jsx", new_path: "/New.jsx" }, state: "result" }}
    />
  );
  expect(screen.getByText("Renaming")).toBeDefined();
  expect(screen.getByText("Old.jsx → New.jsx")).toBeDefined();
});

test("ToolCallBadge renders raw tool name for unknown tool", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "mystery_tool", args: {}, state: "result" }}
    />
  );
  expect(screen.getByText("mystery_tool")).toBeDefined();
});

test("ToolCallBadge handles empty args without crashing", () => {
  render(
    <ToolCallBadge
      toolInvocation={{ toolCallId: "1", toolName: "str_replace_editor", args: {}, state: "call" }}
    />
  );
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});
