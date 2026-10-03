import { apiRequest, isApiConfigured } from "./api.js";

export const homeworkApi = {
  async fetchHomeworkById(id, session) {
    if (!id) return { success: false, error: "Homework ID is required." };
    try {
      const payload = await apiRequest(`/homework/${id}`, {
        token: session?.token,
      });
      return { success: true, data: payload?.data || payload };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Unable to load homework details.",
      };
    }
  },

  async fetchPublicHomework(id) {
    if (!id) return { success: false, error: "Homework ID is required." };
    try {
      const payload = await apiRequest(`/homework/${id}`);
      return { success: true, data: payload?.data || payload };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Public homework is unavailable.",
      };
    }
  },

  async submitHomework(homeworkId, data, session) {
    if (!homeworkId)
      return { success: false, error: "Homework ID is required." };

    const normalizedData = {
      student_id: data?.student_id ?? data?.studentId ?? null,
      submission_text:
        data?.submission_text ??
        data?.submissionText ??
        data?.content ??
        data?.notes ??
        "",
      attachment_url: data?.attachment_url ?? data?.attachmentUrl ?? null,
    };

    if (
      normalizedData.student_id === null ||
      normalizedData.student_id === undefined
    ) {
      return {
        success: false,
        error: "Student ID is required to submit homework.",
      };
    }

    try {
      const payload = await apiRequest(`/homework/${homeworkId}/submit`, {
        method: "POST",
        token: session?.token,
        body: normalizedData,
      });
      return { success: true, data: payload?.data || payload };
    } catch (error) {
      return {
        success: false,
        error: error?.message || "Unable to submit homework.",
      };
    }
  },

  async getAssignments(session, studentId) {
    if (!isApiConfigured) return [];
    const payload = await apiRequest("/homework", {
      token: session?.token,
      query: { student_id: studentId },
    });
    const records = payload?.assignments || payload?.data || [];
    return (Array.isArray(records) ? records : []).map((record) => {
      const dueDate = record.submission_date || record.dueDate;
      const isOverdue = dueDate && new Date(dueDate) < new Date();
      return {
        ...record,
        subject: record.subject || record.subject_name || "Subject",
        topic: record.topic || record.title || "Homework",
        assignedDate: record.assignedDate || record.homework_date || "",
        dueDate: record.dueDate || dueDate || "",
        status: record.status || (isOverdue ? "Overdue" : "Active"),
        submissionStatus:
          record.submissionStatus || record.submission_status || "",
        material: record.material || record.attachment_url || null,
      };
    });
  },

  async submitAssignment(payload, session) {
    return this.submitHomework(
      payload?.homeworkId,
      {
        student_id: payload?.studentId ?? payload?.student_id,
        submission_text:
          payload?.submission_text ??
          payload?.submissionText ??
          payload?.content ??
          payload?.notes ??
          "",
        attachment_url:
          payload?.attachmentUrl ?? payload?.attachment_url ?? null,
      },
      session,
    );
  },
};
