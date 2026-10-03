import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;
const originalDev = global.__DEV__;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

test("getChildProfile uses the selected child endpoint and does not log profile data", async () => {
  const calls = [];
  const logs = [];
  const profile = {
    id: 37,
    first_name: "Sample",
    email: "private@example.com",
    profile_image_url:
      "https://educampus360.com/uploads/sample-profile.png",
  };

  process.env.EXPO_PUBLIC_API_URL = "https://educampus360.com/api";
  global.__DEV__ = true;
  console.info = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), ...options });
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ success: true, data: profile }),
    };
  };

  try {
    const { parentApi } = await import(
      `../src/services/parentApi.js?profile-test=${Date.now()}`
    );
    const result = await parentApi.getChildProfile(37, {
      token: "test-token",
    });

    assert.deepEqual(result, profile);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "https://educampus360.com/api/parents/child/37/profile",
    );
    assert.equal(calls[0].method || "GET", "GET");
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
    assert.equal(
      logs.flat().some((value) =>
        typeof value === "string" && value.includes("private@example.com"),
      ),
      false,
    );
    assert.equal(
      logs.flat().some((value) => value === profile),
      false,
    );
  } finally {
    global.fetch = originalFetch;
    if (originalDev === undefined) delete global.__DEV__;
    else global.__DEV__ = originalDev;
    console.info = originalInfo;
    console.warn = originalWarn;
    if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  }
});
