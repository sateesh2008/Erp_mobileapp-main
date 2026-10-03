import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ApiError } from "../services/api";
import { teacherApi, teacherAttendanceApi } from "../services/teacherApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  canvas: "#F7F8FF",
  white: "#FFFFFF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  teal: "#334BD6",
  paleTeal: "#E9EBFB",
  orange: "#D9822B",
  paleOrange: "#FFF1DF",
  red: "#C65353",
  plum: "#5A4AB6",
  softLilac: "#F5F1FF",
};

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const periodTemplates = [
  { id: "Period_1", name: "Period_1", startTime: "09:00", endTime: "09:40" },
  { id: "Period_2", name: "Period_2", startTime: "09:40", endTime: "10:30" },
  { id: "Period_3", name: "Period_3", startTime: "10:30", endTime: "11:20" },
  { id: "Period_4", name: "Period_4", startTime: "11:20", endTime: "12:00" },
  { id: "Period_5", name: "Period_5", startTime: "12:00", endTime: "12:55" },
  { id: "Period_6", name: "Period_6", startTime: "13:00", endTime: "13:50" },
  { id: "Period_7", name: "Period_7", startTime: "13:50", endTime: "14:40" },
  { id: "Period_8", name: "Period_8", startTime: "14:40", endTime: "15:30" },
];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  accentColor = colors.blue,
}) {
  const [open, setOpen] = useState(false);
  const normalizedOptions = Array.isArray(options) ? options : [];
  const optionLabel = (option) =>
    typeof option === "string"
      ? option
      : option?.label || option?.name || option?.id || "Option";

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={styles.selectText}>{value}</Text>
        <Icon name="chevron-down" size={17} color={accentColor} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View
            style={styles.optionsSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>{label}</Text>
              <Pressable hitSlop={10} onPress={() => setOpen(false)}>
                <Icon name="close" size={20} color={colors.ink} />
              </Pressable>
            </View>
            {normalizedOptions.map((option) => {
              const optionText = optionLabel(option);
              const optionValue =
                typeof option === "string" ? option : option?.id || optionText;
              return (
                <Pressable
                  key={optionValue}
                  style={[
                    styles.optionRow,
                    value === optionValue || value === optionText
                      ? styles.optionActive
                      : null,
                  ]}
                  onPress={() => {
                    onChange(typeof option === "string" ? option : option);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      (value === optionValue || value === optionText) &&
                        styles.optionTextActive,
                    ]}
                  >
                    {optionText}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SummaryCard({ icon, title, value, label, tint, accent }) {
  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: tint, borderColor: accent },
      ]}
    >
      <View
        style={[
          styles.summaryIcon,
          { backgroundColor: tint, borderColor: accent },
        ]}
      >
        <Icon name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function getDisplayEntries(entries) {
  if (!entries.length) return [];
  return entries.map((entry) => ({
    key: `${entry.id}-${entry.day}-${entry.period}`,
    ...entry,
  }));
}

const normalizeDayName = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return "Monday";
  const map = {
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
    sat: "Saturday",
    saturday: "Saturday",
  };
  return (
    map[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1)
  );
};

const normalizePeriodKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "") || "period1";

const getEntryPeriodKey = (entry) =>
  normalizePeriodKey(
    entry?.periodKey ||
      entry?.period ||
      entry?.period_name ||
      entry?.slot ||
      entry?.name ||
      entry?.id ||
      "Period_1",
  );

const getPeriodSlotKey = (slot) =>
  normalizePeriodKey(
    slot?.id ||
      slot?.periodKey ||
      slot?.name ||
      slot?.label ||
      slot?.session_name ||
      slot?.period ||
      "Period_1",
  );

const normalizeTimetableRecords = (items) => {
  const source = Array.isArray(items) ? items : [];
  return source.map((entry, index) => {
    const dayName = normalizeDayName(
      entry.day || entry.day_name || entry.dayName,
    );
    const periodName =
      entry.period ||
      entry.period_name ||
      entry.slot ||
      entry.periodName ||
      "Period_1";
    const periodKey = normalizePeriodKey(periodName);
    return {
      ...entry,
      id: entry.id || `timetable-${index}`,
      className:
        entry.className || entry.class_name || entry.targetClass || "Class_1",
      section:
        entry.section ||
        entry.division ||
        entry.division_name ||
        entry.section_name ||
        "Sec A",
      academicSession:
        entry.academicSession ||
        entry.academic_session ||
        entry.academic_year_id ||
        "",
      day: dayName,
      period: periodName,
      periodKey,
      startTime: entry.startTime || entry.start_time || "09:00",
      endTime: entry.endTime || entry.end_time || "09:40",
      subject: entry.subject || entry.subject_name || "Subject",
      teacher:
        entry.teacher ||
        entry.teacher_name ||
        entry.faculty_name ||
        entry.staff_name ||
        "Staff",
      facultyName:
        entry.faculty_name ||
        entry.teacher_name ||
        entry.teacher ||
        entry.staff_name ||
        "Staff",
      facultyId: entry.faculty_id || entry.teacher_id || entry.staff_id || "",
      staffId: entry.staff_id || entry.teacher_id || entry.faculty_id || "",
      room:
        entry.room ||
        entry.room_no ||
        entry.allocation ||
        entry.roomNumber ||
        "TBA",
      type:
        entry.type ||
        (entry.subject === "Lunch" || entry.subject === "Break"
          ? "break"
          : "lecture"),
    };
  });
};

export default function TeacherTimetableScreen({
  session,
  initialTab = "Class Timetable",
}) {
  const [records, setRecords] = useState([]);
  const [teacherRecords, setTeacherRecords] = useState([]);
  const [periodSlots, setPeriodSlots] = useState([]);
  const [tab, setTab] = useState(() => initialTab || "Class Timetable");
  const [academicSession, setAcademicSession] = useState(
    session?.academicYearId ||
      session?.academic_year_id ||
      session?.academic_year ||
      "",
  );
  const [className, setClassName] = useState("Class_1");
  const [classId, setClassId] = useState("");
  const [sectionFilter, setSectionFilter] = useState(
    "All Divisions / Sections (Full Class)",
  );
  const [sectionId, setSectionId] = useState("");
  const [showAllPeriods, setShowAllPeriods] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [selectedCell, setSelectedCell] = useState(null);
  const [facultyMember, setFacultyMember] = useState(() => {
    const currentName = session?.name || session?.user?.name || "Teacher";
    const currentId = session?.id || session?.user?.id || "staff";
    return `${currentName} (${currentId})`;
  });
  const [assignedOnly, setAssignedOnly] = useState(true);
  const [classOptions, setClassOptions] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([
    "All Divisions / Sections (Full Class)",
  ]);

  useEffect(() => {
    let active = true;

    const fetchTimetable = async () => {
      if (!session) {
        if (active) {
          setRecords([]);
          setTeacherRecords([]);
          setPeriodSlots([]);
          setClassOptions([]);
        }
        return;
      }

      if (active) {
        setLoading(true);
        setRefreshError("");
        if (tab === "Class Timetable") {
          setRecords([]);
          setPeriodSlots([]);
        }
      }

      try {
        const [defaultClasses, liveTimetable, liveSessions] = await Promise.all(
          [
            teacherAttendanceApi.getAcademicClasses(session),
            tab === "Class Timetable"
              ? classId && sectionId && academicSession
                ? teacherApi.getClassTimetable(session, {
                    academic_year_id: academicSession,
                    class_id: classId,
                    division_id: sectionId,
                  })
                : Promise.resolve([])
              : teacherApi.getTimetable(session, {
                  academic_year_id: academicSession,
                }),
            teacherApi.getTimetableSessions(session, academicSession),
          ],
        );

        if (!active) return;

        const nextRecords = normalizeTimetableRecords(liveTimetable);
        const classList = (
          defaultClasses.length
            ? defaultClasses
            : Array.from(
                new Set(nextRecords.map((item) => item.className)),
              ).map((item) => ({ id: item, label: item }))
        ).map((item) => {
          const rawId =
            item.id ?? item.value ?? item.label ?? item.name ?? item;
          const rawLabel =
            item.label ?? item.name ?? item.id ?? item.value ?? item;
          return { id: String(rawId), label: String(rawLabel) };
        });

        const selectedClass =
          classList.find(
            (option) => option.label === className || option.id === className,
          ) || classList[0];
        let availableDivisions = [];
        if (selectedClass && session) {
          try {
            const divisions = await teacherAttendanceApi.getAcademicDivisions(
              session,
              selectedClass.id,
            );
            availableDivisions = divisions.length
              ? divisions.map((division) => ({
                  id: String(division.id),
                  label: String(division.label || division.name || division.id),
                }))
              : Array.from(
                  new Set(
                    nextRecords
                      .filter((item) => item.className === selectedClass.label)
                      .map((item) => item.section),
                  ),
                ).map((label) => ({ id: String(label), label: String(label) }));
            if (active)
              setSectionOptions([
                "All Divisions / Sections (Full Class)",
                ...availableDivisions,
              ]);
          } catch (requestError) {
            availableDivisions = Array.from(
              new Set(
                nextRecords
                  .filter((item) => item.className === selectedClass.label)
                  .map((item) => item.section),
              ),
            ).map((label) => ({ id: String(label), label: String(label) }));
            if (active)
              setSectionOptions([
                "All Divisions / Sections (Full Class)",
                ...availableDivisions,
              ]);
            if (
              requestError instanceof ApiError &&
              requestError.status !== 404
            ) {
              if (active) setRefreshError(requestError.message);
            }
          }
        }

        if (active) {
          const nextClassOptions = classList.length
            ? classList
            : [{ id: "Class_1", label: "Class_1" }];
          const nextAcademicOptions = Array.from(
            new Set(
              nextRecords
                .map((item) => String(item.academicSession ?? "").trim())
                .filter(Boolean),
            ),
          );

          const displayRecords =
            tab === "Class Timetable" &&
            (!classId || !sectionId || !academicSession)
              ? []
              : nextRecords;
          setRecords(displayRecords);
          setTeacherRecords(normalizeTimetableRecords(liveTimetable));
          setPeriodSlots(
            (liveSessions || []).length
              ? (liveSessions || [])
                  .map((item, index) => ({
                    id: item.id || item.session_name || `session-${index}`,
                    name:
                      item.session_name || item.name || `Period ${index + 1}`,
                    startTime: item.start_time || item.startTime || "",
                    endTime: item.end_time || item.endTime || "",
                  }))
                  .filter((item) => item.startTime && item.endTime)
              : nextRecords.map((item, index) => ({
                  id: item.periodKey || `period-${index}`,
                  name: item.period,
                  startTime: item.startTime,
                  endTime: item.endTime,
                })),
          );
          setClassOptions(nextClassOptions);
          if (!academicSession && nextAcademicOptions.length) {
            setAcademicSession(nextAcademicOptions[0]);
          }
          const currentClassMatches = classList.find(
            (option) => option.label === className || option.id === className,
          );
          if (currentClassMatches) {
            setClassName(currentClassMatches.label);
            setClassId(currentClassMatches.id);
          } else if (nextClassOptions.length) {
            setClassName(nextClassOptions[0].label);
            setClassId(nextClassOptions[0].id);
          }
          const selectedDivision = availableDivisions.find(
            (division) =>
              String(division?.id) === String(sectionId) ||
              division?.label === sectionFilter ||
              division?.name === sectionFilter,
          );
          if (selectedDivision) {
            setSectionId(String(selectedDivision.id));
            setSectionFilter(
              selectedDivision.label ||
                selectedDivision.name ||
                String(selectedDivision.id),
            );
          } else if (availableDivisions.length) {
            setSectionId(String(availableDivisions[0].id));
          }
        }
      } catch (requestError) {
        if (active) {
          setRefreshError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to refresh timetable data.",
          );
          setRecords([]);
          setTeacherRecords([]);
          setClassOptions([]);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void fetchTimetable();
    return () => {
      active = false;
    };
  }, [
    academicSession,
    classId,
    sectionId,
    className,
    sectionFilter,
    session,
    tab,
  ]);

  const availableAcademicSessions = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((item) => String(item.academicSession ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [records],
  );

  const teacherPeriodsForMatrix = useMemo(() => {
    const periods = new Map();

    const pushPeriod = (entry) => {
      const rawLabel =
        entry?.label ||
        entry?.name ||
        entry?.period ||
        entry?.slot ||
        "Period_1";
      const id = normalizePeriodKey(rawLabel);
      if (!periods.has(id)) {
        periods.set(id, {
          id,
          label: rawLabel,
          name: rawLabel,
          startTime: entry?.startTime || entry?.start_time || "09:00",
          endTime: entry?.endTime || entry?.end_time || "09:40",
        });
      }
    };

    teacherRecords.forEach((item) => {
      pushPeriod({
        label: item.period || item.period_name || item.slot || "Period_1",
        startTime: item.startTime || item.start_time,
        endTime: item.endTime || item.end_time,
      });
    });

    periodSlots.forEach((slot) => {
      pushPeriod({
        label: slot.name || slot.session_name || slot.id || "Period_1",
        startTime: slot.startTime || slot.start_time,
        endTime: slot.endTime || slot.end_time,
      });
    });

    if (!periods.size) {
      return periodTemplates.map((slot) => ({
        id: normalizePeriodKey(slot.name),
        label: slot.name,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));
    }

    return Array.from(periods.values());
  }, [periodSlots, teacherRecords]);

  const effectiveAcademicSession =
    academicSession || availableAcademicSessions[0] || "";

  const effectiveClassName = classOptions.some(
    (option) => option.label === className || option.id === className,
  )
    ? className
    : classOptions[0]?.label || className;

  const sectionOptionsForClass = useMemo(() => {
    const fallbackValues =
      sectionOptions.length > 1
        ? sectionOptions.slice(1)
        : Array.from(
            new Set(
              records
                .filter((item) => item.className === effectiveClassName)
                .map((item) => item.section),
            ),
          );

    return ["All Divisions / Sections (Full Class)", ...fallbackValues];
  }, [effectiveClassName, records, sectionOptions]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      if (
        String(item.academicSession ?? "") !== String(effectiveAcademicSession)
      ) {
        return false;
      }
      if (item.className !== effectiveClassName) return false;
      if (
        sectionFilter !== "All Divisions / Sections (Full Class)" &&
        item.section !== sectionFilter
      ) {
        return false;
      }
      return true;
    });
  }, [effectiveAcademicSession, effectiveClassName, records, sectionFilter]);

  const normalizedPeriodSlots = useMemo(() => {
    const sourcePeriods = periodSlots.length ? periodSlots : [];
    if (!sourcePeriods.length) {
      return periodTemplates.map((slot) => ({
        ...slot,
        id: normalizePeriodKey(slot.name),
        periodKey: normalizePeriodKey(slot.name),
        name: slot.name,
      }));
    }

    return sourcePeriods.map((slot) => {
      const periodKey = getPeriodSlotKey(slot);
      return {
        ...slot,
        id: periodKey,
        periodKey,
        name: slot.name || slot.session_name || slot.label || slot.id || "Period_1",
      };
    });
  }, [periodSlots]);

  const periodList = useMemo(() => {
    if (showAllPeriods) {
      return normalizedPeriodSlots;
    }
    return normalizedPeriodSlots.filter((period) =>
      filteredRecords.some(
        (item) => getEntryPeriodKey(item) === period.periodKey,
      ),
    );
  }, [filteredRecords, normalizedPeriodSlots, showAllPeriods]);

  const columnEntries = useMemo(() => {
    const map = {};
    days.forEach((day) => {
      map[day] = {};
      periodList.forEach((period) => {
        const key = period.periodKey || period.id;
        map[day][key] = filteredRecords.filter(
          (item) =>
            normalizeDayName(item.day) === day &&
            getEntryPeriodKey(item) === key,
        );
      });
    });
    return map;
  }, [filteredRecords, periodList]);

  const allocatedSlots = filteredRecords.length;

  const facultyOptions = useMemo(() => {
    const set = new Set(
      teacherRecords.map((item) => {
        const facultyName = item.facultyName || item.teacher || "Staff";
        const facultyId =
          item.facultyId || item.staffId || item.teacherId || "staff";
        return `${facultyName} (${facultyId})`;
      }),
    );
    return Array.from(set);
  }, [teacherRecords]);

  const selectedFacultyName = useMemo(
    () => facultyMember.split(" (")[0],
    [facultyMember],
  );

  const teacherFilteredRecords = useMemo(() => {
    const sessionRecords = teacherRecords.filter((item) => {
      const recordSession = String(item.academicSession ?? "").trim();
      return (
        !recordSession ||
        recordSession === String(effectiveAcademicSession || "")
      );
    });

    if (assignedOnly) {
      return sessionRecords.filter((item) => {
        const facultyName = String(
          item.facultyName || item.teacher || "",
        ).trim();
        const staffId = String(
          item.staffId || item.facultyId || item.teacherId || "",
        );
        const currentSessionId = String(
          session?.id || session?.user?.id || session?.staff_id || "",
        );
        const facultyKey = facultyName.toLowerCase();
        const selectedKey = selectedFacultyName.toLowerCase();
        return (
          facultyKey === selectedKey ||
          facultyKey.includes(selectedKey) ||
          selectedKey.includes(facultyKey) ||
          (currentSessionId && staffId && currentSessionId === staffId)
        );
      });
    }
    return sessionRecords;
  }, [
    assignedOnly,
    effectiveAcademicSession,
    selectedFacultyName,
    session,
    teacherRecords,
  ]);

  const weeklyWorkload = teacherFilteredRecords.length;
  const dailyAverage = (weeklyWorkload / 6).toFixed(1);
  const uniqueSubjects = new Set(
    teacherFilteredRecords.map((item) => item.subject.trim()),
  ).size;

  const teacherMatrixMap = useMemo(() => {
    const map = {};
    days.forEach((day) => {
      map[day] = {};
      teacherPeriodsForMatrix.forEach((period) => {
        map[day][period.id] = teacherFilteredRecords.filter((item) => {
          const recordDay = normalizeDayName(item.day);
          const recordPeriod = normalizePeriodKey(
            item.periodKey || item.period || item.period_name || item.slot,
          );
          return recordDay === day && recordPeriod === period.id;
        });
      });
    });
    return map;
  }, [teacherFilteredRecords, teacherPeriodsForMatrix]);

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    setRefreshError("");
  };

  const statusMessage = refreshError || (loading ? "Loading timetable..." : "");

  const handlePrintSchedule = () => {
    Alert.alert(
      "Print Schedule",
      "This action is ready to connect to a print/export service.",
    );
  };

  const teacherTimetableSubView = (
    <View style={styles.teacherView}>
      <View style={styles.headerCard}>
        <View style={styles.headerRowWrap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>My Teaching Schedule</Text>
            <Text style={styles.subtitle}>
              View your personal weekly teaching workload, subject duties, and
              classrooms
            </Text>
          </View>
          <Pressable style={styles.printButton} onPress={handlePrintSchedule}>
            <Icon name="print-outline" size={17} color={colors.blue} />
            <Text style={styles.printText}>Print Schedule</Text>
          </Pressable>
        </View>
        <Text style={styles.sessionLabel}>Session: {academicSession}</Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          icon="person-outline"
          title="Assigned Teacher"
          value={selectedFacultyName}
          label="Assigned Teacher"
          tint={colors.paleBlue}
          accent={colors.blue}
        />
        <SummaryCard
          icon="bar-chart-outline"
          title="Weekly Workload"
          value={`${weeklyWorkload} Periods`}
          label="Weekly Workload"
          tint={colors.paleTeal}
          accent={colors.teal}
        />
        <SummaryCard
          icon="stats-chart-outline"
          title="Average Daily Load"
          value={`${dailyAverage} / Day`}
          label="Avg Daily Load"
          tint={colors.paleOrange}
          accent={colors.orange}
        />
        <SummaryCard
          icon="library-outline"
          title="Assigned Subjects"
          value={`${uniqueSubjects} Subjects`}
          label="Assigned Subjects"
          tint={colors.softLilac}
          accent={colors.plum}
        />
      </View>

      <View style={styles.filtersCard}>
        <FilterSelect
          label="Academic Session"
          value={effectiveAcademicSession || "Select Session"}
          options={availableAcademicSessions}
          onChange={setAcademicSession}
        />

        <FilterSelect
          label="Faculty Member"
          value={facultyMember}
          options={facultyOptions}
          onChange={setFacultyMember}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Assigned Only</Text>
          <Pressable
            style={[
              styles.toggleSwitch,
              assignedOnly && styles.toggleSwitchActive,
            ]}
            onPress={() => setAssignedOnly((current) => !current)}
          >
            <View
              style={[
                styles.toggleThumb,
                assignedOnly && styles.toggleThumbActive,
              ]}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.matrixWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.teacherMatrixTable}>
            <View style={styles.headerRow}>
              <View style={styles.periodHeaderCell}>
                <Text style={styles.headerText}>Period / Time</Text>
              </View>
              {days.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={styles.headerText}>{day}</Text>
                </View>
              ))}
            </View>

            {teacherPeriodsForMatrix.map((period) => (
              <View key={period.id} style={styles.periodRow}>
                <View style={styles.periodCell}>
                  <Text style={styles.periodName}>{period.label}</Text>
                  <Text style={styles.periodTime}>
                    {period.startTime} - {period.endTime}
                  </Text>
                </View>
                {days.map((day) => {
                  const rowEntries = teacherMatrixMap[day]?.[period.id] || [];
                  return (
                    <Pressable
                      key={`${day}-${period.id}`}
                      style={[
                        styles.teacherDayCell,
                        !rowEntries.length && styles.teacherDayCellEmpty,
                      ]}
                      onPress={() => {
                        if (rowEntries.length) {
                          setSelectedCell({ day, period, entries: rowEntries });
                        }
                      }}
                    >
                      {rowEntries.length ? (
                        rowEntries.map((entry) => (
                          <View key={entry.id} style={styles.subjectCard}>
                            <Text style={styles.subjectText} numberOfLines={2}>
                              {entry.subject}
                            </Text>
                            <Text style={styles.metaText}>
                              Class {entry.className} - {entry.section}
                            </Text>
                            {entry.room ? (
                              <Text style={styles.metaText}>
                                Room: {entry.room}
                              </Text>
                            ) : null}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.emptyCellText}>—</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topTabs}>
        {["Class Timetable", "Teacher Timetable"].map((item) => (
          <Pressable
            key={item}
            style={[styles.topTab, tab === item && styles.topTabActive]}
            onPress={() => setTab(item)}
          >
            <Text
              style={[
                styles.topTabText,
                tab === item && styles.topTabTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "Class Timetable" ? (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Master Class Timetable</Text>
              <Text style={styles.subtitle}>
                Design, assign, and manage weekly classroom lecture schedules by
                division or grade
              </Text>
            </View>
            <Pressable
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.blue} />
              ) : (
                <Icon name="refresh-outline" size={17} color={colors.blue} />
              )}
              <Text style={styles.refreshText}>
                {refreshing ? "Refreshing..." : "Refresh Matrix"}
              </Text>
            </Pressable>
            <Text style={styles.sessionLabel}>Session: {academicSession}</Text>
          </View>

          {statusMessage ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          <View style={styles.summaryGrid}>
            <SummaryCard
              icon="school-outline"
              title="Class"
              value={className}
              label="Grade Target"
              tint={colors.paleBlue}
              accent={colors.blue}
            />
            <SummaryCard
              icon="calendar-outline"
              title="Working Days"
              value="6 Days"
              label="Working Days"
              tint={colors.paleTeal}
              accent={colors.teal}
            />
            <SummaryCard
              icon="time-outline"
              title="Period Slots"
              value={String(periodTemplates.length)}
              label="Period Slots"
              tint={colors.paleOrange}
              accent={colors.orange}
            />
            <SummaryCard
              icon="briefcase-outline"
              title="Allocated Slots"
              value={String(allocatedSlots)}
              label="Scheduled"
              tint={colors.softLilac}
              accent={colors.plum}
            />
            <SummaryCard
              icon="document-text-outline"
              title="Academic Session"
              value={academicSession}
              label="Current cycle"
              tint={colors.paleBlue}
              accent={colors.blue}
            />
          </View>

          <View style={styles.filtersCard}>
            <FilterSelect
              label="Academic Session"
              value={effectiveAcademicSession || "Select Session"}
              options={availableAcademicSessions}
              onChange={setAcademicSession}
            />
            <FilterSelect
              label="Class / Grade"
              value={className}
              options={classOptions}
              onChange={(option) => {
                const nextClass =
                  typeof option === "string"
                    ? { id: option, label: option }
                    : option;
                setClassName(nextClass.label || nextClass.id);
                setClassId(String(nextClass.id || ""));
                setSectionFilter("All Divisions / Sections (Full Class)");
                setSectionId("");
              }}
            />
            <FilterSelect
              label="Division / Section"
              value={sectionFilter}
              options={[
                "All Divisions / Sections (Full Class)",
                ...sectionOptionsForClass,
              ]}
              onChange={(option) => {
                const nextDivision =
                  typeof option === "string"
                    ? { id: option, label: option }
                    : option;
                setSectionFilter(nextDivision.label || nextDivision.id);
                setSectionId(String(nextDivision.id || ""));
              }}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show All Periods</Text>
              <Pressable
                style={[
                  styles.toggleSwitch,
                  showAllPeriods && styles.toggleSwitchActive,
                ]}
                onPress={() => setShowAllPeriods((current) => !current)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    showAllPeriods && styles.toggleThumbActive,
                  ]}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.matrixWrap}>
            {!loading && !refreshError && !filteredRecords.length ? (
              <View style={styles.emptyState}>
                <Icon name="calendar-outline" size={28} color={colors.muted} />
                <Text style={styles.emptyStateTitle}>
                  No timetable available for the selected class and division.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.matrixTable}>
                  <View style={styles.headerRow}>
                    <View style={styles.periodHeaderCell}>
                      <Text style={styles.headerText}>Period</Text>
                    </View>
                    {days.map((day) => (
                      <View key={day} style={styles.dayHeaderCell}>
                        <Text style={styles.headerText}>{day}</Text>
                      </View>
                    ))}
                  </View>

                  {periodList.map((period) => (
                    <View key={period.id} style={styles.periodRow}>
                      <View style={styles.periodCell}>
                        <Text style={styles.periodName}>{period.name}</Text>
                        <Text style={styles.periodTime}>
                          {period.startTime} - {period.endTime}
                        </Text>
                      </View>
                      {days.map((day) => {
                        const periodKey = period.periodKey || period.id;
                        const entries = getDisplayEntries(
                          columnEntries[day]?.[periodKey] || [],
                        );
                        return (
                          <Pressable
                            key={`${day}-${periodKey}`}
                            style={[
                              styles.dayCell,
                              !entries.length && styles.dayCellEmpty,
                            ]}
                            onPress={() =>
                              entries.length &&
                              setSelectedCell({ day, period, entries })
                            }
                          >
                            {entries.length ? (
                              <>
                                <Text style={styles.cellCount}>
                                  {entries.length}{" "}
                                  {entries.length === 1
                                    ? "Section"
                                    : "Sections"}
                                </Text>
                                {entries.slice(0, 2).map((entry) => (
                                  <Text
                                    key={entry.id}
                                    style={styles.cellSubject}
                                    numberOfLines={2}
                                  >
                                    {entry.subject}
                                  </Text>
                                ))}
                                {entries.length > 2 ? (
                                  <Text style={styles.cellSubjectMuted}>
                                    +{entries.length - 2} more
                                  </Text>
                                ) : null}
                              </>
                            ) : (
                              <Text style={styles.emptyCellText}>-</Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </>
      ) : (
        teacherTimetableSubView
      )}

      <Modal
        transparent
        visible={Boolean(selectedCell)}
        animationType="fade"
        onRequestClose={() => setSelectedCell(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedCell(null)}
        >
          <View
            style={styles.detailSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Timetable Details</Text>
              <Pressable hitSlop={10} onPress={() => setSelectedCell(null)}>
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {selectedCell ? (
              <View style={styles.detailList}>
                <Text style={styles.detailMeta}>
                  <Text style={styles.detailKey}>Day:</Text> {selectedCell.day}
                </Text>
                <Text style={styles.detailMeta}>
                  <Text style={styles.detailKey}>Period:</Text>{" "}
                  {selectedCell.period.label || selectedCell.period.name}
                </Text>
                <Text style={styles.detailMeta}>
                  <Text style={styles.detailKey}>Start Time:</Text>{" "}
                  {selectedCell.period.startTime}
                </Text>
                <Text style={styles.detailMeta}>
                  <Text style={styles.detailKey}>End Time:</Text>{" "}
                  {selectedCell.period.endTime}
                </Text>
                {selectedCell.entries.map((entry, index) => (
                  <View key={`${entry.id}-${index}`} style={styles.detailEntry}>
                    <Text style={styles.detailEntryTitle}>{entry.subject}</Text>
                    <Text style={styles.detailMeta}>
                      <Text style={styles.detailKey}>Teacher:</Text>{" "}
                      {entry.teacher || selectedFacultyName}
                    </Text>
                    <Text style={styles.detailMeta}>
                      <Text style={styles.detailKey}>Section:</Text>{" "}
                      {entry.section}
                    </Text>
                    <Text style={styles.detailMeta}>
                      <Text style={styles.detailKey}>Class:</Text>{" "}
                      {entry.className}
                    </Text>
                    <Text style={styles.detailMeta}>
                      <Text style={styles.detailKey}>Academic Session:</Text>{" "}
                      {entry.academicSession || academicSession}
                    </Text>
                    <Text style={styles.detailMeta}>
                      <Text style={styles.detailKey}>Room:</Text>{" "}
                      {entry.room || "TBA"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 140 },
  topTabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  topTab: {
    flex: 1,
    minHeight: 42,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  topTabActive: { backgroundColor: colors.paleBlue, borderColor: colors.blue },
  topTabText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  topTabTextActive: { color: colors.blue },
  teacherView: { gap: 12 },
  headerCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 2,
  },
  headerRowWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextWrap: { marginBottom: 10 },
  title: { fontSize: 23, fontWeight: "900", color: colors.ink },
  subtitle: { marginTop: 5, color: colors.muted, fontSize: 11 },
  printButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: colors.paleBlue,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  printText: { color: colors.blue, fontWeight: "800", fontSize: 12 },
  refreshButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: colors.paleBlue,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: { color: colors.blue, fontWeight: "800", fontSize: 12 },
  sessionLabel: {
    marginTop: 10,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  summaryCard: {
    width: "31%",
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  summaryTitle: {
    marginTop: 9,
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  summaryValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  summaryLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 8,
    textTransform: "uppercase",
  },
  filtersCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 2,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  select: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: colors.ink, fontSize: 12, flex: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  toggleLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  toggleSwitch: {
    width: 46,
    height: 28,
    borderRadius: 16,
    backgroundColor: "#D8E2E4",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleSwitchActive: { backgroundColor: colors.blue },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    marginLeft: 0,
  },
  toggleThumbActive: { marginLeft: 18 },
  matrixWrap: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: "hidden",
  },
  matrixTable: { minWidth: 700 },
  teacherMatrixTable: { minWidth: 760 },
  statusBanner: {
    backgroundColor: "#FFF5EA",
    borderWidth: 1,
    borderColor: "#F2D8B3",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  statusText: { color: "#B96A1A", fontSize: 11, fontWeight: "700" },
  headerRow: { flexDirection: "row", backgroundColor: colors.navy },
  periodHeaderCell: {
    width: 120,
    minHeight: 46,
    padding: 8,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
  },
  dayHeaderCell: {
    width: 120,
    minHeight: 46,
    padding: 8,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: { color: colors.white, fontWeight: "800", fontSize: 11 },
  periodRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  periodCell: {
    width: 120,
    minHeight: 130,
    backgroundColor: colors.paleBlue,
    padding: 8,
    borderRightWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
  },
  periodName: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  periodTime: { marginTop: 4, color: colors.muted, fontSize: 10 },
  dayCell: {
    width: 120,
    minHeight: 115,
    padding: 8,
    borderRightWidth: 1,
    borderColor: colors.line,
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  teacherDayCell: {
    width: 120,
    minHeight: 130,
    padding: 8,
    borderRightWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  teacherDayCellEmpty: { backgroundColor: "#F9FBFB" },
  dayCellEmpty: { backgroundColor: "#F9FBFB" },
  cellCount: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 4,
  },
  cellSubject: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  cellSubjectMuted: { color: colors.muted, fontSize: 9 },
  subjectCard: {
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 6,
    marginBottom: 5,
  },
  subjectText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  metaText: { color: colors.muted, fontSize: 9, marginTop: 3 },
  emptyCellText: { color: colors.muted, textAlign: "center", fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 19, 27, 0.35)",
    justifyContent: "flex-end",
  },
  optionsSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "60%",
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  optionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  optionRow: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  optionActive: { backgroundColor: colors.paleBlue },
  optionText: { color: colors.ink, fontSize: 13 },
  optionTextActive: { color: colors.blue, fontWeight: "800" },
  detailSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "75%",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  detailList: { gap: 8 },
  detailMeta: { color: colors.ink, fontSize: 12 },
  detailKey: { fontWeight: "800" },
  detailEntry: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    padding: 10,
    marginTop: 6,
  },
  detailEntryTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
});
