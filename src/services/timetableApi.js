import { apiRequest, isApiConfigured } from "./api";

const dayKeys = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
};

export const timetableApi = {
  async getWeeklySchedule(session, studentId) {
    if (!isApiConfigured) return {};
    if (!studentId) return {};

    const payload = await apiRequest(`/parents/child/${studentId}/timetable`, {
      token: session?.token,
    });
    const records = payload?.timetable || payload?.data || [];
    const schedule = {};

    (Array.isArray(records) ? records : []).forEach((record) => {
      const dayValue = String(record.day_name || record.day || "")
        .trim()
        .toLowerCase();
      const day = dayKeys[dayValue] || dayKeys[dayValue.slice(0, 3)];
      if (!day) return;

      if (!schedule[day]) schedule[day] = [];
      schedule[day].push({
        startTime: record.start_time || "",
        endTime: record.end_time || "",
        room: record.room || record.room_no || "RM TBD",
        subject: record.subject || record.subject_name || "",
        teacher: record.teacher || record.teacher_name || "",
      });
    });

    Object.values(schedule).forEach((sessions) => {
      sessions.sort((first, second) =>
        first.startTime.localeCompare(second.startTime),
      );
    });

    return schedule;
  },
};
