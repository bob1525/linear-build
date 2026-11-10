import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-accounts";
import { createProjectSchema, firstIssue, loginSchema, signupSchema, suggestProjectKey } from "@/lib/validators";

describe("suggestProjectKey", () => {
  it("builds a short key from one or more words", () => {
    expect(suggestProjectKey("Orbit")).toBe("ORB");
    expect(suggestProjectKey("pulse")).toBe("PUL");
    expect(suggestProjectKey("My Project")).toBe("MP");
    expect(suggestProjectKey("Atlas platform team")).toBe("APT");
    expect(suggestProjectKey("!!!")).toBe("");
  });
});

describe("auth schemas", () => {
  it("accepts the demo password and normalizes email", () => {
    const parsed = loginSchema.parse({ email: "  Ava@Northstar.dev ", password: DEMO_PASSWORD });
    expect(parsed.email).toBe("ava@northstar.dev");
    expect(DEMO_USERS.map((user) => user.email)).toEqual([
      "ava@northstar.dev",
      "marcus@northstar.dev",
      "priya@northstar.dev",
      "leo@northstar.dev",
    ]);
  });

  it("rejects a short signup password and a mismatched confirmation", () => {
    const short = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(short.success).toBe(false);
    if (!short.success) expect(firstIssue(short.error)).toMatch(/8 characters/);

    const mismatch = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "password123",
      confirmPassword: "password456",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(firstIssue(mismatch.error)).toBe("Passwords do not match");
  });
});

describe("createProjectSchema", () => {
  it("uppercases a valid key and rejects a one-character key", () => {
    expect(createProjectSchema.parse({ name: "Launchpad", key: "lnp" }).key).toBe("LNP");
    const invalid = createProjectSchema.safeParse({ name: "Launchpad", key: "L" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(firstIssue(invalid.error)).toMatch(/2–5/);
  });
});
