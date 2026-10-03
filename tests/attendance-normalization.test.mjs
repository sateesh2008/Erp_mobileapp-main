import assert from "node:assert/strict";
import test from "node:test";

const { attendanceMonthQuery, normalizeAttendancePayload } =
  await import("../src/services/attendanceNormalization.js");

test("builds the parent attendance query expected by the backend", () => {
  assert.deepEqual(attendanceMonthQuery("2026-09"), {
    month: 9,
    year: 2026,
  });
});

test("normalizes parent attendance wrappers, dates, and status codes", () => {
  const result = normalizeAttendancePayload({
    data: {
      attendance: [
        { id: 1, attendance_date: "16/09/2026", attendance_status: "A" },
        { id: 2, date: "2026-09-15T00:00:00.000Z", status: "P" },
      ],
      attendance_summary: {
        total_days: "4",
        days_present: "2",
        days_absent: "2",
        attendance_percentage: "50",
      },
    },
  });

  assert.deepEqual(
    result.records.map(({ date, status }) => ({ date, status })),
    [
      { date: "2026-09-16", status: "Absent" },
      { date: "2026-09-15", status: "Present" },
    ],
  );
  assert.equal(result.summary.daysPresent, 2);
  assert.equal(result.summary.daysAbsent, 2);
  assert.equal(result.summary.attendanceRate, 50);
});

test("derives attendance summary from normalized records when no summary is provided", () => {
  const result = normalizeAttendancePayload({
    records: [
      { date: "2026-09-16", status: "present" },
      { date: "16/09/2026", status: "absent" },
    ],
  });

  assert.equal(result.summary.daysPresent, 1);
  assert.equal(result.summary.daysAbsent, 1);
  assert.equal(result.summary.attendanceRate, 50);
});

test("uses marked records when the API summary reports zero counts for those records", () => {
  const result = normalizeAttendancePayload({
    data: {
      records: [{ attendance_date: "2026-08-20", attendance_status: "Absent" }],
      summary: {
        total: 1,
        present: 0,
        absent: 0,
        late: 0,
        attendance_rate: 0,
      },
    },
  });

  assert.equal(result.records[0].status, "Absent");
  assert.equal(result.summary.daysPresent, 0);
  assert.equal(result.summary.daysAbsent, 1);
  assert.equal(result.summary.attendanceRate, 0);
});

test("preserves API summary counts when they cover more days than returned logs", () => {
  const result = normalizeAttendancePayload({
    data: {
      records: [
        { attendance_date: "2026-08-20", attendance_status: "Present" },
      ],
      summary: {
        total: 20,
        present: 10,
        absent: 2,
        late: 0,
        attendance_rate: 50,
      },
    },
  });

  assert.equal(result.summary.daysPresent, 10);
  assert.equal(result.summary.daysAbsent, 2);
  assert.equal(result.summary.attendanceRate, 50);
});

test("uses a complete set of records when its statuses conflict with the API summary", () => {
  const result = normalizeAttendancePayload({
    data: {
      records: [
        { attendance_date: "2026-09-20", attendance_status: "Present" },
      ],
      summary: {
        total: 1,
        present: 0,
        absent: 1,
        late: 0,
        attendance_rate: 0,
      },
    },
  });

  assert.equal(result.summary.daysPresent, 1);
  assert.equal(result.summary.daysAbsent, 0);
  assert.equal(result.summary.attendanceRate, 100);
});
