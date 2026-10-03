import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("teacher leave createLeaveRequest posts the documented backend payload", async () => {
  const calls = [];
  process.env.EXPO_PUBLIC_API_URL = "http://localhost:8081/api";
  global.fetch = async (url, options) => {
    calls.push({
      url: String(url),
      method: options?.method,
      body: options?.body ? JSON.parse(options.body) : null,
    });

    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () =>
        JSON.stringify({
          success: true,
          message: "Leave application submitted to administrator",
        }),
    };
  };

  try {
    const { teacherApi } = await import(
      `../src/services/teacherApi.js?test=${Date.now()}`
    );
    const result = await teacherApi.createLeaveRequest(
      {
        category: "Casual Leave",
        from: "2026-09-25",
        to: "2026-09-25",
        reason: "Personal family commitment",
      },
      { token: "demo-token" },
    );

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/leaves\/apply$/);
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      leave_type: "Casual Leave",
      start_date: "2026-09-25",
      end_date: "2026-09-25",
      reason: "Personal family commitment",
    });
  } finally {
    global.fetch = originalFetch;
  }
});
