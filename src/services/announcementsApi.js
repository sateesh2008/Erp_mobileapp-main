import { apiRequest, isApiConfigured } from "./api.js";

const recordsFrom = (payload) => {
  const records =
    payload?.announcements ||
    payload?.data?.announcements ||
    payload?.data?.data ||
    payload?.data ||
    payload ||
    [];
  return Array.isArray(records) ? records : [];
};

const parseAnnouncementTimestamp = (announcement) => {
  const timestampValue =
    announcement?.created_at ||
    announcement?.createdAt ||
    announcement?.date ||
    announcement?.updated_at ||
    announcement?.updatedAt ||
    0;

  if (!timestampValue) return 0;

  const parsed = new Date(timestampValue).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isAnnouncementRead = (announcement) => {
  if (!announcement || typeof announcement !== "object") return true;

  const readValue =
    announcement.is_read ??
    announcement.isRead ??
    announcement.read ??
    announcement.read_status ??
    announcement.readStatus ??
    announcement.status;

  if (typeof readValue === "boolean") return readValue;
  if (typeof readValue === "string") {
    return ["read", "seen", "viewed", "acknowledged"].includes(
      readValue.trim().toLowerCase(),
    );
  }

  if (typeof readValue === "number") return Boolean(readValue);

  return false;
};

const normalizeAnnouncement = (announcement) => ({
  ...announcement,
  title: announcement.title || announcement.subject || "Announcement",
  message:
    announcement.message ||
    announcement.content ||
    announcement.description ||
    "",
  type: announcement.type || announcement.category || "Notice",
  priority: announcement.priority || "Normal",
  date:
    announcement.created_at ||
    announcement.date ||
    announcement.createdAt ||
    "",
  creator:
    announcement.creator_name ||
    announcement.created_by_name ||
    announcement.creator ||
    "School Administration",
  is_read:
    announcement.is_read ??
    announcement.isRead ??
    announcement.read ??
    announcement.read_status ??
    announcement.readStatus ??
    announcement.status === "read",
});

export const announcementsApi = {
  isAnnouncementRead,
  getUnreadCount(announcements = []) {
    return (Array.isArray(announcements) ? announcements : []).filter(
      (announcement) => !isAnnouncementRead(announcement),
    ).length;
  },

  async getAnnouncements(session, studentId) {
    if (!isApiConfigured) return [];

    const payload = await apiRequest("/announcements", {
      token: session?.token,
      query: studentId ? { student_id: studentId } : undefined,
    });

    return recordsFrom(payload)
      .map(normalizeAnnouncement)
      .sort((left, right) => {
        const leftTime = parseAnnouncementTimestamp(left);
        const rightTime = parseAnnouncementTimestamp(right);
        return rightTime - leftTime;
      });
  },

  async getAnnouncement(session, id) {
    return apiRequest(`/announcements/${id}`, { token: session?.token });
  },

  async getPublicAnnouncement(id) {
    return apiRequest(`/announcements/public/${id}`);
  },

  async createAnnouncement(session, announcement) {
    return apiRequest("/announcements", {
      method: "POST",
      token: session?.token,
      body: announcement,
    });
  },

  async markAsRead(session, id) {
    if (!id) return null;
    return apiRequest(`/announcements/${id}/read`, {
      method: "POST",
      token: session?.token,
    });
  },

  async markAllAsRead(session) {
    return apiRequest("/announcements/read-all", {
      method: "POST",
      token: session?.token,
    });
  },

  async deleteAnnouncement(session, id) {
    return apiRequest(`/announcements/${id}`, {
      method: "DELETE",
      token: session?.token,
    });
  },
};
