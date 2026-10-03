import { apiRequest, isApiConfigured } from './api';

const recordsFrom = (payload) => {
  const records = payload?.leaves || payload?.data?.leaves || payload?.data || payload || [];
  return Array.isArray(records) ? records : [];
};

export const leaveApi = {
  async getLeaves(session, studentId) {
    if (!isApiConfigured || !studentId) return [];
    const payload = await apiRequest('/leaves', {
      token: session?.token,
      query: { student_id: studentId },
    });
    return recordsFrom(payload);
  },

  async applyLeave(session, data) {
    if (!isApiConfigured) return { available: false };
    return apiRequest('/leaves/apply', {
      method: 'POST',
      token: session?.token,
      body: data,
    });
  },

  async updateStatus(session, id, status, rejectionReason = '') {
    return apiRequest(`/leaves/${id}/status`, {
      method: 'PATCH',
      token: session?.token,
      body: { status, rejection_reason: rejectionReason },
    });
  },

  async deleteLeave(session, id) {
    return apiRequest(`/leaves/${id}`, {
      method: 'DELETE',
      token: session?.token,
    });
  },
};
