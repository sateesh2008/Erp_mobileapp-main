export const teacherProfile = {
  name: "Teacher",
  initials: "T",
  role: "Teacher",
  school: "",
  academicYear: "",
};

export const teacherDashboardData = {
  activeLoad: 0,
  totalStudents: 0,
  attendancePercentage: 0,
  pendingMarks: 0,
  weeklyAttendance: [],
  notices: [],
  quickActions: [],
  shortcuts: [],
};

export const teacherDashboardStats = {
  activeLoad: teacherDashboardData.activeLoad,
  totalStudents: teacherDashboardData.totalStudents,
  attendancePercentage: teacherDashboardData.attendancePercentage,
  pendingMarks: teacherDashboardData.pendingMarks,
};

export const teacherAttendanceWeekly = teacherDashboardData.weeklyAttendance;
export const teacherQuickActions = teacherDashboardData.quickActions;
export const teacherShortcuts = teacherDashboardData.shortcuts;
export const teacherNotices = teacherDashboardData.notices;

export const teacherNavigationModules = [
  "Home",
  "Attendance",
  "Homework",
  "Exams / Marks",
  "Timetable",
  "Leave",
  "Gate Pass",
  "OMR System",
];

export const teacherDashboardMock = {
  teacher: teacherProfile,
  dashboardData: teacherDashboardData,
  dashboardStats: teacherDashboardStats,
  attendanceWeekly: teacherAttendanceWeekly,
  quickActions: teacherQuickActions,
  shortcuts: teacherShortcuts,
  notices: teacherNotices,
  modules: teacherNavigationModules,
};

export const teacherAttendanceMock = {
  summary: {
    totalEnrolled: 0,
    markedEntries: 0,
    presentToday: 0,
    absentCount: 0,
    lateArrivals: 0,
  },
  records: [],
  classes: [],
  sections: [],
  subjects: [],
};

export const teacherHomeworkMock = [];
