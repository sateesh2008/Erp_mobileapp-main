const pad = (value) => String(value).padStart(2, '0');

export const dateKey = (date = new Date()) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const dateDaysAgo = (days) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() - days);
  return dateKey(value);
};

const monthCode = (date) => dateKey(date).slice(0, 7).replace('-', '');

export const gatePassStudents = [
  { id: 'student-1', name: 'D Sai Leela', className: 'Class_3', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-3001' },
  { id: 'student-2', name: 'test student', className: 'Class_1', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-1001' },
  { id: 'student-3', name: 'P SAI ANUSHA', className: 'Class_2', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-2001' },
  { id: 'student-4', name: 'Aarav Sharma', className: 'Class_1', section: 'B', rollNumber: '01', admissionNumber: 'ADM-1002' },
];

const today = dateKey();
const olderDate = dateDaysAgo(6);

export const gatePassMockRecords = [
  { id: 'gate-pass-3', passNumber: `GP-${monthCode(today)}-0003`, date: today, studentId: 'student-1', studentName: 'D Sai Leela', className: 'Class_3', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-3001', issueTime: '09:58', reason: 'Emergency', escortType: 'Parent', escortName: 'D PRASAD', passType: 'ONE_WAY', returnRequired: false, expectedReturnTime: null, status: 'ISSUED', notes: '' },
  { id: 'gate-pass-2', passNumber: `GP-${monthCode(olderDate)}-0002`, date: olderDate, studentId: 'student-2', studentName: 'test student', className: 'Class_1', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-1001', issueTime: '16:53', exitTime: '16:56', reason: 'Medical / Sickness', escortType: 'Parent', escortName: 'testfather', passType: 'ONE_WAY', returnRequired: false, expectedReturnTime: null, status: 'OUT', notes: '' },
  { id: 'gate-pass-1', passNumber: `GP-${monthCode(olderDate)}-0001`, date: olderDate, studentId: 'student-3', studentName: 'P SAI ANUSHA', className: 'Class_2', section: 'A', rollNumber: 'N/A', admissionNumber: 'ADM-2001', issueTime: '16:51', reason: 'Medical / Sickness', escortType: 'Parent', escortName: 'P C RAMAKRISHNA', passType: 'ONE_WAY', returnRequired: false, expectedReturnTime: null, status: 'ISSUED', notes: '' },
];

export const gatePassMockClasses = [...new Set(gatePassStudents.map((student) => student.className))];

export const nextMockPassNumber = (records, date = new Date()) => {
  const prefix = `GP-${monthCode(date)}-`;
  const highest = records.reduce((max, record) => {
    if (!record.passNumber?.startsWith(prefix)) return max;
    return Math.max(max, Number(record.passNumber.slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
};
