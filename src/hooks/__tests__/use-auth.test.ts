import { test, expect, vi, afterEach, beforeEach, describe } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no anon work, no projects
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-project-123" } as any);
});

afterEach(() => {
  cleanup();
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

describe("useAuth — signIn", () => {
  test("sets isLoading to true while signing in, then false after", async () => {
    let resolveSignIn!: (value: any) => void;
    mockSignIn.mockReturnValue(
      new Promise((res) => {
        resolveSignIn = res;
      }) as any
    );

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signIn("user@test.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the signIn action", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" } as any);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@test.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("does not navigate when sign in fails", async () => {
    mockSignIn.mockResolvedValue({ success: false } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "wrong");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false even when signIn action throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — signIn post-login routing (anon work)", () => {
  test("migrates anon work to a new project and navigates to it", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": { type: "directory" } },
    });
    mockCreateProject.mockResolvedValue({ id: "migrated-project-42" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/": { type: "directory" } },
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/migrated-project-42");
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  test("does not migrate anon work when messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [],
      fileSystemData: {},
    });
    mockGetProjects.mockResolvedValue([{ id: "existing-project-1" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password");
    });

    expect(mockCreateProject).not.toHaveBeenCalledWith(
      expect.objectContaining({ messages: [] })
    );
    expect(mockPush).toHaveBeenCalledWith("/existing-project-1");
  });

  test("does not migrate when getAnonWorkData returns null", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([{ id: "existing-project-1" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password");
    });

    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-project-1");
  });
});

describe("useAuth — signIn post-login routing (no anon work)", () => {
  test("navigates to the most recent project when one exists", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([
      { id: "recent-project" },
      { id: "older-project" },
    ] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-project");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  test("creates a new project and navigates to it when no projects exist", async () => {
    mockSignIn.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
  });
});

describe("useAuth — signUp", () => {
  test("sets isLoading to true while signing up, then false after", async () => {
    let resolveSignUp!: (value: any) => void;
    mockSignUp.mockReturnValue(
      new Promise((res) => {
        resolveSignUp = res;
      }) as any
    );

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signUp("new@test.com", "password");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false });
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from the signUp action", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email taken" } as any);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("taken@test.com", "password");
    });

    expect(returnValue).toEqual({ success: false, error: "Email taken" });
  });

  test("does not navigate when sign up fails", async () => {
    mockSignUp.mockResolvedValue({ success: false } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false even when signUp action throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("migrates anon work after successful sign up", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "create a button" }],
      fileSystemData: { "/": { type: "directory" }, "/App.jsx": { type: "file" } },
    });
    mockCreateProject.mockResolvedValue({ id: "signup-migrated-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "create a button" }],
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-migrated-project");
  });

  test("navigates to most recent project after successful sign up with no anon work", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([{ id: "user-existing-project" }] as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password");
    });

    expect(mockPush).toHaveBeenCalledWith("/user-existing-project");
  });

  test("creates new project after successful sign up when no projects exist", async () => {
    mockSignUp.mockResolvedValue({ success: true } as any);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-project" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/fresh-project");
  });
});
