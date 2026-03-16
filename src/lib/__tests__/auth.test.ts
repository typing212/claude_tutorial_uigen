// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

const { mockCookieSet, mockCookieGet } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
  mockCookieGet: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockCookieSet, get: mockCookieGet })),
}));

import { createSession, getSession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets a cookie named 'auth-token'", async () => {
    await createSession("user-1", "test@example.com");
    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      expect.any(String),
      expect.any(Object)
    );
  });

  test("cookie token is a valid HS256-signed JWT", async () => {
    await createSession("user-1", "test@example.com");
    const token = mockCookieSet.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload).toBeDefined();
  });

  test("JWT payload contains userId and email", async () => {
    await createSession("user-1", "test@example.com");
    const token = mockCookieSet.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const { expires } = mockCookieSet.mock.calls[0][2];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDays + 1000);
  });

  test("cookie has httpOnly: true", async () => {
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
  });

  test("cookie has path '/'", async () => {
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.path).toBe("/");
  });

  test("cookie has sameSite 'lax'", async () => {
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.sameSite).toBe("lax");
  });

  test("secure is false outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.secure).toBe(false);
    vi.unstubAllEnvs();
  });

  test("secure is true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-1", "test@example.com");
    const options = mockCookieSet.mock.calls[0][2];
    expect(options.secure).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null when cookie value is undefined", async () => {
    mockCookieGet.mockReturnValue({ value: undefined });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockCookieGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 10;
    const token = await new SignJWT({ userId: "1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expiredAt)
      .setIssuedAt()
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("reads the 'auth-token' cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    await getSession();
    expect(mockCookieGet).toHaveBeenCalledWith("auth-token");
  });

  test("returns payload with userId and email for a valid token", async () => {
    const token = await makeToken({ userId: "user-42", email: "hello@example.com" });
    mockCookieGet.mockReturnValue({ value: token });
    const result = await getSession();
    expect(result?.userId).toBe("user-42");
    expect(result?.email).toBe("hello@example.com");
  });

  test("returns payload for a token created by createSession", async () => {
    mockCookieSet.mockImplementation(() => {});
    await createSession("user-99", "round@trip.com");
    const token = mockCookieSet.mock.calls[0][1];

    mockCookieGet.mockReturnValue({ value: token });
    const result = await getSession();
    expect(result?.userId).toBe("user-99");
    expect(result?.email).toBe("round@trip.com");
  });
});
