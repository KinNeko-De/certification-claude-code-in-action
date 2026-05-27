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

  // ── Falsy / absent token ──────────────────────────────────────────────────

  test("returns null when no cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  test("returns null when cookie value is undefined", async () => {
    mockCookieGet.mockReturnValue({ value: undefined });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  test("returns null when cookie value is an empty string", async () => {
    mockCookieGet.mockReturnValue({ value: "" });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  // ── Valid token — payload correctness ─────────────────────────────────────

  test("returns correct userId for a valid token", async () => {
    const token = await new SignJWT({ userId: "user-42", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    expect((await getSession())?.userId).toBe("user-42");
  });

  test("returns correct email for a valid token", async () => {
    const token = await new SignJWT({ userId: "user-42", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    expect((await getSession())?.email).toBe("test@example.com");
  });

  test("preserves expiresAt in the returned payload", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await new SignJWT({ userId: "u", email: "e@e.com", expiresAt: expiresAt.toISOString() })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    expect((await getSession())?.expiresAt).toBeDefined();
  });

  test("returns payload with extra custom fields preserved", async () => {
    const token = await new SignJWT({ userId: "u", email: "e@e.com", role: "admin", tier: 3 })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    const result = await getSession() as unknown as Record<string, unknown>;
    expect(result?.role).toBe("admin");
    expect(result?.tier).toBe(3);
  });

  // ── Invalid tokens ────────────────────────────────────────────────────────

  test("returns null for a completely malformed token", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-valid-jwt" });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  test("returns null for a base64 string that is not a JWT", async () => {
    const fakeToken = Buffer.from(JSON.stringify({ userId: "u" })).toString("base64");
    mockCookieGet.mockReturnValue({ value: fakeToken });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(wrongSecret);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  // ── Cookie identification ─────────────────────────────────────────────────

  test("looks up exactly the auth-token cookie by name", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");
    await getSession();
    expect(mockCookieGet).toHaveBeenCalledWith("auth-token");
  });

  test("does not use a valid token stored under a different cookie name", async () => {
    const token = await new SignJWT({ userId: "u", email: "e@e.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockImplementation((name: string) =>
      name === "other-cookie" ? { value: token } : undefined
    );
    const { getSession } = await import("@/lib/auth");
    expect(await getSession()).toBeNull();
  });

  // ── JWT secret consistency ────────────────────────────────────────────────

  test("can read a session token produced by createSession", async () => {
    const { createSession, getSession } = await import("@/lib/auth");
    await createSession("user-round", "round@example.com");
    const token = mockCookieSet.mock.calls[0][1] as string;
    mockCookieGet.mockReturnValue({ value: token });
    const result = await getSession();
    expect(result?.userId).toBe("user-round");
    expect(result?.email).toBe("round@example.com");
  });

  // ── Async behavior ────────────────────────────────────────────────────────

  test("returns a Promise", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { getSession } = await import("@/lib/auth");
    const result = getSession();
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  // ── Error handling ────────────────────────────────────────────────────────

  test("resolves to null rather than rejecting when jwtVerify throws", async () => {
    mockCookieGet.mockReturnValue({ value: "header.payload.badsig" });
    const { getSession } = await import("@/lib/auth");
    await expect(getSession()).resolves.toBeNull();
  });

  test("returns partial payload when token is missing expected claims", async () => {
    const token = await new SignJWT({ userId: "partial-user" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(JWT_SECRET);
    mockCookieGet.mockReturnValue({ value: token });
    const { getSession } = await import("@/lib/auth");
    const result = await getSession();
    expect(result?.userId).toBe("partial-user");
    expect(result?.email).toBeUndefined();
  });
});
