import { ApiError, apiRequest, isApiConfigured } from "./api";
import {
  attendanceMonthQuery,
  emptyAttendanceSummary,
  normalizeAttendancePayload,
} from "./attendanceNormalization";

const getMonthlyData = async (month, session, studentId, year) => {
  if (!isApiConfigured || !studentId) {
    return { records: [], summary: emptyAttendanceSummary };
  }

  const monthValue = String(month ?? "");
  const monthMatch = monthValue.match(/^(\d{4})-(\d{1,2})$/);
  const requestMonth = monthMatch ? Number(monthMatch[2]) : Number(monthValue);
  const requestYear = monthMatch ? Number(monthMatch[1]) : Number(year);

  if (
    !Number.isInteger(requestMonth) ||
    requestMonth < 1 ||
    requestMonth > 12 ||
    !Number.isInteger(requestYear)
  ) {
    throw new ApiError("Select a valid attendance month and year.", 400);
  }

  const payload = await apiRequest(
    `/parents/child/${encodeURIComponent(String(studentId))}/attendance`,
    {
      token: session?.token,
      query: attendanceMonthQuery(
        `${requestYear}-${String(requestMonth).padStart(2, "0")}`,
      ),
    },
  );

  if (payload?.success === false) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "Unable to load attendance for the selected month.";
    throw new ApiError(message, 200, payload);
  }

  return normalizeAttendancePayload(payload);
};

export const attendanceApi = {
  async getSummary(date, session, studentId) {
    const dateValue = String(date || "");
    return (await getMonthlyData(dateValue.slice(0, 7), session, studentId))
      .summary;
  },

  async getByDate(date, search, session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/attendance/daily", {
      token: session?.token,
      query: { date, search },
    });
    return normalizeAttendancePayload(payload).records;
  },

  async getMonthly(month, session, studentId) {
    return (await getMonthlyData(month, session, studentId)).records;
  },

  async getMonthlyData(month, session, studentId, year) {
    return getMonthlyData(month, session, studentId, year);
  },

  async getHistory(params, session) {
    if (!isApiConfigured)
      return { records: [], summary: emptyAttendanceSummary };
    const payload = await apiRequest("/attendance/history", {
      token: session?.token,
      query: params,
    });
    const normalized = normalizeAttendancePayload(payload);
    return {
      records: normalized.records,
      summary: normalized.summary,
    };
  },

  async getBiometric(params, session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/attendance/biometric", {
      token: session?.token,
      query: params,
    });
    return normalizeAttendancePayload(payload).records;
  },

  async runCutoff(date, session) {
    if (!isApiConfigured) return { processed: 0 };
    return apiRequest("/attendance/cutoff", {
      method: "POST",
      token: session?.token,
      body: { date },
    });
  },

  async submit(records, session) {
    if (!isApiConfigured) return { submitted: 0 };
    return apiRequest("/attendance/submit", {
      method: "POST",
      token: session?.token,
      body: { records },
    });
  },

  async export(params, session) {
    if (!isApiConfigured) return null;
    return apiRequest("/attendance/export", {
      token: session?.token,
      query: params,
    });
  },
};
