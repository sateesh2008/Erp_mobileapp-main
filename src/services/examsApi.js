import { apiRequest, isApiConfigured } from './api';

export const examsApi = {
  async getHallTickets(session, studentId) {
    if (!isApiConfigured || !studentId) return [];
    const payload = await apiRequest('/exams', {
      token: session?.token,
      query: { student_id: studentId },
    });
    const exams = payload?.exams || payload?.data || [];
    return (Array.isArray(exams) ? exams : []).map((exam) => ({
      ...exam,
      date: exam.date || exam.exam_date || 'Date TBD',
      title: exam.title || exam.exam_name || 'Examination',
    }));
  },

  async getResults(session, studentId) {
    if (!isApiConfigured || !studentId) return [];
    const payload = await apiRequest(`/parents/child/${studentId}/exams`, { token: session?.token });
    const records = payload?.results || payload?.data || [];
    const grouped = {};

    (Array.isArray(records) ? records : []).forEach((record) => {
      const examName = record.examName || record.exam_name || 'Examination';
      if (!grouped[examName]) {
        grouped[examName] = {
          id: record.exam_id || record.id || examName,
          examName,
          date: record.date || record.exam_date || 'Date TBD',
          subjects: [],
        };
      }

      const obtained = Number(record.obtained ?? record.marks_obtained ?? 0);
      const maximum = Number(record.maximum ?? record.max_marks ?? 0);
      grouped[examName].subjects.push({
        name: record.name || record.subject_name || 'Subject',
        obtained,
        maximum,
        status: record.status || (record.is_pass ? 'PASS' : 'FAIL'),
      });
    });

    return Object.values(grouped).map((exam) => {
      const obtained = exam.subjects.reduce((sum, subject) => sum + subject.obtained, 0);
      const maximum = exam.subjects.reduce((sum, subject) => sum + subject.maximum, 0);
      return {
        ...exam,
        percentage: maximum ? Math.round((obtained / maximum) * 100) : 0,
        aggregate: `${obtained} OUT OF ${maximum}`,
      };
    });
  },

  async downloadHallTicket(examId, studentId, session) {
    if (!isApiConfigured || !studentId || !examId) return { available: false };
    const payload = await apiRequest(`/exams/student/${studentId}/hall-ticket/${examId}`, {
      token: session?.token,
    });
    const data = payload?.data;
    return data && typeof data === "object"
      ? { ...payload, ...data }
      : payload || { available: false };
  },
};
