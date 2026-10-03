import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = global.fetch;

test("teacher dashboard reads server-provided aggregate metrics before fallback values", async () => {
  global.fetch = async (url) => {
    const target = String(url);

    if (target.includes("/teacher/dashboard")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          data: {
            activeLoad: 7,
            totalStudents: 248,
            attendancePercentage: 94,
            pendingMarks: 13,
            weeklyAttendance: [
              { day: "Mon", value: 90 },
              { day: "Tue", value: 92 },
              { day: "Wed", value: 95 },
            ],
          },
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Not found" }),
    };
  };

  try {
    const { teacherApi } = await import("../src/services/teacherApi.js");
    const result = await teacherApi.getDashboard({ token: "demo" });

    assert.equal(result.dashboardData.activeLoad, 7);
    assert.equal(result.dashboardData.totalStudents, 248);
    assert.equal(result.dashboardData.attendancePercentage, 94);
    assert.equal(result.dashboardData.pendingMarks, 13);
    assert.equal(result.attendanceWeekly.length, 3);
  } finally {
    global.fetch = originalFetch;
  }
});
