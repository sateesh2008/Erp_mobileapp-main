import assert from "node:assert/strict";
import test from "node:test";

global.__DEV__ = false;

const originalFetch = global.fetch;

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  text: async () => JSON.stringify(payload),
});

test("teacher attendance submission posts the production attendance payload", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), options };
    return response(201, { message: "Attendance submitted" });
  };

  try {
    const { teacherAttendanceApi } =
      await import("../src/services/teacherApi.js");
    await teacherAttendanceApi.submitAttendance(
      {
        academic_year_id: 1,
        class_id: 2,
        division_id: 2,
        date: "22-09-2026",
        attendanceData: [
          { student_id: 45, status: "Present" },
          { student_id: 46, status: "Half Day" },
        ],
      },
      { token: "teacher-token" },
    );

    assert.equal(request.url, "https://educampus360.com/api/attendance");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.Authorization, "Bearer teacher-token");
    assert.deepEqual(JSON.parse(request.options.body), {
      academic_year_id: 1,
      class_id: 2,
      division_id: 2,
      date: "2026-09-22",
      attendanceData: [
        { student_id: "45", status: "Present" },
        { student_id: "46", status: "Half Day" },
      ],
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("teacher attendance submission preserves the API error message", async () => {
  global.fetch = async () =>
    response(422, { message: "Date is already submitted." });

  try {
    const { teacherAttendanceApi } =
      await import("../src/services/teacherApi.js");
    await assert.rejects(
      teacherAttendanceApi.submitAttendance(
        {
          academic_year_id: 1,
          class_id: 2,
          division_id: 2,
          date: "2026-09-22",
          attendanceData: [{ student_id: "45", status: "Present" }],
        },
        { token: "teacher-token" },
      ),
      (error) =>
        error.message === "Date is already submitted." && error.status === 422,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
