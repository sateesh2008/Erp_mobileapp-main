import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("teacher exam attendance history returns empty structured data when the backend route is missing", async () => {
  global.fetch = async () => ({
    ok: false,
    status: 404,
    headers: { get: () => "application/json" },
    json: async () => ({
      message: "The requested API endpoint was not found.",
    }),
  });

  try {
    const { teacherApi } = await import("../src/services/teacherApi.js");
    const result = await teacherApi.getExamAttendanceHistory(
      { examId: 13, classId: "class-1", divisionId: "" },
      null,
    );

    assert.deepEqual(result, { subjects: [], students: [], audit: [] });
  } finally {
    global.fetch = originalFetch;
  }
});
