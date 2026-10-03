export const emptyAttendanceSummary = {
  totalEnrolled: 0,
  markedEntries: 0,
  presentToday: 0,
  absentCount: 0,
  lateArrivals: 0,
  canMarkAttendance: false,
  daysPresent: 0,
  daysAbsent: 0,
  lateEntries: 0,
  attendanceRate: 0,
};

export const attendanceMonthQuery = (value) => {
  const [year, month] = String(value || "").split("-");
  return { month: Number(month), year: Number(year) };
};

const normalizeDate = (value) => {
  const date = String(value || "").trim();
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dayFirst = date.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }
  return date;
};

const statusFrom = (value) => {
  const status = String(value || "Unmarked")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  if (["p", "present", "on time"].includes(status)) return "Present";
  if (["a", "absent"].includes(status)) return "Absent";
  if (["l", "late", "late arrival"].includes(status)) return "Late";
  if (["hd", "half day"].includes(status)) return "Half Day";
  return status.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const recordsFrom = (payload) => {
  const candidates = [
    payload?.data?.records,
    payload?.data?.attendance,
    payload?.data?.attendance_records,
    payload?.data?.attendanceRecords,
    payload?.data?.logs,
    payload?.data?.data?.records,
    payload?.data?.data?.attendance,
    payload?.data?.data?.attendance_records,
    payload?.records,
    payload?.attendance,
    payload?.attendance_records,
    payload?.logs,
    payload?.data,
    payload,
  ];
  const records = candidates.find(Array.isArray) || [];

  return records.map((record) => {
    const date = normalizeDate(
      record.date ||
        record.attendance_date ||
        record.attendanceDate ||
        record.marked_at ||
        record.created_at,
    );
    return {
      ...record,
      date,
      status: statusFrom(
        record.status ||
          record.attendance_status ||
          record.attendanceStatus ||
          record.status_code,
      ),
      biometricPunch:
        record.biometricPunch ||
        record.biometric_punch ||
        record.punch_time ||
        "",
    };
  });
};

const firstNumber = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return undefined;
};

const summaryFrom = (payload, records) => {
  const summary =
    payload?.data?.summary ||
    payload?.data?.attendance_summary ||
    payload?.data?.attendanceSummary ||
    payload?.summary ||
    payload?.attendance_summary ||
    payload?.attendanceSummary ||
    {};
  const daysPresent =
    firstNumber(summary, [
      "daysPresent",
      "days_present",
      "present",
      "present_count",
      "total_present",
    ]) ?? records.filter((record) => record.status === "Present").length;
  const daysAbsent =
    firstNumber(summary, [
      "daysAbsent",
      "days_absent",
      "absent",
      "absent_count",
      "total_absent",
    ]) ?? records.filter((record) => record.status === "Absent").length;
  const lateEntries =
    firstNumber(summary, [
      "lateEntries",
      "late_entries",
      "late",
      "late_count",
      "total_late",
    ]) ?? records.filter((record) => record.status === "Late").length;
  const total =
    firstNumber(summary, [
      "total",
      "total_days",
      "working_days",
      "school_days",
    ]) ??
    (records.length || daysPresent + daysAbsent + lateEntries);
  const providedRate = firstNumber(summary, [
    "attendanceRate",
    "attendance_rate",
    "attendance_percentage",
    "percentage",
    "rate",
  ]);
  const recordCounts = {
    present: records.filter((record) => record.status === "Present").length,
    absent: records.filter((record) => record.status === "Absent").length,
    late: records.filter((record) => record.status === "Late").length,
  };
  const markedRecordCount =
    recordCounts.present + recordCounts.absent + recordCounts.late;
  const summaryMarkedCount = daysPresent + daysAbsent + lateEntries;
  const recordsShowMoreMarkedDays =
    markedRecordCount > summaryMarkedCount && markedRecordCount <= total;
  const recordsCoverSummary = total > 0 && records.length >= total;
  const useRecordCounts = recordsShowMoreMarkedDays || recordsCoverSummary;
  const resolvedPresent = useRecordCounts ? recordCounts.present : daysPresent;
  const resolvedAbsent = useRecordCounts ? recordCounts.absent : daysAbsent;
  const resolvedLate = useRecordCounts ? recordCounts.late : lateEntries;

  return {
    ...emptyAttendanceSummary,
    ...summary,
    daysPresent: resolvedPresent,
    daysAbsent: resolvedAbsent,
    lateEntries: resolvedLate,
    attendanceRate:
      providedRate === undefined || useRecordCounts
        ? total
          ? Math.round((resolvedPresent / total) * 100)
          : 0
        : providedRate <= 1 && providedRate > 0
          ? Math.round(providedRate * 100)
          : providedRate,
  };
};

export const normalizeAttendancePayload = (payload) => {
  const records = recordsFrom(payload);
  return { records, summary: summaryFrom(payload, records) };
};
