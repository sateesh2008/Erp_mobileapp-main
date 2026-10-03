import { apiRequest, isApiConfigured } from "./api.js";

const normalizeExamSession = (item = {}, fallbackId = "exam") => ({
  id: item.id || item.exam_id || item.examId || `${fallbackId}-${Date.now()}`,
  name: item.name || item.exam_name || item.title || "Untitled Exam",
  code: item.code || item.exam_code || item.subject_code || "",
  pattern: item.pattern || item.exam_pattern || item.type || "",
  scope:
    item.scope ||
    item.targetClass ||
    item.class_name ||
    item.className ||
    "All Classes",
  questions: Number(
    item.questions ?? item.total_questions ?? item.question_count ?? 180,
  ),
  positiveMarks: Number(item.positiveMarks ?? item.positive_marks ?? 4),
  negativeMarks: Number(item.negativeMarks ?? item.negative_marks ?? 1),
  evaluated: Number(item.evaluated ?? item.evaluated_count ?? 0),
  keys: Number(item.keys ?? item.answer_key_count ?? 0),
  status: item.status || "Draft",
  createdDate: item.createdDate || item.created_at || item.startDate || "",
});

const unwrapRecords = (payload, key) => {
  const source = payload?.data?.data || payload?.data || payload || {};
  if (Array.isArray(source)) return source;
  if (Array.isArray(source[key])) return source[key];
  if (Array.isArray(source?.records)) return source.records;
  return [];
};

export const omrApi = {
  async fetchOMRDashboard(session) {
    if (!isApiConfigured) return { sessions: [], results: [] };
    try {
      const payload = await apiRequest("/exams", { token: session?.token });
      return {
        sessions: unwrapRecords(payload, "exams").map((item) =>
          normalizeExamSession(item),
        ),
        results: [],
      };
    } catch (error) {
      if (error?.status === 404) return { sessions: [], results: [] };
      throw error;
    }
  },

  async fetchOMRSessions(session) {
    const dashboard = await this.fetchOMRDashboard(session);
    return dashboard.sessions;
  },

  async createOMRSession(input, session) {
    if (!isApiConfigured) return null;
    try {
      const payload = await apiRequest("/exams", {
        method: "POST",
        token: session?.token,
        body: input,
      });
      const exam = payload?.data || payload?.exam || payload;
      return normalizeExamSession(exam);
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  },

  async fetchAnswerKeys(examId, session) {
    if (!examId || !isApiConfigured) return [];
    try {
      const payload = await apiRequest(`/omr/sessions/${examId}/answer-key`, {
        token: session?.token,
      });
      const keys = payload?.keys || payload?.data?.keys || payload?.data || [];
      return Array.isArray(keys) ? keys : [];
    } catch (error) {
      if (error?.status === 404) return [];
      throw error;
    }
  },

  async saveAnswerKey(examId, key, session) {
    if (!examId || !isApiConfigured) return key;
    const wrappedKey = Array.isArray(key) ? key : [key].filter(Boolean);

    try {
      const payload = await apiRequest(`/omr/sessions/${examId}/answer-key`, {
        method: "POST",
        token: session?.token,
        body: { keys: wrappedKey },
      });
      return (
        payload?.data ||
        payload || { success: true, message: "Answer key updated successfully" }
      );
    } catch (error) {
      if (error?.status === 404) return key;
      throw error;
    }
  },

  async scanOMRSheet(input, session) {
    if (!isApiConfigured)
      return {
        ...input,
        scanned: true,
        detectedAnswers: input?.detectedAnswers || 0,
      };
    try {
      const payload = await apiRequest("/exams/omr/scan", {
        method: "POST",
        token: session?.token,
        body: input,
      });
      return payload?.data || payload || { ...input, scanned: true };
    } catch (error) {
      if (error?.status === 404)
        return {
          ...input,
          scanned: true,
          detectedAnswers: input?.detectedAnswers || 0,
        };
      throw error;
    }
  },

  async evaluateOMRSheet(input, session) {
    if (!isApiConfigured) {
      const attempts = Array.isArray(input?.answers) ? input.answers.length : 0;
      return {
        ...input,
        evaluated: true,
        score: attempts,
        percentage: attempts ? 75 : 0,
      };
    }
    try {
      const payload = await apiRequest("/exams/omr/evaluate", {
        method: "POST",
        token: session?.token,
        body: input,
      });
      return payload?.data || payload || { ...input, evaluated: true };
    } catch (error) {
      if (error?.status === 404) {
        const attempts = Array.isArray(input?.answers)
          ? input.answers.length
          : 0;
        return {
          ...input,
          evaluated: true,
          score: attempts,
          percentage: attempts ? 75 : 0,
        };
      }
      throw error;
    }
  },

  async fetchOMRResults(session) {
    if (!isApiConfigured) return [];
    try {
      const payload = await apiRequest("/exams/results", {
        token: session?.token,
      });
      return unwrapRecords(payload, "results");
    } catch (error) {
      if (error?.status === 404) return [];
      throw error;
    }
  },

  async getStudentResults(session, studentId) {
    if (!isApiConfigured || !studentId) return [];
    try {
      const payload = await apiRequest(
        `/omr/student/${encodeURIComponent(String(studentId))}/results`,
        { token: session?.token },
      );
      return unwrapRecords(payload, "results");
    } catch (error) {
      if (error?.status === 404) return [];
      throw error;
    }
  },

  async publishOMRResults(examId, session) {
    if (!examId) return { id: examId, status: "Draft" };
    if (!isApiConfigured) return { id: examId, status: "Draft" };
    try {
      const payload = await apiRequest(`/exams/${examId}/publish-results`, {
        method: "POST",
        token: session?.token,
      });
      return payload?.data || payload || { id: examId, status: "Published" };
    } catch (error) {
      if (error?.status === 404) return { id: examId, status: "Draft" };
      throw error;
    }
  },
};
