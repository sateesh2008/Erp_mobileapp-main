import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("submitHomework sends the documented student homework payload to the /homework/:id/submit endpoint", async () => {
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
          message: "Homework submitted successfully",
        }),
    };
  };

  try {
    const { homeworkApi } = await import(
      `../src/services/homeworkApi.js?test=${Date.now()}`
    );
    const result = await homeworkApi.submitHomework(89, {
      student_id: 101,
      submission_text:
        "Completed all questions of Exercise 4.2 in the notebook.",
      attachment_url: "uploads/homework_submission_101.pdf",
    });

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/homework\/89\/submit$/);
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      student_id: 101,
      submission_text:
        "Completed all questions of Exercise 4.2 in the notebook.",
      attachment_url: "uploads/homework_submission_101.pdf",
    });
  } finally {
    global.fetch = originalFetch;
  }
});
