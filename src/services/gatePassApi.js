import { apiRequest } from "./api.js";

const arrayFromPayload = (payload, keys = []) => {
  const candidates = [
    payload,
    payload?.data,
    ...keys.map((key) => payload?.[key]),
    ...keys.map((key) => payload?.data?.[key]),
  ];

  return candidates.find(Array.isArray) || [];
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const dateKey = (date = new Date()) => {
  const value = new Date(date);

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
};

/*
 * Converts different date formats into MySQL DATETIME format:
 *
 * Input:
 * 22-09-2026 15:53
 *
 * Output:
 * 2026-09-22 15:53:00
 */
const dateTimeForApi = (value) => {
  if (!value) return null;

  const raw = String(value).trim();

  if (!raw) return null;

  // YYYY-MM-DD HH:mm
  // YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/.test(raw)) {
    return raw.replace(/\s*T\s*|\s+/, "T");
  }

  // DD-MM-YYYY HH:mm
  // DD-MM-YYYYTHH:mm
  if (/^\d{2}-\d{2}-\d{4}[T\s]\d{2}:\d{2}$/.test(raw)) {
    const [datePart, timePart] = raw.split(/[T\s]/);

    const [day, month, year] = datePart.split("-");

    return `${year}-${month}-${day} ${timePart}:00`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw} 00:00:00`;
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-");

    return `${year}-${month}-${day} 00:00:00`;
  }

  // Try normal JavaScript date parsing
  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace("T", " ");
  }

  return null;
};

/*
 * Converts reason into normalized backend value.
 */
const normalizeReasonType = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return "Other";

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const mapping = {
    medical: "medical",
    medical_sickness: "medical",
    sickness: "medical",

    emergency: "emergency",

    family_function: "family",
    family: "family",

    personal_work: "personal",
    personal: "personal",

    other: "other",
  };

  return mapping[normalized] || normalized || "other";
};

/*
 * Used mainly for displaying gate-pass time in the UI.
 *
 * Example:
 * 15:53
 * ->
 * 3:53 PM
 */
const normalizeGatePassTime = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const raw = String(value).trim();

  if (!raw) return "";

  // Already something like 3:53 PM
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(raw)) {
    return raw.replace(/\s+/g, " ");
  }

  // YYYY-MM-DD HH:mm
  // YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}$/.test(raw)) {
    const iso = raw.replace(" ", "T");

    const dateValue = new Date(iso);

    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return raw;
};

const normalizeStatus = (status) =>
  status === "CHECKED_OUT" ? "OUT" : status || "ISSUED";

const normalizeStudent = (student) => ({
  ...student,

  id: firstValue(student?.id, student?.student_id),

  name: firstValue(
    student?.name,

    [student?.first_name, student?.last_name].filter(Boolean).join(" "),

    student?.student_name,

    "Unnamed student",
  ),

  classId: firstValue(student?.classId, student?.class_id),

  className: firstValue(student?.className, student?.class_name),

  divisionId: firstValue(student?.divisionId, student?.division_id),

  section: firstValue(
    student?.section,
    student?.division_name,
    student?.division,
  ),

  rollNumber: firstValue(student?.rollNumber, student?.roll_no),

  admissionNumber: firstValue(student?.admissionNumber, student?.admission_no),
});

const normalizeRecord = (record) => ({
  ...record,

  id: firstValue(record?.id, record?.gate_pass_id),

  passNumber: firstValue(
    record?.passNumber,
    record?.pass_number,
    record?.id,
    "Gate pass",
  ),

  status: normalizeStatus(record?.status),

  date: firstValue(record?.date, record?.out_time?.slice?.(0, 10), dateKey()),

  studentId: firstValue(record?.studentId, record?.student_id),

  studentName: firstValue(
    record?.studentName,
    record?.student_name,

    [record?.first_name, record?.last_name].filter(Boolean).join(" "),

    "Unnamed student",
  ),

  className: firstValue(record?.className, record?.class_name),

  section: firstValue(record?.section, record?.division_name, record?.division),

  rollNumber: firstValue(record?.rollNumber, record?.roll_no),

  admissionNumber: firstValue(record?.admissionNumber, record?.admission_no),

  issueTime: firstValue(record?.issueTime, record?.out_time?.slice?.(11, 16)),

  exitTime: firstValue(
    record?.exitTime,
    record?.actual_exit_time,
    record?.out_time,
  ),

  returnTime: firstValue(record?.returnTime, record?.actual_return_time),

  reason: firstValue(
    record?.reason,
    record?.reason_type,
    record?.reason_details,
    "Not specified",
  ),

  escortType: firstValue(record?.escortType, record?.relation_with_student, ""),

  escortName: firstValue(record?.escortName, record?.accompanied_by, ""),

  passType: record?.is_one_way ? "ONE_WAY" : "RETURNABLE",

  returnRequired:
    record?.is_one_way === false || Boolean(record?.expected_return_time),

  expectedReturnTime: firstValue(
    record?.expectedReturnTime,
    record?.expected_return_time,
  ),
});

const unwrap = (payload) => payload?.data || payload;

export const gatePassApi = {
  async getClasses(session) {
    const payload = await apiRequest("/academics/classes", {
      token: session?.token,
    });

    return arrayFromPayload(payload, ["classes"]).map((item) =>
      typeof item === "string"
        ? {
            id: item,
            name: item,
            label: item,
          }
        : {
            ...item,

            id: firstValue(item.id, item.class_id),

            name: firstValue(item.name, item.class_name),

            label: firstValue(item.name, item.class_name),
          },
    );
  },

  async getDivisions(classId, session) {
    const payload = await apiRequest("/academics/divisions", {
      token: session?.token,

      query: {
        class_id: classId,
      },
    });

    return arrayFromPayload(payload, ["divisions", "sections"]);
  },

  async getStudents(classId, session) {
    const payload = await apiRequest("/students", {
      token: session?.token,

      query: {
        class_id: classId,
        status: "Active",
      },
    });

    return arrayFromPayload(payload, ["students"]).map(normalizeStudent);
  },

  async list(session, params = {}) {
    const payload = await apiRequest("/gate-passes", {
      token: session?.token,
      query: params,
    });

    return arrayFromPayload(payload, [
      "gate_passes",
      "gatePasses",
      "records",
    ]).map(normalizeRecord);
  },

  async stats(session) {
    const payload = await apiRequest("/gate-passes/stats", {
      token: session?.token,
    });

    return unwrap(payload) || {};
  },

  /*
   * CREATE GATE PASS
   */
  async create(input, session) {
    const body = {
      student_id: firstValue(input?.studentId, input?.student_id),
      class_id: firstValue(input?.classId, input?.class_id),
      division_id: firstValue(input?.divisionId, input?.division_id),
      reason_type: firstValue(input?.reason, input?.reason_type, "Other"),
      reason: firstValue(input?.reason, input?.reason_type, "Other"),
      reason_details: firstValue(
        input?.reasonDetails,
        input?.reason_details,
        input?.notes,
      ) ?? "",
      accompanied_by: firstValue(
        input?.accompaniedBy,
        input?.accompanied_by,
        input?.escortName,
      ) ?? "",
      relation_with_student: firstValue(
        input?.relationWithStudent,
        input?.relation_with_student,
        input?.escortName?.split?.(":")[0]?.trim(),
      ) ?? "",
      contact_number: firstValue(
        input?.contactNumber,
        input?.contact_number,
        input?.escortContact,
      ) ?? "",
      guardian_name: firstValue(
        input?.guardianName,
        input?.guardian_name,
        input?.escortName,
        input?.accompaniedBy,
        input?.accompanied_by,
      ) ?? "",
      guardian_mobile: firstValue(
        input?.guardianMobile,
        input?.guardian_mobile,
        input?.escortContact,
        input?.contactNumber,
        input?.contact_number,
      ) ?? "",
      out_time: dateTimeForApi(
        firstValue(
          input?.outTime,
          input?.out_time,
          input?.exitDateTime,
          input?.issueTime,
        ),
      ),
      is_one_way: Boolean(input?.isOneWay ?? input?.is_one_way ?? input?.passType === "ONE_WAY"),
      expected_return_time: (input?.isOneWay ?? input?.is_one_way ?? input?.passType === "ONE_WAY")
        ? null
        : dateTimeForApi(input?.expectedReturnTime ?? input?.expected_return_time),
      approved_by: firstValue(input?.approvedBy, input?.approved_by) ?? "",
      security_remarks: firstValue(
        input?.securityRemarks,
        input?.security_remarks,
      ) ?? "",
    };

    const payload = await apiRequest("/gate-passes", {
      method: "POST",
      token: session?.token,
      body,
    });

    return payload;
  },

  async getById(id, session) {
    const payload = await apiRequest(`/gate-passes/${id}`, {
      token: session?.token,
    });

    return normalizeRecord(unwrap(payload));
  },

  async updateStatus(id, body, session) {
    const payload = await apiRequest(`/gate-passes/${id}/status`, {
      method: "PUT",
      token: session?.token,
      body,
    });

    return normalizeRecord(unwrap(payload));
  },

  async exit(id, session) {
    return this.updateStatus(
      id,
      {
        status: "CHECKED_OUT",
      },
      session,
    );
  },

  async returnPass(id, session) {
    return this.updateStatus(
      id,
      {
        status: "RETURNED",

        actual_return_time: new Date().toISOString().slice(0, 16),

        remarks: "Returned safely to campus",
      },
      session,
    );
  },

  async cancel(id, session) {
    return this.updateStatus(
      id,
      {
        status: "CANCELLED",
      },
      session,
    );
  },

  async remove(id, session) {
    return apiRequest(`/gate-passes/${id}`, {
      method: "DELETE",
      token: session?.token,
    });
  },
};

export { dateKey };
