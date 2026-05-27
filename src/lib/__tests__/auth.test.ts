// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieGet = vi.fn();
const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockCookieGet, set: mockCookieSet })),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    mockCookieGet.mockClear();
    mockCookieSet.mockClear();
    vi.unstubAllEnvs();
  });

  test("sets auth-token cookie", async () => {
    const { createSession } = await import("@/lib/auth");

    await createSession("user-1", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledOnce();
    expect(mockCookieSet.mock.calls[0][0]).toBe("auth-token");
  });

  test("JWT payload contains userId and email", async () => {
    const { createSession } = await import("@/lib/auth");

    await createSession("user-42", "test@example.com");

    const token = mockCookieSet.mock.calls[0][1] as string;
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("test@example.com");
  });

  test("cookie has httpOnly, sameSite lax, path /", async () => {
    const { createSession } = await import("@/lib/auth");

    await createSession("user-1", "user@example.com");

    const options = mockCookieSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const { createSession } = await import("@/lib/auth");
    const before = Date.now();

    await createSession("user-1", "user@example.com");

    const after = Date.now();
    const options = mockCookieSet.mock.calls[0][2] as Record<string, unknown>;
    const expires = (options.expires as Date).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("secure is false outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { createSession } = await import("@/lib/auth");

    await createSession("user-1", "user@example.com");

    const options = mockCookieSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.secure).toBe(false);
  });

  test("secure is true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { createSession } = await import("@/lib/auth");

    await createSession("user-1", "user@example.com");

    const options = mockCookieSet.mock.calls[0][2] as Record<string, unknown>;
    expect(options.secure).toBe(true);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    mockCookieGet.mockClear();
    mockCookieSet.mockClear();
  });

  test("returns null when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns SessionPayload with correct userId and email for a valid token", async () => {
    const token = await new SignJWT({ userId: "user-42", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");

    const result = await getSession();

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-42");
    expect(result?.email).toBe("test@example.com");
  });

  test("returns null for a malformed token", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-valid-jwt" });
    const { getSession } = await import("@/lib/auth");

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");

    const result = await getSession();

    expect(result).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");

    const result = await getSession();

    expect(result).toBeNull();
  });
});
