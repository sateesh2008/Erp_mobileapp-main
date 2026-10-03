import { apiRequest, isApiConfigured } from "./api.js";

let localHomework = [];
let localSubmissions = {};
let localLeaveRequests = [];

const normalizePayrollStatus = (status) => {
  const normalized = String(status || "Unmarked")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (normalized === "not marked" || normalized === "unmarked")
    return "Unmarked";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const formatDateForPayrollApi = (dateValue) => {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime()))
      throw new Error("Attendance date is invalid.");
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const value = String(dateValue).trim();
  let year;
  let month;
  let day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    [, year, month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  } else {
    const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match)
      throw new Error(
        "Attendance date must use DD-MM-YYYY or YYYY-MM-DD format.",
      );
    [, day, month, year] = match;
  }

  const calendarDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    calendarDate.getFullYear() !== Number(year) ||
    calendarDate.getMonth() !== Number(month) - 1 ||
    calendarDate.getDate() !== Number(day)
  ) {
    throw new Error("Attendance date is invalid.");
  }

  return `${year}-${month}-${day}`;
};

const payrollDateKeys = [
  "date",
  "attendance_date",
  "from",
  "to",
  "fromDate",
  "toDate",
  "startDate",
  "endDate",
  "from_date",
  "to_date",
  "start_date",
  "end_date",
];

const normalizePayrollDateFields = (value) => {
  if (!value || typeof value !== "object") return value;
  const normalized = { ...value };
  payrollDateKeys.forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(normalized, key) &&
      normalized[key]
    ) {
      normalized[key] = formatDateForPayrollApi(normalized[key]);
    }
  });
  return normalized;
};

const normalizePayrollDateParams = (params = {}) =>
  normalizePayrollDateFields(params);

const normalizePayrollRecord = (record) => ({
  ...record,
  id:
    record.id ||
    record.attendance_id ||
    record.attendanceId ||
    record.student_id ||
    record.staff_id,
  name:
    record.name ||
    record.student_name ||
    record.studentName ||
    record.staff_name ||
    record.staffName ||
    [record.first_name, record.last_name].filter(Boolean).join(" ") ||
    [record.firstName, record.lastName].filter(Boolean).join(" ") ||
    "Unnamed student",
  roll:
    record.roll ||
    record.roll_number ||
    record.rollNumber ||
    record.roll_no ||
    record.rollNo ||
    "",
  admissionNumber:
    record.admissionNumber ||
    record.admission_number ||
    record.admissionNo ||
    record.admission_no ||
    record.admin_no ||
    "",
  studentId:
    record.studentId ||
    record.student_id ||
    record.id ||
    record.studentId ||
    "",
  className:
    record.className ||
    record.class_name ||
    record.class ||
    record.className ||
    "",
  section:
    record.section ||
    record.division ||
    record.division_name ||
    record.section_name ||
    "",
  status: normalizePayrollStatus(
    record.status || record.attendance_status || record.attendanceStatus,
  ),
  punchIn: record.punchIn || record.punch_in || record.check_in || "",
  punchOut: record.punchOut || record.punch_out || record.check_out || "",
  entrySource: record.source || record.entry_source || "Manual",
});

const normalizePayrollRecords = (payload) => {
  const records =
    payload?.data?.records ||
    payload?.records ||
    payload?.data?.attendance ||
    payload?.attendance ||
    payload?.data?.students ||
    payload?.students ||
    payload?.data ||
    payload?.results ||
    payload ||
    [];
  return (Array.isArray(records) ? records : []).map(normalizePayrollRecord);
};

const normalizePayrollAttendance = (payload) => ({
  ...(payload?.data && !Array.isArray(payload.data)
    ? payload.data
    : payload && !Array.isArray(payload)
      ? payload
      : {}),
  records: normalizePayrollRecords(payload),
  classes: payload?.classes || payload?.data?.classes || [],
  sections: payload?.sections || payload?.data?.sections || [],
  subjects: payload?.subjects || payload?.data?.subjects || [],
});

const payloadItems = (payload, keys = []) => {
  const candidates = [
    payload,
    payload?.data,
    ...keys.map((key) => payload?.[key]),
    ...keys.map((key) => payload?.data?.[key]),
  ];
  return candidates.find((value) => Array.isArray(value)) || [];
};

const formatIsoDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeFilterOption = (item, index) => {
  if (typeof item === "string" || typeof item === "number") {
    return { id: String(item), label: String(item), name: String(item) };
  }
  const id =
    item?.id ?? item?.class_id ?? item?.division_id ?? item?.value ?? index;
  const label =
    item?.name ||
    item?.label ||
    item?.class_name ||
    item?.division_name ||
    item?.title ||
    String(id);
  return { ...item, id: String(id), label: String(label), name: String(label) };
};

const normalizeAssignedFilters = (payload) => {
  const source =
    payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  const assignments = payloadItems(source, [
    "assigned_classes_divisions",
    "assignments",
  ]);
  const classes = payloadItems(source, [
    "classes",
    "assigned_classes",
    "academic_classes",
  ]).map(normalizeFilterOption);
  const sections = payloadItems(source, [
    "divisions",
    "sections",
    "assigned_divisions",
    "academic_divisions",
  ]).map(normalizeFilterOption);
  if (!classes.length && assignments.length) {
    classes.push(
      ...assignments.map((item, index) =>
        normalizeFilterOption(
          {
            id: item?.class_id || item?.class?.id,
            name: item?.class_name || item?.class?.name,
          },
          index,
        ),
      ),
    );
  }
  if (!sections.length && assignments.length) {
    sections.push(
      ...assignments.map((item, index) =>
        normalizeFilterOption(
          {
            id: item?.division_id || item?.division?.id || item?.section_id,
            name:
              item?.division_name || item?.division?.name || item?.section_name,
          },
          index,
        ),
      ),
    );
  }
  return { classes, sections };
};

const attendanceQuery = ({
  date,
  classId,
  divisionId,
  className,
  section,
} = {}) =>
  normalizePayrollDateParams({
    date,
    classId: classId || className,
    divisionId: divisionId || section,
  });

const logApi = (method, path, details) => {
  if (__DEV__) console.debug(`[attendance] ${method} ${path}`, details || "");
};

const buildFallbackTeacher = (session) => {
  const rawName =
    session?.user?.name ||
    session?.user?.full_name ||
    session?.name ||
    session?.user?.username ||
    "Teacher";
  const teacherName = typeof rawName === "string" ? rawName : "Teacher";
  const initials =
    teacherName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "T";

  return {
    name: teacherName,
    initials,
    role: session?.role || "Teacher",
    school:
      session?.schoolName ||
      session?.user?.tenant?.school_name ||
      session?.tenant?.school_name ||
      "",
    academicYear: "",
  };
};

const coerceNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const extractMetric = (source, keys = [], fallback = 0) => {
  if (!source || typeof source !== "object") return fallback;

  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return coerceNumber(value, fallback);
    }

    const nested = key
      .split(".")
      .reduce((result, segment) => result?.[segment], source);
    if (nested !== undefined && nested !== null && nested !== "") {
      return coerceNumber(nested, fallback);
    }
  }

  return fallback;
};

const normalizeWeeklyChart = (value) => {
  if (!value) return [];
  const arrayValue = Array.isArray(value)
    ? value
    : Array.isArray(value?.data)
      ? value.data
      : Array.isArray(value?.weekly)
        ? value.weekly
        : Array.isArray(value?.attendance)
          ? value.attendance
          : [];

  return arrayValue.map((entry, index) => ({
    key: entry?.key || entry?.day || entry?.label || `day-${index}`,
    day: entry?.day || entry?.label || entry?.name || `Day ${index + 1}`,
    value: coerceNumber(
      entry?.value ??
        entry?.attendance ??
        entry?.attendancePercentage ??
        entry?.percentage ??
        entry?.percent ??
        entry?.presentPercent ??
        0,
      0,
    ),
  }));
};

const extractDashboardMetrics = (payload) => {
  const source =
    payload?.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
      ? payload.data
      : payload?.dashboard || payload?.stats || payload || {};

  const activeLoad = extractMetric(
    source,
    [
      "activeLoad",
      "active_load",
      "assignedClasses",
      "assigned_classes",
      "totalClasses",
      "total_classes",
      "classCount",
      "class_count",
      "classesTotal",
      "classes_total",
    ],
    0,
  );

  const totalStudents = extractMetric(
    source,
    [
      "totalStudents",
      "total_students",
      "students",
      "studentCount",
      "student_count",
      "mentoredStudents",
      "mentored_students",
      "studentsCount",
      "students_count",
    ],
    0,
  );

  const attendancePercentage = extractMetric(
    source,
    [
      "attendancePercentage",
      "attendance_percentage",
      "attendancePercent",
      "attendance_percent",
      "avgAttendance",
      "avg_attendance",
      "attendance",
    ],
    0,
  );

  const pendingMarks = extractMetric(
    source,
    [
      "pendingMarks",
      "pending_marks",
      "marksPending",
      "marks_pending",
      "pendingMarksCount",
      "pending_marks_count",
      "gradeAudit",
    ],
    0,
  );

  return {
    activeLoad,
    totalStudents,
    attendancePercentage,
    pendingMarks,
    weeklyAttendance: normalizeWeeklyChart(
      source?.weeklyAttendance ||
        source?.attendanceWeekly ||
        source?.chart ||
        source?.attendance_chart ||
        source?.weekly ||
        source?.attendance,
    ),
  };
};

export const teacherApi = {
  async getDashboard(session) {
    const fallbackTeacher = buildFallbackTeacher(session);

    if (!isApiConfigured) {
      return {
        teacher: fallbackTeacher,
        dashboardData: {},
        dashboardStats: {},
        attendanceWeekly: [],
        quickActions: [],
        shortcuts: [],
        notices: [],
        modules: [],
        assignedClasses: [],
        attendance: [],
        homework: [],
        timetable: [],
        exams: [],
      };
    }

    let currentStaff = {};
    try {
      const staffPayload = await apiRequest("/staff", {
        token: session?.token,
      });
      const staff =
        staffPayload?.data ||
        staffPayload?.staff ||
        staffPayload?.results ||
        [];
      const staffList = Array.isArray(staff) ? staff : [staff];
      currentStaff =
        staffList.find((member) => {
          const idMatches =
            session?.id !== undefined &&
            session?.id !== null &&
            [
              member?.id,
              member?.teacher_id,
              member?.teacherId,
              member?.staff_id,
              member?.staffId,
              member?.employee_id,
              member?.employeeId,
            ].includes(session.id);
          const emailMatches =
            Boolean(session?.email) &&
            [
              member?.email,
              member?.user_email,
              member?.staff_email,
              member?.teacher_email,
            ].includes(session.email);
          const nameMatches =
            Boolean(session?.name) &&
            [
              member?.name,
              member?.full_name,
              member?.teacher_name,
              member?.staff_name,
            ].includes(session.name);
          return idMatches || emailMatches || nameMatches;
        }) ||
        staffList[0] ||
        {};
    } catch {
      currentStaff = {};
    }

    const today = new Date().toISOString().slice(0, 10);
    const teacherName =
      currentStaff?.name ||
      currentStaff?.full_name ||
      currentStaff?.teacher_name ||
      session?.user?.name ||
      session?.user?.full_name ||
      session?.name ||
      fallbackTeacher.name;
    const schoolName =
      currentStaff?.school_name ||
      currentStaff?.school?.name ||
      session?.user?.tenant?.school_name ||
      session?.tenant?.school_name ||
      fallbackTeacher.school;

    let directDashboard = {};
    const dashboardCandidates = [
      "/teacher/dashboard",
      "/dashboard",
      "/teacher/portal",
      "/teacher/home",
    ];

    const dashboardResults = await Promise.allSettled(
      dashboardCandidates.map((path) =>
        apiRequest(path, { token: session?.token }),
      ),
    );

    const dashboardMatch = dashboardResults.findLast(
      (result) => result.status === "fulfilled" && result.value,
    );
    if (dashboardMatch?.status === "fulfilled") {
      directDashboard = dashboardMatch.value;
    }

    const dashboardMetrics = extractDashboardMetrics(directDashboard);

    const [
      assignedResult,
      announcementsResult,
      holidayResult,
      timetableResult,
      homeworkResult,
      examResult,
    ] = await Promise.allSettled([
      apiRequest("/attendance/assigned-classes-divisions", {
        token: session?.token,
      }),
      apiRequest("/announcements", { token: session?.token }),
      apiRequest("/holidays", { token: session?.token }),
      apiRequest("/timetable/teacher", { token: session?.token }),
      apiRequest("/homework", { token: session?.token }),
      apiRequest("/exams", { token: session?.token }),
    ]);

    const assignedPayload =
      assignedResult.status === "fulfilled"
        ? assignedResult.value?.data || assignedResult.value || []
        : [];
    const assignments = Array.isArray(assignedPayload)
      ? assignedPayload
      : Array.isArray(assignedPayload?.assignments)
        ? assignedPayload.assignments
        : Array.isArray(assignedPayload?.records)
          ? assignedPayload.records
          : [];

    const uniqueClassAssignments = new Map();
    assignments.forEach((item) => {
      const classId = item?.class_id ?? item?.classId ?? item?.class ?? "all";
      const className =
        item?.class_name || item?.className || item?.className || "All Classes";
      const divisionId =
        item?.division_id ?? item?.divisionId ?? item?.section_id ?? "all";
      const divisionName =
        item?.division_name ||
        item?.divisionName ||
        item?.section_name ||
        item?.section ||
        "All Divisions";
      const subjectId = item?.subject_id ?? item?.subjectId ?? "";
      const subjectName =
        item?.subject_name || item?.subjectName || item?.subject || "";
      const key = `${String(classId)}|${String(divisionId)}|${String(subjectId)}|${String(subjectName)}`;
      if (!uniqueClassAssignments.has(key)) {
        uniqueClassAssignments.set(key, {
          classId,
          className,
          divisionId,
          divisionName,
          subjectId,
          subjectName,
        });
      }
    });

    const uniqueClasses = new Set(
      assignments.map((item) =>
        String(
          item?.class_id ??
            item?.classId ??
            item?.class_name ??
            item?.className ??
            item?.class ??
            "all",
        ),
      ),
    );

    const firstAssignment = assignments[0] || {};
    const firstClassId = firstAssignment.class_id ?? firstAssignment.classId;
    const firstDivisionId =
      firstAssignment.division_id ?? firstAssignment.divisionId;
    const attendancePayload = firstClassId
      ? await apiRequest("/attendance", {
          token: session?.token,
          query: {
            class_id: firstClassId,
            division_id: firstDivisionId,
            date: today,
          },
        }).catch(() => null)
      : null;

    const attendanceStudents =
      attendancePayload?.data?.students || attendancePayload?.students || [];
    const attendanceTotal = Array.isArray(attendanceStudents)
      ? attendanceStudents.length
      : 0;
    const presentCount = Array.isArray(attendanceStudents)
      ? attendanceStudents.filter(
          (student) =>
            String(student?.status || "").toLowerCase() === "present",
        ).length
      : 0;
    const attendancePercentage = attendanceTotal
      ? Math.round((presentCount / attendanceTotal) * 100)
      : 0;
    let normalizedAttendanceSeries = Array.isArray(
      attendancePayload?.data?.weekly,
    )
      ? attendancePayload.data.weekly.map((entry, index) => ({
          key: entry?.key || entry?.day || `week-${index}`,
          day: entry?.day || entry?.label || `Day ${index + 1}`,
          value:
            Number(
              entry?.value ??
                entry?.percent ??
                entry?.percentage ??
                entry?.attendance ??
                entry?.attendancePercentage ??
                entry?.presentPercent ??
                0,
            ) || 0,
        }))
      : Array.isArray(attendancePayload?.weekly)
        ? attendancePayload.weekly.map((entry, index) => ({
            key: entry?.key || entry?.day || `week-${index}`,
            day: entry?.day || entry?.label || `Day ${index + 1}`,
            value:
              Number(
                entry?.value ??
                  entry?.percent ??
                  entry?.percentage ??
                  entry?.attendance ??
                  entry?.attendancePercentage ??
                  entry?.presentPercent ??
                  0,
              ) || 0,
          }))
        : [];

    const homeworkPayload =
      homeworkResult.status === "fulfilled"
        ? homeworkResult.value?.data || homeworkResult.value || []
        : [];
    const homeworkRecords = Array.isArray(homeworkPayload)
      ? homeworkPayload
      : homeworkPayload?.homework || homeworkPayload?.assignments || [];

    const timetablePayload =
      timetableResult.status === "fulfilled"
        ? timetableResult.value?.data || timetableResult.value || []
        : [];
    const timetableRecords = Array.isArray(timetablePayload)
      ? timetablePayload
      : timetablePayload?.timetable || timetablePayload?.records || [];

    const holidayPayload =
      holidayResult.status === "fulfilled"
        ? holidayResult.value?.data || holidayResult.value || []
        : [];
    const holidayRecords = Array.isArray(holidayPayload)
      ? holidayPayload
      : holidayPayload?.holidays || [];

    const announcementPayload =
      announcementsResult.status === "fulfilled"
        ? announcementsResult.value
        : null;
    const announcementRecords =
      announcementPayload?.announcements ||
      announcementPayload?.data?.announcements ||
      announcementPayload?.data?.data ||
      announcementPayload?.data ||
      announcementPayload ||
      [];
    const facultyAnnouncements = (
      Array.isArray(announcementRecords) ? announcementRecords : []
    ).map((announcement) => ({
      id: announcement?.id || announcement?.announcement_id,
      category: announcement?.type || announcement?.category || "Announcement",
      date:
        announcement?.created_at ||
        announcement?.date ||
        announcement?.createdAt ||
        "",
      title: announcement?.title || announcement?.subject || "Announcement",
      description:
        announcement?.message ||
        announcement?.content ||
        announcement?.description ||
        "",
      priority: announcement?.priority || "Normal",
    }));

    const examPayload =
      examResult.status === "fulfilled"
        ? examResult.value?.data?.data ||
          examResult.value?.data ||
          examResult.value?.exams ||
          examResult.value?.results ||
          examResult.value ||
          []
        : [];
    const examRecords = Array.isArray(examPayload)
      ? examPayload
      : examPayload?.records || [];

    const attendanceHistoryResult = firstClassId
      ? await apiRequest("/attendance/history", {
          token: session?.token,
          query: {
            classId: firstClassId,
            divisionId: firstDivisionId,
            startDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
            endDate: today,
            page: 1,
            limit: 20,
          },
        }).catch(() => null)
      : null;
    const attendanceHistoryPayload =
      attendanceHistoryResult?.data ||
      attendanceHistoryResult?.records ||
      attendanceHistoryResult ||
      [];
    const attendanceHistoryRecords = Array.isArray(attendanceHistoryPayload)
      ? attendanceHistoryPayload
      : attendanceHistoryPayload?.data ||
        attendanceHistoryPayload?.records ||
        [];
    const historyByDate = new Map();
    attendanceHistoryRecords.forEach((record) => {
      const rawDate =
        record?.date ||
        record?.attendance_date ||
        record?.attendanceDate ||
        record?.created_at?.slice(0, 10) ||
        today;
      const current = historyByDate.get(rawDate) || { total: 0, present: 0 };
      current.total += 1;
      const status = String(record?.status || "").toLowerCase();
      if (
        ["present", "marked present", "p"].includes(status) ||
        (status.includes("present") && !status.includes("absent"))
      ) {
        current.present += 1;
      }
      historyByDate.set(rawDate, current);
    });
    const recentDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });
    const derivedWeeklyAttendance = recentDates.map((date, index) => {
      const summary = historyByDate.get(date) || { total: 0, present: 0 };
      const percentage = summary.total
        ? Math.round((summary.present / summary.total) * 100)
        : 0;
      const formattedDay = new Date(`${date}T00:00:00`).toLocaleDateString(
        "en-US",
        {
          weekday: "short",
        },
      );
      return {
        key: `day-${index}-${date}`,
        day: formattedDay,
        value: percentage,
      };
    });
    if (!normalizedAttendanceSeries.length) {
      normalizedAttendanceSeries =
        derivedWeeklyAttendance.length > 0
          ? derivedWeeklyAttendance
          : attendanceTotal
            ? [
                {
                  key: "today",
                  day: "Today",
                  value: attendancePercentage,
                },
              ]
            : [];
    }

    const notices = facultyAnnouncements.length
      ? facultyAnnouncements
      : holidayRecords.map((holiday) => ({
          category: "Holiday",
          date: holiday?.start_date || holiday?.date || "",
          title: holiday?.holiday_name || holiday?.title || "School holiday",
          description: holiday?.description || "",
        }));

    const initials =
      (teacherName || "T")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "T";

    const dashboardData = {
      activeLoad:
        dashboardMetrics.activeLoad ||
        uniqueClassAssignments.size ||
        uniqueClasses.size ||
        assignments.length ||
        0,
      totalStudents:
        dashboardMetrics.totalStudents ||
        assignments.length ||
        attendanceTotal ||
        0,
      attendancePercentage:
        dashboardMetrics.attendancePercentage || attendancePercentage || 0,
      pendingMarks: dashboardMetrics.pendingMarks || 0,
      weeklyAttendance:
        dashboardMetrics.weeklyAttendance.length > 0
          ? dashboardMetrics.weeklyAttendance
          : normalizedAttendanceSeries,
    };

    return {
      teacher: {
        name: teacherName,
        school: schoolName,
        initials,
        role: session?.role || "Teacher",
        academicYear: session?.academicYear || "",
      },
      dashboardData,
      dashboardStats: dashboardData,
      attendanceWeekly: dashboardData.weeklyAttendance,
      quickActions: [],
      shortcuts: [],
      notices,
      modules: [],
      assignedClasses: assignments,
      attendance: attendanceStudents,
      homework: homeworkRecords,
      timetable: timetableRecords,
      exams: examRecords,
      ...((assignedResult.status === "fulfilled" && assignedResult.value) ||
        {}),
    };
  },

  async getStaff(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/staff", { token: session?.token });
    return payload?.data || payload?.staff || payload?.results || [];
  },

  async getTeachers(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/teachers", { token: session?.token });
    return payload?.data || payload?.teachers || payload?.results || [];
  },

  async getStudents(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/students", { token: session?.token });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.students ||
      payload?.results ||
      payload ||
      [];
    return Array.isArray(records) ? records : [];
  },

  async createStudent(input, session) {
    return apiRequest("/students", {
      method: "POST",
      token: session?.token,
      body: input,
    });
  },

  async updateStudent(id, input, session) {
    return apiRequest(`/students/${id}`, {
      method: "PUT",
      token: session?.token,
      body: input,
    });
  },

  async deleteStudent(id, session) {
    return apiRequest(`/students/${id}`, {
      method: "DELETE",
      token: session?.token,
    });
  },

  async getParentChildren(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/parents/children", {
      token: session?.token,
    });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.children ||
      payload ||
      [];
    return Array.isArray(records) ? records : [];
  },

  async getAttendance(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/attendance", { token: session?.token });
    return payload?.data || payload || [];
  },

  async getHomework(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/homework", { token: session?.token });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.assignments ||
      payload?.homework ||
      payload ||
      [];
    return Array.isArray(records) ? records : [];
  },

  async createHomework(input, session) {
    if (isApiConfigured) {
      const payload = await apiRequest("/homework", {
        method: "POST",
        token: session?.token,
        body: input,
      });
      return payload?.data || payload;
    }
    const selectedClasses = input.assignedClasses?.length
      ? input.assignedClasses
      : [
          {
            id: input.classId || "class-1",
            label: `${input.className || "Class_1"}-${input.section || "A"}`,
            className: input.className || "Class_1",
            section: input.section || "A",
          },
        ];
    const assignments = selectedClasses.map((selectedClass, index) => ({
      ...input,
      id: `homework-${Date.now()}-${index}`,
      classId: selectedClass.id,
      className: selectedClass.className,
      section: selectedClass.section,
      teacher:
        input.teacher || session?.name || session?.user?.name || "Teacher",
    }));
    localHomework = [...assignments, ...localHomework];
    return assignments.length === 1 ? { ...assignments[0] } : { assignments };
  },

  async getHomeworkSubmissions(homeworkId, session) {
    if (isApiConfigured) {
      const payload = await apiRequest(`/homework/${homeworkId}/submissions`, {
        token: session?.token,
      });
      return payload?.data || payload?.submissions || [];
    }
    if (!localSubmissions[homeworkId]) {
      const assignment = localHomework.find((item) => item.id === homeworkId);
      localSubmissions[homeworkId] = assignment
        ? [
            {
              id: `${homeworkId}-student-1`,
              studentName: "Aarav Sharma",
              className: assignment.className || assignment.class,
              section: assignment.section || "A",
              rollNumber: "01",
              submissionStatus: "Submitted",
              evaluationStatus: "Pending Evaluation",
              submittedDate: assignment.dueDate,
              submissionDetails: "Homework submission received.",
            },
            {
              id: `${homeworkId}-student-2`,
              studentName: "Diya Nair",
              className: assignment.className || assignment.class,
              section: assignment.section || "A",
              rollNumber: "02",
              submissionStatus: "Not Submitted",
              evaluationStatus: "Not Submitted",
            },
          ]
        : [];
    }
    return localSubmissions[homeworkId].map((submission) => ({
      ...submission,
    }));
  },

  async saveHomeworkEvaluation(homeworkId, submissionId, input, session) {
    if (isApiConfigured) {
      const payload = await apiRequest(
        `/homework/${homeworkId}/submissions/${submissionId}/evaluation`,
        { method: "PUT", token: session?.token, body: input },
      );
      return payload?.data || payload;
    }
    const submissions = localSubmissions[homeworkId] || [];
    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission)
      throw new Error("The selected submission is no longer available.");
    Object.assign(submission, input, { evaluationStatus: "Evaluated" });
    return { ...submission };
  },

  async getLeaves(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/leaves", { token: session?.token });
    return payload?.data || payload?.leaves || payload?.results || [];
  },

  async createLeaveRequest(input, session) {
    const normalizedInput = {
      leave_type:
        input?.leave_type ||
        input?.leaveType ||
        input?.category ||
        "Casual Leave",
      start_date: formatIsoDate(
        input?.start_date || input?.startDate || input?.from,
      ),
      end_date: formatIsoDate(input?.end_date || input?.endDate || input?.to),
      reason: input?.reason || "",
    };

    if (input?.notes) {
      normalizedInput.notes = input.notes;
    }

    if (isApiConfigured) {
      const payload = await apiRequest("/leaves/apply", {
        method: "POST",
        token: session?.token,
        body: normalizedInput,
      });
      return payload?.data || payload;
    }
    const request = { ...normalizedInput, id: `leave-request-${Date.now()}` };
    localLeaveRequests = [request, ...localLeaveRequests];
    return { ...request };
  },

  async updateLeaveStatus(id, status, session) {
    if (!isApiConfigured) return { id, status };
    if (!id) throw new Error("The leave request ID is missing.");
    const apiStatus = String(status || "").toUpperCase();
    if (!["APPROVED", "REJECTED", "PENDING"].includes(apiStatus)) {
      throw new Error("Invalid leave status.");
    }

    let payload;
    try {
      payload = await apiRequest(`/leaves/${id}/status`, {
        method: "PATCH",
        token: session?.token,
        body: { status: apiStatus },
      });
    } catch (error) {
      // Some deployments expose this update as PUT rather than PATCH.
      if (![404, 405].includes(error?.status)) throw error;
      payload = await apiRequest(`/leaves/${id}/status`, {
        method: "PUT",
        token: session?.token,
        body: { status: apiStatus },
      });
    }
    return payload?.data || payload;
  },

  async deleteLeave(id, session) {
    if (!isApiConfigured) return { id, deleted: true };
    const payload = await apiRequest(`/leaves/${id}`, {
      method: "DELETE",
      token: session?.token,
    });
    return payload?.data || payload;
  },

  async getExams(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/exams", { token: session?.token });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.exams ||
      payload?.results ||
      payload ||
      [];
    return (Array.isArray(records) ? records : []).map((exam) => ({
      ...exam,
      name: exam.name || exam.exam_name || exam.title || "Examination",
      targetClass:
        exam.targetClass ||
        exam.class_name ||
        exam.className ||
        "Global (All Classes)",
      section: exam.section || exam.division_name || exam.division || null,
      startDate: exam.startDate || exam.start_date || exam.exam_date || "",
      endDate: exam.endDate || exam.end_date || exam.exam_date || "",
      startTime: exam.startTime || exam.start_time || "",
      endTime: exam.endTime || exam.end_time || "",
      subjects: exam.subjects || exam.exam_subjects || [],
    }));
  },

  async getExamTerms(session) {
    const payload = await apiRequest("/exams/terms", { token: session?.token });
    return (
      payload?.data?.data ||
      payload?.data ||
      payload?.terms ||
      payload?.results ||
      payload ||
      []
    );
  },

  async getExamTypes(session) {
    const payload = await apiRequest("/exams/types", { token: session?.token });
    return (
      payload?.data?.data ||
      payload?.data ||
      payload?.types ||
      payload?.results ||
      payload ||
      []
    );
  },

  async fetchExams(session) {
    return this.getExams(session);
  },

  async fetchExamById(examId, session) {
    if (!isApiConfigured) return null;
    const payload = await apiRequest(`/exams/${examId}`, {
      token: session?.token,
    });
    return payload?.data || payload?.exam || payload;
  },

  async createExam(input, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest("/exams", {
      method: "POST",
      token: session?.token,
      body: input,
    });
    return payload?.data || payload;
  },

  async updateExam(examId, input, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest(`/exams/${examId}`, {
      method: "PUT",
      token: session?.token,
      body: input,
    });
    return payload?.data || payload;
  },

  async deleteExam(examId, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest(`/exams/${examId}`, {
      method: "DELETE",
      token: session?.token,
    });
    return payload?.data || payload;
  },

  async getExamSubjects(examId, session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest(`/exams/${examId}/subjects`, {
      token: session?.token,
    });
    return payload?.data || payload?.subjects || [];
  },

  async fetchExamSubjects(examId, session) {
    return this.getExamSubjects(examId, session);
  },

  async getExamAttendanceRoster(params = {}, session) {
    const { examId, subjectId, classId, divisionId } = params;
    if (!examId || !subjectId || !classId) return [];
    const payload = await apiRequest(
      `/exams/${examId}/subjects/${subjectId}/attendance`,
      {
        token: session?.token,
        query: { class_id: classId, division_id: divisionId },
      },
    );
    const records =
      payload?.data?.records ||
      payload?.records ||
      payload?.data?.students ||
      payload?.students ||
      payload?.data ||
      payload?.results ||
      payload ||
      [];
    return (Array.isArray(records) ? records : []).map((record, index) => ({
      ...record,
      id:
        record.id ||
        record.student_id ||
        record.studentId ||
        `student-${index}`,
      studentId: record.studentId || record.student_id || record.id,
      name:
        record.name ||
        record.student_name ||
        record.studentName ||
        "Unnamed student",
      rollNumber:
        record.rollNumber ||
        record.roll_number ||
        record.rollNo ||
        record.roll ||
        "",
      admissionNumber:
        record.admissionNumber ||
        record.admission_number ||
        record.admissionNo ||
        "",
      className: record.className || record.class_name || "",
      section: record.section || record.division || record.division_name || "",
      status: ["Present", "Absent"].includes(record.status)
        ? record.status
        : "Unmarked",
    }));
  },

  async getExamAttendanceHistory(params = {}, session) {
    const { examId, classId, divisionId } = params;
    if (!examId || !classId) return { subjects: [], students: [], audit: [] };
    try {
      const payload = await apiRequest(`/exams/${examId}/attendance-history`, {
        token: session?.token,
        query: { class_id: classId, division_id: divisionId },
      });
      const source =
        payload?.data && !Array.isArray(payload.data)
          ? payload.data
          : payload || {};
      const students =
        source.students ||
        source.records ||
        source.attendance ||
        payload?.students ||
        payload?.records ||
        [];
      const subjects =
        source.subjects ||
        source.papers ||
        payload?.subjects ||
        payload?.papers ||
        [];
      return {
        subjects: Array.isArray(subjects) ? subjects : [],
        students: Array.isArray(students) ? students : [],
        audit: Array.isArray(source.audit) ? source.audit : [],
      };
    } catch (error) {
      if (error?.status === 404) {
        return { subjects: [], students: [], audit: [] };
      }
      throw error;
    }
  },

  async submitExamAttendance(data, session) {
    const { examId, subjectId, ...body } = data || {};
    if (!examId || !subjectId)
      throw new Error("Exam and subject paper are required.");
    return apiRequest(`/exams/${examId}/subjects/${subjectId}/attendance`, {
      method: "POST",
      token: session?.token,
      body,
    });
  },

  async getExamMarksRoster(params = {}, session) {
    const { examId, subjectId, classId, divisionId } = params;
    if (!examId || !subjectId || !classId) return [];
    const payload = await apiRequest(
      `/exams/${examId}/subjects/${subjectId}/marks`,
      {
        token: session?.token,
        query: { class_id: classId, division_id: divisionId },
      },
    );
    const records =
      payload?.data?.records ||
      payload?.records ||
      payload?.data?.students ||
      payload?.students ||
      payload?.data ||
      payload?.results ||
      payload ||
      [];
    return (Array.isArray(records) ? records : []).map((record, index) => ({
      ...record,
      id:
        record.id ||
        record.student_id ||
        record.studentId ||
        `student-${index}`,
      studentId: record.studentId || record.student_id || record.id,
      name:
        record.name ||
        record.student_name ||
        record.studentName ||
        "Unnamed student",
      rollNumber:
        record.rollNumber ||
        record.roll_number ||
        record.rollNo ||
        record.roll ||
        "",
      admissionNumber:
        record.admissionNumber ||
        record.admission_number ||
        record.admissionNo ||
        "",
      className: record.className || record.class_name || "",
      section: record.section || record.division || record.division_name || "",
      maximumMarks: Number(
        record.maximumMarks ??
          record.maximum_marks ??
          record.maxMarks ??
          record.max_marks ??
          100,
      ),
      obtainedMarks:
        record.obtainedMarks ?? record.obtained_marks ?? record.marks ?? "",
      passingMarks:
        record.passingMarks ??
        record.passing_marks ??
        record.passMarks ??
        record.pass_marks ??
        "",
      remarks: record.remarks || "",
    }));
  },

  async submitExamMarks(data, session) {
    const { examId, subjectId, ...body } = data || {};
    if (!examId || !subjectId)
      throw new Error("Exam and subject paper are required.");
    return apiRequest(`/exams/${examId}/subjects/${subjectId}/marks`, {
      method: "POST",
      token: session?.token,
      body,
    });
  },

  async publishExamResults(examId, session) {
    if (!examId) throw new Error("The examination ID is missing.");
    const payload = await apiRequest(`/exams/${examId}/publish-results`, {
      method: "POST",
      token: session?.token,
    });
    return payload?.data || payload;
  },

  async recallExamResults(examId, session) {
    if (!examId) throw new Error("The examination ID is missing.");
    const payload = await apiRequest(`/exams/${examId}/recall-results`, {
      method: "POST",
      token: session?.token,
    });
    return payload?.data || payload;
  },

  async getExamReport(examId, session) {
    if (!examId) throw new Error("The examination ID is missing.");
    try {
      const payload = await apiRequest(`/exams/${examId}/report`, {
        token: session?.token,
      });
      return payload?.data || payload?.report || payload;
    } catch (error) {
      if (error?.status === 404) {
        return { totalStudents: 0, records: [], averagePercentage: 0 };
      }
      throw error;
    }
  },

  async getClassResults(params = {}, session) {
    const { examId, classId, divisionId } = params;
    if (!examId || !classId) return [];
    try {
      const payload = await apiRequest(`/exams/${examId}/class-results`, {
        token: session?.token,
        query: { class_id: classId, division_id: divisionId },
      });
      const records =
        payload?.data?.records ||
        payload?.records ||
        payload?.data?.students ||
        payload?.students ||
        payload?.data ||
        payload?.results ||
        payload ||
        [];
      return Array.isArray(records) ? records : [];
    } catch (error) {
      if (error?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  async createExamSubject(examId, input, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest(`/exams/${examId}/subjects`, {
      method: "POST",
      token: session?.token,
      body: input,
    });
    return payload?.data || payload;
  },

  async updateExamSubject(examId, subjectId, input, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest(`/exams/${examId}/subjects/${subjectId}`, {
      method: "PUT",
      token: session?.token,
      body: input,
    });
    return payload?.data || payload;
  },

  async deleteExamSubject(examId, subjectId, session) {
    if (!isApiConfigured) {
      throw new Error("The exam API is not configured.");
    }

    const payload = await apiRequest(`/exams/${examId}/subjects/${subjectId}`, {
      method: "DELETE",
      token: session?.token,
    });
    return payload?.data || payload;
  },

  async getTimetable(session, params = {}) {
    if (!isApiConfigured) return [];
    const query = {
      ...(params.academic_year_id
        ? { academic_year_id: params.academic_year_id }
        : {}),
      ...(params.staff_id ? { staff_id: params.staff_id } : {}),
    };
    const payload = await apiRequest("/timetable/teacher", {
      token: session?.token,
      query,
    });
    return (
      payload?.data?.data ||
      payload?.data ||
      payload?.timetable ||
      payload?.records ||
      payload ||
      []
    );
  },

  async getClassTimetable(session, params = {}) {
    if (!isApiConfigured) return [];
    if (
      !params.academic_year_id ||
      !params.class_id ||
      !params.division_id
    ) {
      return [];
    }
    const query = {
      academic_year_id: params.academic_year_id,
      class_id: params.class_id,
      division_id: params.division_id,
    };
    const payload = await apiRequest("/timetable/class", {
      token: session?.token,
      query,
    });
    const records =
      payload?.data?.data ||
      payload?.data?.timetable ||
      payload?.data ||
      payload?.timetable ||
      payload?.records ||
      payload;
    return Array.isArray(records) ? records : [];
  },

  async getTimetableSessions(session, academicYearId) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/timetable/sessions", {
      token: session?.token,
      query: { academic_year_id: academicYearId },
    });
    return (
      payload?.data?.data ||
      payload?.data ||
      payload?.sessions ||
      payload?.records ||
      payload ||
      []
    );
  },

  async getNotices(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/notices", { token: session?.token });
    return payload?.data || payload?.notices || [];
  },

  async getNotifications(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/notifications", {
      token: session?.token,
    });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.notifications ||
      payload?.messages ||
      payload?.results ||
      payload ||
      [];
    return Array.isArray(records) ? records : [];
  },

  async getMessages(session) {
    const messages = await this.getNotifications(session);
    return Array.isArray(messages) ? messages : [];
  },

  async getReports(session) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/reports", { token: session?.token });
    const records =
      payload?.data?.data ||
      payload?.data ||
      payload?.reports ||
      payload?.results ||
      payload ||
      [];
    return Array.isArray(records) ? records : [];
  },
};

const examAttendanceItems = (payload, keys = []) => payloadItems(payload, keys);

export const examAttendanceApi = {
  async getClasses(session) {
    const payload = await apiRequest("/academics/classes", {
      token: session?.token,
    });
    return examAttendanceItems(payload, ["classes"]);
  },

  async getDivisions(classId, session) {
    const payload = await apiRequest("/academics/divisions", {
      token: session?.token,
      query: { class_id: classId },
    });
    return examAttendanceItems(payload, ["divisions", "sections"]);
  },

  async getSubjects(examId, session) {
    const payload = await apiRequest(`/exams/${examId}/subjects`, {
      token: session?.token,
    });
    return examAttendanceItems(payload, ["subjects", "exam_subjects"]);
  },

  async getSubjectMarks(examSubjectId, session) {
    const payload = await apiRequest(`/exams/subject/${examSubjectId}/marks`, {
      token: session?.token,
    });
    return examAttendanceItems(payload, ["marks", "records"]);
  },

  async getStudents(classId, divisionId, session) {
    const payload = await apiRequest("/students", {
      token: session?.token,
      query: { class_id: classId, division_id: divisionId },
    });
    return examAttendanceItems(payload, ["students"]);
  },

  async saveAttendance(data, session) {
    return apiRequest("/exams/attendance", {
      method: "POST",
      token: session?.token,
      body: data,
    });
  },
};

export const examResultApi = {
  getClasses: examAttendanceApi.getClasses,
  getDivisions: examAttendanceApi.getDivisions,
  getSubjects: examAttendanceApi.getSubjects,
  getSubjectMarks: examAttendanceApi.getSubjectMarks,
  getStudents: examAttendanceApi.getStudents,

  async saveMarks(data, session) {
    return apiRequest("/exams/marks/bulk", {
      method: "POST",
      token: session?.token,
      body: data,
    });
  },
};

export const teacherAttendanceApi = {
  async getAssignedClassesDivisions(session) {
    logApi("GET", "/attendance/assigned-classes-divisions");
    const payload = await apiRequest("/attendance/assigned-classes-divisions", {
      token: session?.token,
    });
    return normalizeAssignedFilters(payload);
  },

  async getAcademicClasses(session) {
    logApi("GET", "/academics/classes");
    const payload = await apiRequest("/academics/classes", {
      token: session?.token,
    });
    return payloadItems(payload, ["classes"]).map(normalizeFilterOption);
  },

  async getAcademicDivisions(session, classId) {
    logApi("GET", "/academics/divisions");
    const payload = await apiRequest("/academics/divisions", {
      token: session?.token,
      query: { class_id: classId },
    });
    return payloadItems(payload, ["divisions", "sections"]).map(
      normalizeFilterOption,
    );
  },

  async getAttendance(params = {}, session) {
    const query = attendanceQuery(params);
    logApi("GET", "/attendance", query);
    const payload = await apiRequest("/attendance", {
      token: session?.token,
      query,
    });
    return normalizePayrollAttendance(payload);
  },

  async submitAttendance(data, session) {
    const attendanceData = (data?.attendanceData || data?.records || []).map(
      (record) => ({
        student_id: String(record.student_id || record.studentId),
        status: record.status,
      }),
    );
    const academicYearId =
      data?.academic_year_id ||
      session?.academicYearId ||
      session?.academic_year_id ||
      session?.user?.tenant?.current_academic_year_id ||
      session?.tenant?.current_academic_year_id;
    const body = {
      academic_year_id: academicYearId,
      class_id: data?.class_id,
      division_id: data?.division_id,
      date: formatDateForPayrollApi(data?.date),
      attendanceData,
    };
    logApi("POST", "/attendance", {
      ...body,
      attendanceData: `${attendanceData.length} record(s)`,
    });
    return apiRequest("/attendance", {
      method: "POST",
      token: session?.token,
      body,
    });
  },

  async getAttendanceHistory(params = {}, session) {
    const query = normalizePayrollDateParams({
      classId: params.classId || params.class_id,
      divisionId: params.divisionId || params.division_id,
      startDate: params.startDate || params.from,
      endDate: params.endDate || params.to,
      page: params.page,
      limit: params.limit,
    });
    logApi("GET", "/attendance/history", query);
    const payload = await apiRequest("/attendance/history", {
      token: session?.token,
      query,
    });
    return {
      records: normalizePayrollRecords(payload),
      pagination: payload?.pagination || payload?.meta || {},
    };
  },

  async exportAttendance(params = {}, session) {
    const date = formatDateForPayrollApi(
      params.date || params.from || params.startDate,
    );
    const query = {
      from: date,
      to: formatDateForPayrollApi(params.to || params.endDate || params.date),
      format: params.format || "CSV",
      classId: params.classId || params.class_id,
      divisionId: params.divisionId || params.division_id,
    };
    logApi("GET", "/attendance/export", query);
    return apiRequest("/attendance/export", {
      token: session?.token,
      query,
    });
  },

  async triggerAutoCutoff(data, session) {
    logApi("POST", "/attendance/trigger-auto-cutoff", data);
    return apiRequest("/attendance/trigger-auto-cutoff", {
      method: "POST",
      token: session?.token,
      body: { ...data, date: formatDateForPayrollApi(data?.date) },
    });
  },

  getPayrollAttendance(params, session) {
    return this.getAttendance(params, session);
  },
  recordPayrollAttendance(records, context, session) {
    return this.submitAttendance({ ...context, records }, session);
  },
  getPayrollAttendanceHistory(params, session) {
    return this.getAttendanceHistory(params, session).then(
      (result) => result.records,
    );
  },
  runAttendanceCutoff(date, session) {
    return this.triggerAutoCutoff({ date }, session);
  },

  async getBiometricStatus(session) {
    if (!isApiConfigured) return { available: false };
    return apiRequest("/attendance/analytics", { token: session?.token });
  },

  async sendAbsentWhatsAppAlert(records, context) {
    return {
      available: false,
      simulated: true,
      count: records.length,
      context,
    };
  },
};
