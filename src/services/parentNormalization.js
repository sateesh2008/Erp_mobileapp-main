const childrenFrom = (payload) => {
  const candidates = [
    payload?.data?.children,
    payload?.data?.students,
    payload?.children,
    payload?.students,
    payload?.data,
    payload,
  ];
  return candidates.find(Array.isArray) || [];
};

const studentIdFrom = (child) =>
  child.student_id ??
  child.studentId ??
  child.child_id ??
  child.childId ??
  child.student?.student_id ??
  child.student?.studentId ??
  child.student?.id ??
  child.child?.student_id ??
  child.child?.studentId ??
  child.child?.id ??
  child.id;

export const normalizeParentChildren = (payload) =>
  childrenFrom(payload).map((child) => {
    const studentId = studentIdFrom(child);
    if (studentId == null) return child;
    return {
      ...child,
      id: studentId,
      ...(String(child.id) !== String(studentId)
        ? { parentChildId: child.id }
        : {}),
    };
  });
