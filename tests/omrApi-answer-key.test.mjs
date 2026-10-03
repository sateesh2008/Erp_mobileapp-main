import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("saveAnswerKey posts the OMR answer key to /omr/sessions/:id/answer-key with the expected keys array", async () => {
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
          message: "Answer key updated successfully",
        }),
    };
  };

  try {
    const { omrApi } = await import(
      `../src/services/omrApi.js?test=${Date.now()}`
    );
    const result = await omrApi.saveAnswerKey(15, [
      { question_no: 1, correct_option: "A", marks: 1.0, negative_marks: 0.25 },
      { question_no: 2, correct_option: "C", marks: 1.0, negative_marks: 0.25 },
      { question_no: 3, correct_option: "D", marks: 1.0, negative_marks: 0.25 },
    ]);

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/omr\/sessions\/15\/answer-key$/);
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      keys: [
        {
          question_no: 1,
          correct_option: "A",
          marks: 1.0,
          negative_marks: 0.25,
        },
        {
          question_no: 2,
          correct_option: "C",
          marks: 1.0,
          negative_marks: 0.25,
        },
        {
          question_no: 3,
          correct_option: "D",
          marks: 1.0,
          negative_marks: 0.25,
        },
      ],
    });
  } finally {
    global.fetch = originalFetch;
  }
});
