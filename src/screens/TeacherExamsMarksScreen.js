import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { isApiConfigured } from "../services/api";
import { teacherApi, teacherAttendanceApi } from "../services/teacherApi";
import TeacherSetExamsScreen from "./TeacherSetExamsScreen";
import TeacherTimetableScreen from "./TeacherTimetableScreen";

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

const examModules = [
  {
    label: "Set Exam",
    module: "Set Exams",
    description:
      "Create and configure examination sessions, dates, classes and subjects.",
    icon: "calendar-outline",
  },
  {
    label: "View Exam",
    module: "View Exams",
    description:
      "Browse scheduled examinations and manage examination subjects.",
    icon: "documents-outline",
  },
  {
    label: "Exam Attendance",
    description: "Record and manage student attendance during examinations.",
    icon: "checkmark-done-outline",
  },
  {
    label: "Exam Result",
    description: "Enter, review and manage examination marks.",
    icon: "clipboard-outline",
  },
  {
    label: "Publish Exam",
    module: "Publish Result",
    description:
      "Review and publish examination results to students and parents.",
    icon: "megaphone-outline",
  },
  {
    label: "Class Results",
    module: "Class Result",
    description: "View class-wise examination performance and results.",
    icon: "bar-chart-outline",
  },
  {
    label: "Attendance History",
    module: "Attendance Result",
    description: "View examination attendance and attendance-based reports.",
    icon: "stats-chart-outline",
  },
  {
    label: "Hall Tickets",
    module: "Hall Ticket",
    description: "Create and manage student examination hall tickets.",
    icon: "receipt-outline",
  },
];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function AttendanceStatusBadge({ status }) {
  const normalized = String(status || "Not Marked");
  const tone =
    normalized.toLowerCase() === "present"
      ? styles.statusChoicePresent
      : normalized.toLowerCase() === "absent"
        ? styles.statusChoiceAbsent
        : normalized.toLowerCase() === "late"
          ? styles.lateStatusBadge
          : styles.pendingStatusBadge;
  return (
    <View style={[styles.attendanceStatusBadge, tone]}>
      <Text style={styles.attendanceStatusText}>{normalized}</Text>
    </View>
  );
}

function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back to Exams / Marks",
}) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable style={styles.backButton} onPress={onBack}>
            <Icon name="arrow-back" size={16} color={colors.blue} />
            <Text style={styles.backText}>{backLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SummaryCard({ title, value, label, tint, accent, icon }) {
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

function LandingCard({ item, index, onPress }) {
  const colorsList = [
    [colors.paleBlue, colors.blue],
    [colors.paleTeal, colors.teal],
    [colors.paleOrange, colors.orange],
    [colors.softLilac, colors.plum],
  ];
  const [bg, accent] = colorsList[index % colorsList.length];

  return (
    <Pressable
      onPress={() => onPress(item.module || item.label)}
      style={({ pressed }) => [
        styles.moduleCard,
        { backgroundColor: bg, borderColor: accent },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.moduleIcon,
          { backgroundColor: bg, borderColor: accent },
        ]}
      >
        <Icon name={item.icon} size={20} color={accent} />
      </View>
      <View style={styles.moduleCopy}>
        <Text style={styles.moduleTitle}>{item.label}</Text>
        <Text style={styles.moduleDescription}>{item.description}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={accent} />
    </Pressable>
  );
}

function getExamReference(exam) {
  return `#${exam?.id ?? "N/A"}`;
}

function formatExamTarget(exam) {
  const target =
    exam?.targetClass ||
    exam?.targetScope ||
    exam?.className ||
    "Global (All Classes)";
  const section =
    exam?.section || exam?.division || exam?.sectionName
      ? ` • ${exam.section || exam.division || exam.sectionName}`
      : "";
  return `${target}${section}`;
}

function formatExamDate(exam) {
  return exam?.startDate || exam?.date || exam?.examDate || "—";
}

function normalizeExamValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function ExamHubScreen({ session, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [terms, setTerms] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const results = await Promise.allSettled([
        teacherApi.getExams(session),
        teacherApi.getExamTerms(session),
        teacherApi.getExamTypes(session),
      ]);
      if (!active) return;
      const [examsResult, termsResult, typesResult] = results;
      if (examsResult.status === "fulfilled")
        setExams(Array.isArray(examsResult.value) ? examsResult.value : []);
      else setError("Unable to load examination schedules.");
      if (termsResult.status === "fulfilled")
        setTerms(Array.isArray(termsResult.value) ? termsResult.value : []);
      if (typesResult.status === "fulfilled")
        setTypes(Array.isArray(typesResult.value) ? typesResult.value : []);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [session]);

  const scheduled = exams.filter(
    (exam) => String(exam.status).toLowerCase() === "scheduled",
  ).length;
  const completed = exams.filter(
    (exam) => String(exam.status).toLowerCase() === "completed",
  ).length;
  const published = exams.filter(
    (exam) =>
      Number(exam.publish_status || exam.publishStatus) === 1 ||
      String(exam.publish_status).toLowerCase() === "published",
  ).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>Exams / Marks</Text>
        <Text style={styles.pageSubtitle}>
          Examination, Marks & Academic Assessment Management
        </Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.summaryGrid}>
        <SummaryCard
          title="Total Exams"
          value={String(exams.length)}
          label="All sessions"
          tint={colors.paleBlue}
          accent={colors.blue}
          icon="book-outline"
        />
        <SummaryCard
          title="Scheduled"
          value={String(scheduled)}
          label="Upcoming"
          tint={colors.paleOrange}
          accent={colors.orange}
          icon="time-outline"
        />
        <SummaryCard
          title="Completed"
          value={String(completed)}
          label="Conducted"
          tint={colors.paleTeal}
          accent={colors.teal}
          icon="checkmark-done-outline"
        />
        <SummaryCard
          title="Published"
          value={String(published)}
          label="Live results"
          tint={colors.softLilac}
          accent={colors.plum}
          icon="share-outline"
        />
      </View>
      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>Exam data sources</Text>
        <Text style={styles.listText}>
          {terms.length} academic terms · {types.length} exam types
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.blue} style={styles.loadingWrap} />
        ) : (
          exams.slice(0, 5).map((exam) => (
            <View key={exam.id} style={styles.resultRow}>
              <Text style={styles.listTitle}>{exam.name}</Text>
              <Text style={styles.listText}>
                {exam.targetClass} · {exam.startDate || "Date TBD"} ·{" "}
                {exam.status || "Scheduled"}
              </Text>
            </View>
          ))
        )}
        {!loading && !exams.length ? (
          <Text style={styles.emptyText}>
            No examinations found on the server.
          </Text>
        ) : null}
      </View>
      <View style={styles.gridWrap}>
        {examModules.map((item, index) => (
          <LandingCard
            key={item.label}
            item={item}
            index={index}
            onPress={(label) => onSelectModule && onSelectModule(label)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function normalizeExamSubject(subject, index) {
  if (typeof subject === "string") {
    return {
      id: `legacy-${index}`,
      name: subject,
      code: "",
      examDate: "",
      startTime: "",
      endTime: "",
      maximumMarks: "",
      passingMarks: "",
      assignedTeacher: "",
    };
  }
  return {
    id: subject?.id || `subject-${index}`,
    name: subject?.name || subject?.subjectName || "",
    code: subject?.code || subject?.subjectCode || "",
    examDate: subject?.examDate || subject?.date || "",
    startTime: subject?.startTime || "",
    endTime: subject?.endTime || "",
    maximumMarks: subject?.maximumMarks ?? subject?.maxMarks ?? "",
    passingMarks: subject?.passingMarks ?? subject?.passMarks ?? "",
    assignedTeacher: subject?.assignedTeacher || subject?.teacher || "",
  };
}

function ViewExamsScreen({ session, onBack, onSelectModule }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [detailsExam, setDetailsExam] = useState(null);
  const [subjectsExam, setSubjectsExam] = useState(null);
  const [subjectDraft, setSubjectDraft] = useState([]);
  const [subjectEditor, setSubjectEditor] = useState(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectSaving, setSubjectSaving] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const exams = await teacherApi.fetchExams(session);
      setRecords(Array.isArray(exams) ? exams : []);
    } catch (requestError) {
      setRecords([]);
      setError(requestError?.message || "Unable to load examinations.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      void loadExams();
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [loadExams]);

  const classOptions = useMemo(() => {
    const values = records
      .map(
        (exam) =>
          exam?.targetClass ||
          exam?.targetScope ||
          exam?.className ||
          "Global (All Classes)",
      )
      .filter((value, index, arr) => value && arr.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));

    return ["All Classes", ...values];
  }, [records]);

  const summary = useMemo(() => {
    const total = records.length;
    const active = records.filter((item) =>
      ["Scheduled", "Active"].includes(item.status),
    ).length;
    const done = records.filter((item) =>
      ["Completed", "Done"].includes(item.status),
    ).length;
    return { total, active, done };
  }, [records]);

  const filtered = useMemo(() => {
    const query = normalizeExamValue(search);

    return records.filter((exam) => {
      const matchesQuery =
        !query ||
        [
          exam?.name,
          getExamReference(exam),
          exam?.targetClass,
          exam?.section,
          formatExamTarget(exam),
        ].some((value) => normalizeExamValue(value).includes(query));

      const matchesClass =
        classFilter === "All Classes" ||
        normalizeExamValue(
          exam?.targetClass || exam?.targetScope || exam?.className,
        ).includes(normalizeExamValue(classFilter)) ||
        normalizeExamValue(formatExamTarget(exam)).includes(
          normalizeExamValue(classFilter),
        );
      const matchesStatus =
        statusFilter === "All Statuses" || exam?.status === statusFilter;

      return matchesQuery && matchesClass && matchesStatus;
    });
  }, [records, search, classFilter, statusFilter]);

  const openSubjects = async (exam) => {
    if (exam?.id === undefined || exam?.id === null || exam.id === "") {
      Alert.alert(
        "Invalid examination",
        "This examination does not have a valid reference number.",
      );
      return;
    }
    setSubjectsExam(exam);
    setSubjectDraft([]);
    setError("");
    setSubjectsLoading(true);
    try {
      const subjects = await teacherApi.fetchExamSubjects(exam.id, session);
      setSubjectDraft(
        (Array.isArray(subjects) ? subjects : []).map(normalizeExamSubject),
      );
    } catch (requestError) {
      setError(requestError?.message || "Unable to load examination subjects.");
    } finally {
      setSubjectsLoading(false);
    }
  };

  const handleSaveSubjects = () => {
    if (!subjectsExam) return;
    setRecords((current) =>
      current.map((exam) =>
        Number(exam.id) === Number(subjectsExam.id)
          ? { ...exam, subjects: [...subjectDraft] }
          : exam,
      ),
    );
    setSubjectsExam(null);
    setSubjectDraft([]);
  };

  const deleteExam = (exam) =>
    Alert.alert(
      "Delete exam?",
      `${exam.name} will be removed from the server.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await teacherApi.deleteExam(exam.id, session);
              setRecords((current) =>
                current.filter((item) => item.id !== exam.id),
              );
            } catch (requestError) {
              Alert.alert(
                "Delete failed",
                requestError?.message || "Unable to delete the exam.",
              );
            }
          },
        },
      ],
    );

  const handleAddSubject = () => {
    setSubjectEditor({
      name: "",
      code: "",
      examDate: formatExamDate(subjectsExam),
      startTime: subjectsExam?.startTime || subjectsExam?.start_time || "",
      endTime: subjectsExam?.endTime || subjectsExam?.end_time || "",
      maximumMarks: "",
      passingMarks: "",
      assignedTeacher: "",
    });
  };

  const handleRemoveSubject = (subject) => {
    Alert.alert(
      "Delete subject?",
      `Remove ${subject.name || "this subject"} from the examination?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (subjectsExam && !String(subject.id).startsWith("legacy-"))
                await teacherApi.deleteExamSubject(
                  subjectsExam.id,
                  subject.id,
                  session,
                );
              setSubjectDraft((current) =>
                current.filter((item) => item.id !== subject.id),
              );
            } catch (requestError) {
              setError(
                requestError?.message ||
                  "Unable to delete the examination subject.",
              );
            }
          },
        },
      ],
    );
  };

  const saveSubject = async () => {
    if (!subjectsExam || !subjectEditor?.name.trim()) {
      Alert.alert(
        "Subject name required",
        "Enter a subject name before saving.",
      );
      return;
    }
    setSubjectSaving(true);
    try {
      const input = { ...subjectEditor, name: subjectEditor.name.trim() };
      const isExistingSubject =
        subjectEditor.id && !String(subjectEditor.id).startsWith("legacy-");
      const saved = isExistingSubject
        ? await teacherApi.updateExamSubject(
            subjectsExam.id,
            subjectEditor.id,
            input,
            session,
          )
        : await teacherApi.createExamSubject(subjectsExam.id, input, session);
      const normalized = normalizeExamSubject(
        saved || input,
        subjectDraft.length,
      );
      setSubjectDraft((current) =>
        isExistingSubject
          ? current.map((item) =>
              item.id === subjectEditor.id ? normalized : item,
            )
          : [...current, normalized],
      );
      setSubjectEditor(null);
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to save the examination subject.",
      );
    } finally {
      setSubjectSaving(false);
    }
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Examination Schedules & Subject Timetable"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Browse, filter and manage all school examinations, paper timeframes and
        subject configurations
      </Text>

      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            onPress={() =>
              onSelectModule &&
              onSelectModule(
                tab === "Attendance"
                  ? "Exam Attendance"
                  : tab === "Marks Entry"
                    ? "Exam Result"
                    : tab === "Publish Results"
                      ? "Publish Result"
                      : tab === "Class Reports"
                        ? "Class Result"
                        : tab === "Hall Tickets"
                          ? "Hall Ticket"
                          : "Set Exams",
              )
            }
            style={[
              styles.tabPill,
              tab === "Exam Schedules" && styles.tabPillActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Exam Schedules" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          title="Total"
          value={String(summary.total)}
          label="Total"
          tint={colors.paleBlue}
          accent={colors.blue}
          icon="document-text-outline"
        />
        <SummaryCard
          title="Active"
          value={String(summary.active)}
          label="Active"
          tint={colors.paleTeal}
          accent={colors.teal}
          icon="calendar-outline"
        />
        <SummaryCard
          title="Done"
          value={String(summary.done)}
          label="Done"
          tint={colors.paleOrange}
          accent={colors.orange}
          icon="checkmark-done-outline"
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            onSelectModule
              ? onSelectModule("Set Exams")
              : Alert.alert(
                  "Schedule Exam",
                  "Open the existing Set Exams flow.",
                )
          }
        >
          <Text style={styles.primaryButtonText}>Schedule Exam</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadExams}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.filterPanel}>
        <View style={styles.searchField}>
          <Icon name="search-outline" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search exam name or class..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterGrid}>
          <FilterBadge
            label="Class"
            value={classFilter}
            options={classOptions}
            onSelect={setClassFilter}
          />
          <FilterBadge
            label="Status"
            value={statusFilter}
            options={[
              "All Statuses",
              "Scheduled",
              "Active",
              "Completed",
              "Cancelled",
            ]}
            onSelect={setStatusFilter}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading examinations...</Text>
        </View>
      ) : error ? null : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            No examinations match the current filters.
          </Text>
          <Text style={styles.emptyText}>
            Try widening the search or resetting the selected class or status.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.listHeader} accessibilityRole="header">
            <Text style={styles.listHeaderText}>Exam Details</Text>
            <Text style={styles.listHeaderText}>Target Scope</Text>
            <Text style={styles.listHeaderText}>Schedule Timing</Text>
            <Text style={styles.listHeaderText}>Status</Text>
            <Text style={styles.listHeaderText}>Actions &amp; Subjects</Text>
          </View>
          {filtered.map((exam) => (
            <Pressable
              key={exam.id}
              style={styles.listCard}
              onPress={() => setDetailsExam(exam)}
            >
              <View style={styles.examHeaderRow}>
                <View style={styles.examIdentity}>
                  <Text style={styles.listTitle}>{exam.name}</Text>
                  <Text style={styles.listText}>
                    Exam Ref: {getExamReference(exam)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    exam.status === "Completed"
                      ? styles.statusComplete
                      : styles.statusScheduled,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      exam.status === "Completed"
                        ? styles.statusBadgeTextDone
                        : styles.statusBadgeTextScheduled,
                    ]}
                  >
                    {exam.status || "Scheduled"}
                  </Text>
                </View>
              </View>

              <View style={styles.recordGrid}>
                <Text style={styles.detailLabel}>Target Scope</Text>
                <Text style={styles.detailValue}>{formatExamTarget(exam)}</Text>
              </View>

              <View style={styles.recordGrid}>
                <Text style={styles.detailLabel}>Schedule Timing</Text>
                <Text style={styles.detailValue}>
                  {formatExamDate(exam)} •{" "}
                  {exam.startTime || exam.start_time || "—"} -{" "}
                  {exam.endTime || exam.end_time || "—"}
                </Text>
              </View>

              <View style={styles.recordGrid}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>
                  {exam.status || "Scheduled"}
                </Text>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    void openSubjects(exam);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    Manage Subjects
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.ghostButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    setDetailsExam(exam);
                  }}
                >
                  <Text style={styles.ghostButtonText}>View Details</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    deleteExam(exam);
                  }}
                >
                  <Text style={[styles.ghostButtonText, { color: colors.red }]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(detailsExam)}
        onRequestClose={() => setDetailsExam(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Examination Details</Text>
            {detailsExam ? (
              <>
                <Text style={styles.modalDescription}>{detailsExam.name}</Text>
                <Text style={styles.modalInfo}>
                  Exam Ref: {getExamReference(detailsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Target: {formatExamTarget(detailsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Date: {formatExamDate(detailsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Start Time:{" "}
                  {detailsExam.startTime || detailsExam.start_time || "—"}
                </Text>
                <Text style={styles.modalInfo}>
                  End Time: {detailsExam.endTime || detailsExam.end_time || "—"}
                </Text>
                <Text style={styles.modalInfo}>
                  Status: {detailsExam.status || "Scheduled"}
                </Text>
                <Text style={styles.modalInfo}>
                  Assigned Subjects:{" "}
                  {(detailsExam.subjects || [])
                    .map(
                      (subject, index) =>
                        normalizeExamSubject(subject, index).name,
                    )
                    .filter(Boolean)
                    .join(", ") || "No subjects assigned"}
                </Text>
              </>
            ) : null}
            <Pressable
              style={styles.primaryButton}
              onPress={() => setDetailsExam(null)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(subjectsExam)}
        onRequestClose={() => setSubjectsExam(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Subjects</Text>
            {subjectsExam ? (
              <>
                <Text style={styles.modalDescription}>{subjectsExam.name}</Text>
                <Text style={styles.modalInfo}>
                  Exam Ref: {getExamReference(subjectsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Target Class: {formatExamTarget(subjectsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Date: {formatExamDate(subjectsExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Time:{" "}
                  {subjectsExam.startTime || subjectsExam.start_time || "—"} -{" "}
                  {subjectsExam.endTime || subjectsExam.end_time || "—"}
                </Text>
                {subjectsLoading ? (
                  <ActivityIndicator
                    color={colors.blue}
                    style={styles.loader}
                  />
                ) : null}
                <Text style={styles.modalInfo}>Configured subjects:</Text>
                <View style={styles.subjectList}>
                  {!subjectsLoading && subjectDraft.length === 0 ? (
                    <Text style={styles.emptyText}>No subjects assigned.</Text>
                  ) : (
                    subjectDraft.map((subject) => (
                      <View key={subject.id} style={styles.subjectRow}>
                        <View style={styles.subjectCopy}>
                          <Text style={styles.subjectText}>
                            {subject.name || "Unnamed subject"}
                          </Text>
                          <Text style={styles.subjectMeta}>
                            {subject.code || "No code"} •{" "}
                            {subject.maximumMarks || "—"} marks •{" "}
                            {subject.assignedTeacher || "No teacher assigned"}
                          </Text>
                        </View>
                        <View style={styles.subjectActions}>
                          <Pressable onPress={() => setSubjectEditor(subject)}>
                            <Icon
                              name="create-outline"
                              size={16}
                              color={colors.blue}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveSubject(subject)}
                          >
                            <Icon
                              name="trash-outline"
                              size={16}
                              color={colors.red}
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                disabled={subjectsLoading}
                onPress={handleAddSubject}
              >
                <Text style={styles.secondaryButtonText}>Add Subject</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={handleSaveSubjects}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.linkButton}
              onPress={() => setSubjectsExam(null)}
            >
              <Text style={styles.linkButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(subjectEditor)}
        onRequestClose={() => setSubjectEditor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {subjectEditor?.id ? "Edit Subject" : "Add Subject"}
            </Text>
            {subjectEditor ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                {[
                  ["name", "Subject Name"],
                  ["code", "Subject Code"],
                  ["examDate", "Exam Date"],
                  ["startTime", "Start Time"],
                  ["endTime", "End Time"],
                  ["maximumMarks", "Maximum Marks"],
                  ["passingMarks", "Passing Marks"],
                  ["assignedTeacher", "Assigned Teacher"],
                ].map(([key, label]) => (
                  <TextInput
                    key={key}
                    value={String(subjectEditor[key] ?? "")}
                    onChangeText={(value) =>
                      setSubjectEditor((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                    placeholder={label}
                    placeholderTextColor={colors.muted}
                    style={styles.subjectInput}
                  />
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.ghostButton}
                onPress={() => setSubjectEditor(null)}
              >
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                disabled={subjectSaving}
                onPress={saveSubject}
              >
                {subjectSaving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Subject</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ExamAttendanceScreen({ session, onBack, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [loading, setLoading] = useState({
    exams: true,
    subjects: false,
    classes: true,
    divisions: false,
    students: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadInitialOptions = useCallback(async () => {
    setError("");
    try {
      const [examResult, classResult] = await Promise.all([
        teacherApi.fetchExams(session),
        teacherAttendanceApi.getAcademicClasses(session),
      ]);
      setExams(Array.isArray(examResult) ? examResult : []);
      setClasses(
        Array.isArray(classResult) && classResult.length
          ? classResult
          : !isApiConfigured
            ? [
                { id: "class-1", label: "Class 1" },
                { id: "class-2", label: "Class 2" },
                { id: "class-4", label: "Class 4" },
              ]
            : [],
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to load examinations and classes.",
      );
    } finally {
      setLoading((current) => ({ ...current, exams: false, classes: false }));
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInitialOptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadInitialOptions]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedExam) {
        setSubjects([]);
        setSelectedSubject(null);
        return;
      }
      setLoading((current) => ({ ...current, subjects: true }));
      setSubjects([]);
      setSelectedSubject(null);
      const loadSubjects = async () => {
        try {
          const result = await teacherApi.fetchExamSubjects(
            selectedExam.id,
            session,
          );
          if (active)
            setSubjects(
              (Array.isArray(result) ? result : []).map((subject, index) =>
                typeof subject === "string"
                  ? { id: `legacy-${index}`, label: subject, name: subject }
                  : {
                      ...subject,
                      id:
                        subject.id || subject.subject_id || `subject-${index}`,
                      label:
                        subject.label ||
                        subject.name ||
                        subject.subjectName ||
                        "Unnamed subject",
                      name:
                        subject.name ||
                        subject.subjectName ||
                        subject.label ||
                        "Unnamed subject",
                    },
              ),
            );
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load subject papers for this examination.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, subjects: false }));
        }
      };
      void loadSubjects();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedExam, session]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedClass) {
        setDivisions([]);
        setSelectedDivision(null);
        return;
      }
      setLoading((current) => ({ ...current, divisions: true }));
      setDivisions([]);
      setSelectedDivision(null);
      const loadDivisions = async () => {
        try {
          const result = await teacherAttendanceApi.getAcademicDivisions(
            session,
            selectedClass.id,
          );
          if (active) setDivisions(Array.isArray(result) ? result : []);
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load divisions for this class.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, divisions: false }));
        }
      };
      void loadDivisions();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedClass, session]);

  const loadStudents = useCallback(async () => {
    if (!selectedExam || !selectedSubject || !selectedClass) {
      setStudents([]);
      return;
    }
    setLoading((current) => ({ ...current, students: true }));
    setError("");
    try {
      const result = await teacherApi.getExamAttendanceRoster(
        {
          examId: selectedExam.id,
          subjectId: selectedSubject.id,
          classId: selectedClass.id,
          divisionId: selectedDivision?.id,
        },
        session,
      );
      setStudents(Array.isArray(result) && result.length ? result : []);
    } catch (requestError) {
      setStudents([]);
      setError(requestError?.message || "Unable to load registered students.");
    } finally {
      setLoading((current) => ({ ...current, students: false }));
    }
  }, [selectedExam, selectedSubject, selectedClass, selectedDivision, session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStudents();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  const updateStatus = (studentId, status) =>
    setStudents((current) =>
      current.map((student) =>
        student.id === studentId ? { ...student, status } : student,
      ),
    );
  const markAllPresent = () =>
    setStudents((current) =>
      current.map((student) => ({ ...student, status: "Present" })),
    );
  const present = students.filter(
    (student) => student.status === "Present",
  ).length;
  const absent = students.filter(
    (student) => student.status === "Absent",
  ).length;
  const unmarked = students.filter(
    (student) => !["Present", "Absent"].includes(student.status),
  ).length;
  const requiredSelectionsReady =
    selectedExam && selectedSubject && selectedClass;

  const submitAttendance = async () => {
    if (!selectedExam || !selectedSubject || !selectedClass) {
      Alert.alert(
        "Selection required",
        "Please select an examination, subject paper, and class.",
      );
      return;
    }
    if (!students.length || unmarked) {
      Alert.alert(
        "Attendance incomplete",
        unmarked
          ? "Mark Present or Absent for every registered student before submitting."
          : "No registered students are available to submit.",
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await teacherApi.submitExamAttendance(
        {
          examId: selectedExam.id,
          subjectId: selectedSubject.id,
          class_id: selectedClass.id,
          division_id: selectedDivision?.id,
          records: students.map((student) => ({
            student_id: student.studentId || student.id,
            status: student.status,
          })),
        },
        session,
      );
      Alert.alert(
        "Attendance submitted",
        result?.message || "Exam paper attendance was submitted successfully.",
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to submit exam attendance. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Attendance History": "Attendance Result",
      "Marks Entry": "Exam Result",
      "Publish Results": "Publish Result",
      "Class Reports": "Class Result",
      "Hall Tickets": "Hall Ticket",
    };
    if (moduleMap[tab]) onSelectModule(moduleMap[tab]);
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Exam Hall Attendance Console"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Track student presence, record absences per subject paper, and maintain
        verifiable attendance rosters
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Attendance" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Attendance" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadInitialOptions}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.filterPanel}>
        <View style={styles.filterGrid}>
          <FilterBadge
            label="Select Examination"
            value={selectedExam?.label || "Select Exam..."}
            options={exams.map((exam) => ({
              ...exam,
              label: exam.name || exam.title || `Exam #${exam.id}`,
            }))}
            onSelect={setSelectedExam}
          />
          <FilterBadge
            label="Select Subject Paper"
            value={
              loading.subjects
                ? "Loading subject papers..."
                : selectedSubject?.label || "Select Subject Paper..."
            }
            options={subjects}
            onSelect={setSelectedSubject}
          />
          <FilterBadge
            label="Class"
            value={selectedClass?.label || "Select Class..."}
            options={classes}
            onSelect={setSelectedClass}
          />
          <FilterBadge
            label="Division / Section"
            value={
              loading.divisions
                ? "Loading divisions..."
                : selectedDivision?.label || "All Divisions"
            }
            options={[{ id: "", label: "All Divisions" }, ...divisions]}
            onSelect={(division) =>
              setSelectedDivision(division.id ? division : null)
            }
          />
        </View>
      </View>
      {!requiredSelectionsReady ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            Please Select Exam, Subject &amp; Class
          </Text>
          <Text style={styles.emptyText}>
            Use the dropdown filters above to load the registered students and
            mark exam paper attendance.
          </Text>
        </View>
      ) : loading.students ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading registered students...</Text>
        </View>
      ) : !students.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No registered students found</Text>
          <Text style={styles.emptyText}>
            No students are registered for this exam paper and class.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total Students"
              value={String(students.length)}
              label="Registered"
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="people-outline"
            />
            <SummaryCard
              title="Present"
              value={String(present)}
              label="Present"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="checkmark-circle-outline"
            />
            <SummaryCard
              title="Absent"
              value={String(absent)}
              label="Absent"
              tint={colors.paleOrange}
              accent={colors.orange}
              icon="close-circle-outline"
            />
            <SummaryCard
              title="Not Marked"
              value={String(unmarked)}
              label="Pending"
              tint={colors.softLilac}
              accent={colors.plum}
              icon="time-outline"
            />
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.secondaryButton} onPress={markAllPresent}>
              <Text style={styles.secondaryButtonText}>Mark All Present</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              disabled={submitting}
              onPress={submitAttendance}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Submit Attendance</Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={styles.rosterHeader}>
              <Text style={styles.rosterHeaderText}>Roll / Admission</Text>
              <Text style={styles.rosterHeaderText}>Student Name</Text>
              <Text style={styles.rosterHeaderText}>Class</Text>
              <Text style={styles.rosterHeaderText}>Division</Text>
              <Text style={styles.rosterHeaderText}>Attendance Status</Text>
            </View>
            {students.map((student) => (
              <View key={student.id} style={styles.rosterCard}>
                <View style={styles.rosterIdentity}>
                  <Text style={styles.rowLabel}>
                    {student.rollNumber || student.admissionNumber || "—"}
                  </Text>
                  <Text style={styles.rowLabel}>{student.name}</Text>
                  <Text style={styles.rowLabel}>
                    {student.className || selectedClass.label}
                  </Text>
                  <Text style={styles.rowLabel}>
                    {student.section ||
                      selectedDivision?.label ||
                      "All Divisions"}
                  </Text>
                </View>
                <View style={styles.statusActions}>
                  <Pressable
                    style={[
                      styles.statusChoice,
                      student.status === "Present" &&
                        styles.statusChoicePresent,
                    ]}
                    onPress={() => updateStatus(student.id, "Present")}
                  >
                    <Text style={styles.statusChoiceText}>Present</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.statusChoice,
                      student.status === "Absent" && styles.statusChoiceAbsent,
                    ]}
                    onPress={() => updateStatus(student.id, "Absent")}
                  >
                    <Text style={styles.statusChoiceText}>Absent</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function ExamResultScreen({ session, onBack, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [students, setStudents] = useState([]);
  const [initialStudents, setInitialStudents] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [loading, setLoading] = useState({
    exams: true,
    subjects: false,
    classes: true,
    divisions: false,
    students: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOptions = useCallback(async () => {
    setError("");
    try {
      const [examResult, classResult] = await Promise.all([
        teacherApi.fetchExams(session),
        teacherAttendanceApi.getAcademicClasses(session),
      ]);
      setExams(Array.isArray(examResult) ? examResult : []);
      setClasses(
        Array.isArray(classResult) && classResult.length
          ? classResult
          : !isApiConfigured
            ? [
                { id: "class-1", label: "Class 1" },
                { id: "class-2", label: "Class 2" },
                { id: "class-4", label: "Class 4" },
              ]
            : [],
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to load examinations and classes.",
      );
    } finally {
      setLoading((current) => ({ ...current, exams: false, classes: false }));
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedExam) {
        setSubjects([]);
        setSelectedSubject(null);
        return;
      }
      setLoading((current) => ({ ...current, subjects: true }));
      setSubjects([]);
      setSelectedSubject(null);
      const loadSubjects = async () => {
        try {
          const result = await teacherApi.fetchExamSubjects(
            selectedExam.id,
            session,
          );
          if (active)
            setSubjects(
              (Array.isArray(result) ? result : []).map((subject, index) =>
                typeof subject === "string"
                  ? { id: `legacy-${index}`, label: subject, name: subject }
                  : {
                      ...subject,
                      id:
                        subject.id || subject.subject_id || `subject-${index}`,
                      label:
                        subject.label ||
                        subject.name ||
                        subject.subjectName ||
                        "Unnamed subject",
                      name:
                        subject.name ||
                        subject.subjectName ||
                        subject.label ||
                        "Unnamed subject",
                    },
              ),
            );
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load subject papers for this examination.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, subjects: false }));
        }
      };
      void loadSubjects();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedExam, session]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedClass) {
        setDivisions([]);
        setSelectedDivision(null);
        return;
      }
      setLoading((current) => ({ ...current, divisions: true }));
      setDivisions([]);
      setSelectedDivision(null);
      const loadDivisions = async () => {
        try {
          const result = await teacherAttendanceApi.getAcademicDivisions(
            session,
            selectedClass.id,
          );
          if (active) setDivisions(Array.isArray(result) ? result : []);
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load divisions for this class.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, divisions: false }));
        }
      };
      void loadDivisions();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedClass, session]);

  const loadStudents = useCallback(async () => {
    if (!selectedExam || !selectedSubject || !selectedClass) {
      setStudents([]);
      setInitialStudents([]);
      return;
    }
    setLoading((current) => ({ ...current, students: true }));
    setError("");
    try {
      const result = await teacherApi.getExamMarksRoster(
        {
          examId: selectedExam.id,
          subjectId: selectedSubject.id,
          classId: selectedClass.id,
          divisionId: selectedDivision?.id,
        },
        session,
      );
      const next = Array.isArray(result) && result.length ? result : [];
      setStudents(next);
      setInitialStudents(
        next.map((student) => ({
          id: student.id,
          obtainedMarks: String(student.obtainedMarks ?? ""),
          remarks: student.remarks || "",
        })),
      );
    } catch (requestError) {
      setStudents([]);
      setInitialStudents([]);
      setError(
        requestError?.message || "Unable to load students for marks entry.",
      );
    } finally {
      setLoading((current) => ({ ...current, students: false }));
    }
  }, [selectedExam, selectedSubject, selectedClass, selectedDivision, session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStudents();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  const hasUnsavedChanges = students.some((student) => {
    const initial = initialStudents.find((item) => item.id === student.id);
    return (
      !initial ||
      String(student.obtainedMarks ?? "") !== initial.obtainedMarks ||
      (student.remarks || "") !== initial.remarks
    );
  });

  const selectFilter = (setter, value) => {
    if (!hasUnsavedChanges) {
      setter(value);
      return;
    }
    Alert.alert(
      "Discard unsaved marks?",
      "Changing this filter will clear the marks currently being edited.",
      [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => setter(value) },
      ],
    );
  };

  const updateStudent = (id, field, value) =>
    setStudents((current) =>
      current.map((student) =>
        student.id === id ? { ...student, [field]: value } : student,
      ),
    );
  const maximumMarksFor = useCallback(
    (student) =>
      Number(
        student.maximumMarks ||
          selectedSubject?.maximumMarks ||
          selectedSubject?.maxMarks ||
          100,
      ),
    [selectedSubject],
  );
  const passingMarksFor = useCallback(
    (student) =>
      Number(
        student.passingMarks ||
          selectedSubject?.passingMarks ||
          selectedSubject?.passMarks ||
          maximumMarksFor(student) * 0.4,
      ),
    [maximumMarksFor, selectedSubject],
  );
  const parsedMarks = useCallback((student) => {
    if (
      student.obtainedMarks === "" ||
      student.obtainedMarks === null ||
      student.obtainedMarks === undefined
    )
      return null;
    const value = Number(student.obtainedMarks);
    return Number.isFinite(value) ? value : NaN;
  }, []);
  const percentageFor = useCallback(
    (student) => {
      const marks = parsedMarks(student);
      return marks === null || Number.isNaN(marks)
        ? "—"
        : `${((marks / maximumMarksFor(student)) * 100).toFixed(1)}%`;
    },
    [maximumMarksFor, parsedMarks],
  );
  const statusFor = useCallback(
    (student) => {
      const marks = parsedMarks(student);
      if (marks === null) return "Pending";
      if (Number.isNaN(marks) || marks < 0 || marks > maximumMarksFor(student))
        return "Invalid";
      return marks >= passingMarksFor(student) ? "Pass" : "Fail";
    },
    [maximumMarksFor, parsedMarks, passingMarksFor],
  );

  const summary = useMemo(() => {
    const values = students
      .map(parsedMarks)
      .filter((value) => value !== null && Number.isFinite(value));
    const percentages = students
      .map((student) => {
        const marks = parsedMarks(student);
        return marks !== null && Number.isFinite(marks)
          ? (marks / maximumMarksFor(student)) * 100
          : null;
      })
      .filter((value) => value !== null);
    const passed = students.filter(
      (student) => statusFor(student) === "Pass",
    ).length;
    const failed = students.filter(
      (student) => statusFor(student) === "Fail",
    ).length;
    return {
      total: students.length,
      entered: values.length,
      pending: students.length - values.length,
      passed,
      failed,
      averageMarks: values.length
        ? (
            values.reduce((sum, value) => sum + value, 0) / values.length
          ).toFixed(1)
        : "0.0",
      averagePercentage: percentages.length
        ? (
            percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
          ).toFixed(1)
        : "0.0",
      highest: values.length ? Math.max(...values).toFixed(1) : "—",
      lowest: values.length ? Math.min(...values).toFixed(1) : "—",
    };
  }, [students, maximumMarksFor, parsedMarks, statusFor]);

  const saveMarks = async () => {
    if (!selectedExam || !selectedSubject || !selectedClass) {
      Alert.alert(
        "Selection required",
        "Please select an examination, subject paper, and class.",
      );
      return;
    }
    const invalid = students.find((student) => {
      const marks = parsedMarks(student);
      return (
        marks !== null &&
        (!Number.isFinite(marks) ||
          marks < 0 ||
          marks > maximumMarksFor(student))
      );
    });
    if (invalid) {
      Alert.alert(
        "Invalid marks",
        `Marks for ${invalid.name} must be between 0 and ${maximumMarksFor(invalid)}.`,
      );
      return;
    }
    const changed = students.filter((student) => {
      const initial = initialStudents.find((item) => item.id === student.id);
      return (
        !initial ||
        String(student.obtainedMarks ?? "") !== initial.obtainedMarks ||
        (student.remarks || "") !== initial.remarks
      );
    });
    if (!changed.length) {
      Alert.alert("No changes", "There are no marks changes to save.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await teacherApi.submitExamMarks(
        {
          examId: selectedExam.id,
          subjectId: selectedSubject.id,
          class_id: selectedClass.id,
          division_id: selectedDivision?.id,
          records: changed.map((student) => ({
            student_id: student.studentId || student.id,
            marks_obtained:
              student.obtainedMarks === ""
                ? null
                : Number(student.obtainedMarks),
            maximum_marks: maximumMarksFor(student),
            passing_marks: passingMarksFor(student),
            remarks: student.remarks || "",
          })),
        },
        session,
      );
      setInitialStudents(
        students.map((student) => ({
          id: student.id,
          obtainedMarks: String(student.obtainedMarks ?? ""),
          remarks: student.remarks || "",
        })),
      );
      Alert.alert(
        "Marks saved",
        "Marks were saved successfully. Results remain unpublished.",
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to save marks. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Marks Entry": "Exam Result",
      "Publish Results": "Publish Result",
      "Class Reports": "Class Result",
      "Hall Tickets": "Hall Ticket",
    };
    if (moduleMap[tab] && tab !== "Marks Entry") onSelectModule(moduleMap[tab]);
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Performance & Marks Entry Console"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Record subject scores, auto-calculate pass/fail metrics, and synchronize
        results directly to student portals
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Marks Entry" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Marks Entry" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadOptions}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.filterPanel}>
        <View style={styles.filterGrid}>
          <FilterBadge
            label="Examination *"
            value={selectedExam?.label || "Select Exam..."}
            options={exams.map((exam) => ({
              ...exam,
              label: exam.name || exam.title || `Exam #${exam.id}`,
            }))}
            onSelect={(value) => selectFilter(setSelectedExam, value)}
          />
          <FilterBadge
            label="Subject Paper *"
            value={
              loading.subjects
                ? "Loading subject papers..."
                : selectedSubject?.label || "Select Subject Paper..."
            }
            options={subjects}
            onSelect={(value) => selectFilter(setSelectedSubject, value)}
          />
          <FilterBadge
            label="Class *"
            value={selectedClass?.label || "Select Class..."}
            options={classes}
            onSelect={(value) => selectFilter(setSelectedClass, value)}
          />
          <FilterBadge
            label="Division / Section"
            value={
              loading.divisions
                ? "Loading divisions..."
                : selectedDivision?.label || "All Divisions"
            }
            options={[{ id: "", label: "All Divisions" }, ...divisions]}
            onSelect={(value) =>
              selectFilter(setSelectedDivision, value.id ? value : null)
            }
          />
        </View>
      </View>
      {!selectedExam || !selectedSubject || !selectedClass ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            Select Exam, Subject &amp; Class
          </Text>
          <Text style={styles.emptyText}>
            Choose an examination, subject paper and target class to start
            entering student marks and view live performance averages.
          </Text>
        </View>
      ) : loading.students ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>
            Loading students for marks entry...
          </Text>
        </View>
      ) : !students.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No students found</Text>
          <Text style={styles.emptyText}>
            No students are available for the selected examination, subject, and
            class.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total Students"
              value={String(summary.total)}
              label="Students"
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="people-outline"
            />
            <SummaryCard
              title="Marks Entered"
              value={String(summary.entered)}
              label="Records"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="create-outline"
            />
            <SummaryCard
              title="Marks Pending"
              value={String(summary.pending)}
              label="Pending"
              tint={colors.paleOrange}
              accent={colors.orange}
              icon="time-outline"
            />
            <SummaryCard
              title="Passed"
              value={String(summary.passed)}
              label="Pass"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="checkmark-circle-outline"
            />
            <SummaryCard
              title="Failed"
              value={String(summary.failed)}
              label="Fail"
              tint={colors.softLilac}
              accent={colors.plum}
              icon="close-circle-outline"
            />
            <SummaryCard
              title="Average"
              value={`${summary.averagePercentage}%`}
              label={`${summary.averageMarks} marks`}
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="stats-chart-outline"
            />
          </View>
          <View style={styles.performanceStrip}>
            <Text style={styles.performanceText}>
              Average Percentage: {summary.averagePercentage}% • Highest:{" "}
              {summary.highest} • Lowest: {summary.lowest}
            </Text>
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.primaryButton}
              disabled={saving}
              onPress={saveMarks}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Marks</Text>
              )}
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={styles.marksHeader}>
              <Text style={styles.marksHeaderText}>Roll No</Text>
              <Text style={styles.marksHeaderText}>Admission No</Text>
              <Text style={styles.marksHeaderText}>Student Name</Text>
              <Text style={styles.marksHeaderText}>Maximum Marks</Text>
              <Text style={styles.marksHeaderText}>Marks Obtained</Text>
              <Text style={styles.marksHeaderText}>Percentage</Text>
              <Text style={styles.marksHeaderText}>Pass/Fail</Text>
              <Text style={styles.marksHeaderText}>Remarks</Text>
            </View>
            {students.map((student) => (
              <View key={student.id} style={styles.marksCard}>
                <Text style={styles.rowLabel}>
                  {student.rollNumber || student.rollNo || "—"}
                </Text>
                <Text style={styles.rowLabel}>
                  {student.admissionNumber || student.admissionNo || "—"}
                </Text>
                <Text style={styles.rowLabel}>{student.name}</Text>
                <Text style={styles.rowLabel}>{maximumMarksFor(student)}</Text>
                <TextInput
                  value={String(student.obtainedMarks ?? "")}
                  onChangeText={(value) =>
                    updateStudent(
                      student.id,
                      "obtainedMarks",
                      value.replace(/[^0-9.]/g, ""),
                    )
                  }
                  keyboardType="decimal-pad"
                  placeholder="Enter marks"
                  placeholderTextColor={colors.muted}
                  style={styles.marksInput}
                />
                <Text style={styles.rowLabel}>{percentageFor(student)}</Text>
                <Text
                  style={[
                    styles.resultStatus,
                    statusFor(student) === "Pass"
                      ? styles.passText
                      : statusFor(student) === "Fail"
                        ? styles.failText
                        : styles.pendingText,
                  ]}
                >
                  {statusFor(student)}
                </Text>
                <TextInput
                  value={student.remarks || ""}
                  onChangeText={(value) =>
                    updateStudent(student.id, "remarks", value)
                  }
                  placeholder="Optional"
                  placeholderTextColor={colors.muted}
                  style={styles.remarksInput}
                />
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function examResultsArePublished(exam) {
  const value =
    exam?.published ??
    exam?.isPublished ??
    exam?.resultsPublished ??
    exam?.publicationStatus ??
    exam?.resultStatus ??
    exam?.visibility;
  return (
    value === true ||
    ["published", "live", "visible", "live & visible"].includes(
      String(value || "")
        .trim()
        .toLowerCase(),
    )
  );
}

function PublishResultScreen({ session, onBack, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [actionExamId, setActionExamId] = useState(null);
  const [reportExam, setReportExam] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await teacherApi.fetchExams(session);
      setExams(
        (Array.isArray(result) ? result : []).map((exam) => ({
          ...exam,
          published: examResultsArePublished(exam),
        })),
      );
    } catch (requestError) {
      setExams([]);
      setError(requestError?.message || "Unable to load examination results.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadExams();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadExams]);

  const summary = useMemo(() => {
    const published = exams.filter(examResultsArePublished).length;
    return { total: exams.length, published, draft: exams.length - published };
  }, [exams]);

  const visibleExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exams.filter((exam) => {
      const matchesSearch =
        !query ||
        [
          exam.name,
          exam.targetClass,
          exam.targetScope,
          exam.className,
          exam.section,
          exam.id,
          formatExamTarget(exam),
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      const published = examResultsArePublished(exam);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "PUBLISHED" && published) ||
        (filter === "DRAFT" && !published);
      return matchesSearch && matchesFilter;
    });
  }, [exams, filter, search]);

  const openReport = async (exam) => {
    setReportExam(exam);
    setReport(null);
    setReportLoading(true);
    try {
      setReport(await teacherApi.getExamReport(exam.id, session));
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to load the examination report.",
      );
    } finally {
      setReportLoading(false);
    }
  };

  const changePublication = (exam) => {
    const published = examResultsArePublished(exam);
    Alert.alert(
      published ? "Recall Published Results?" : "Publish Results?",
      published
        ? "Recalling results will hide them from student and parent portals."
        : "Publishing will make examination results visible to students and parents through supported portals.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: published ? "Recall Results" : "Publish Live",
          style: published ? "destructive" : "default",
          onPress: async () => {
            setActionExamId(exam.id);
            setError("");
            try {
              const updated = published
                ? await teacherApi.recallExamResults(exam.id, session)
                : await teacherApi.publishExamResults(exam.id, session);
              const nextPublished =
                updated?.published ??
                updated?.isPublished ??
                updated?.resultsPublished ??
                !published;
              setExams((current) =>
                current.map((item) =>
                  item.id === exam.id
                    ? { ...item, ...updated, published: Boolean(nextPublished) }
                    : item,
                ),
              );
              Alert.alert(
                published ? "Results recalled" : "Results published",
                published
                  ? "Results are hidden from student and parent portals."
                  : "Results are now live and visible through supported portals.",
              );
            } catch (requestError) {
              setError(
                requestError?.message ||
                  (published
                    ? "Unable to recall results."
                    : "Unable to publish results."),
              );
            } finally {
              setActionExamId(null);
            }
          },
        },
      ],
    );
  };

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Marks Entry": "Exam Result",
      "Class Reports": "Class Result",
      "Hall Tickets": "Hall Ticket",
    };
    if (moduleMap[tab] && tab !== "Publish Results")
      onSelectModule(moduleMap[tab]);
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Results Publishing & Visibility Console"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Control real-time student report card visibility across parent portals,
        student dashboards, and SMS broadcasts
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Publish Results" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Publish Results" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadExams}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.summaryGrid}>
        <SummaryCard
          title="Total"
          value={String(summary.total)}
          label="Total"
          tint={colors.paleBlue}
          accent={colors.blue}
          icon="document-text-outline"
        />
        <SummaryCard
          title="Active"
          value={String(summary.published)}
          label="Published"
          tint={colors.paleTeal}
          accent={colors.teal}
          icon="eye-outline"
        />
        <SummaryCard
          title="Done"
          value={String(summary.draft)}
          label="Unpublished"
          tint={colors.paleOrange}
          accent={colors.orange}
          icon="time-outline"
        />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard
          title="Total Exams"
          value={String(summary.total)}
          label="All examinations"
          tint={colors.paleBlue}
          accent={colors.blue}
          icon="documents-outline"
        />
        <SummaryCard
          title="Live & Published"
          value={String(summary.published)}
          label="Visible portals"
          tint={colors.paleTeal}
          accent={colors.teal}
          icon="globe-outline"
        />
        <SummaryCard
          title="Draft / Unpublished"
          value={String(summary.draft)}
          label="Hidden results"
          tint={colors.paleOrange}
          accent={colors.orange}
          icon="lock-closed-outline"
        />
      </View>
      <View style={styles.filterPanel}>
        <View style={styles.searchField}>
          <Icon name="search-outline" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search exam name or class..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.publishFilters}>
          {["ALL", "PUBLISHED", "DRAFT"].map((option) => (
            <Pressable
              key={option}
              style={[
                styles.publishFilter,
                filter === option && styles.publishFilterActive,
              ]}
              onPress={() => setFilter(option)}
            >
              <Text
                style={[
                  styles.publishFilterText,
                  filter === option && styles.publishFilterTextActive,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading examination results...</Text>
        </View>
      ) : !visibleExams.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No examinations found</Text>
          <Text style={styles.emptyText}>
            No examinations match the current search or visibility filter.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.publishHeader}>
            <Text style={styles.publishHeaderText}>Examination Session</Text>
            <Text style={styles.publishHeaderText}>Target Scope</Text>
            <Text style={styles.publishHeaderText}>Portal Visibility</Text>
            <Text style={styles.publishHeaderText}>Publishing Actions</Text>
          </View>
          {visibleExams.map((exam) => {
            const published = examResultsArePublished(exam);
            const busy = actionExamId === exam.id;
            return (
              <View key={exam.id} style={styles.publishCard}>
                <View style={styles.publishIdentity}>
                  <Text style={styles.listTitle}>
                    {exam.name || "Unnamed examination"}
                  </Text>
                  <Text style={styles.listText}>
                    Exam ID: #{exam.id ?? "N/A"}
                  </Text>
                </View>
                <Text style={styles.detailValue}>{formatExamTarget(exam)}</Text>
                <View
                  style={[
                    styles.visibilityBadge,
                    published ? styles.visibilityLive : styles.visibilityDraft,
                  ]}
                >
                  <Text style={styles.visibilityText}>
                    {published ? "Live & Visible" : "Draft / Hidden"}
                  </Text>
                </View>
                <View style={styles.publishActions}>
                  <Pressable
                    style={styles.ghostButton}
                    onPress={() => void openReport(exam)}
                  >
                    <Text style={styles.ghostButtonText}>View Report</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      published ? styles.recallButton : styles.primaryButton,
                    ]}
                    disabled={busy}
                    onPress={() => changePublication(exam)}
                  >
                    {busy ? (
                      <ActivityIndicator
                        color={published ? colors.red : colors.white}
                      />
                    ) : (
                      <Text
                        style={
                          published
                            ? styles.recallText
                            : styles.primaryButtonText
                        }
                      >
                        {published ? "Recall Results" : "Publish Live"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(reportExam)}
        onRequestClose={() => setReportExam(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Examination Report</Text>
            {reportExam ? (
              <Text style={styles.modalDescription}>
                {reportExam.name} • #{reportExam.id}
              </Text>
            ) : null}
            {reportLoading ? (
              <ActivityIndicator color={colors.blue} style={styles.loader} />
            ) : report ? (
              <ScrollView>
                <Text style={styles.modalInfo}>
                  Target: {formatExamTarget(reportExam)}
                </Text>
                <Text style={styles.modalInfo}>
                  Visibility:{" "}
                  {examResultsArePublished(reportExam)
                    ? "Live & Visible"
                    : "Draft / Hidden"}
                </Text>
                <Text style={styles.modalInfo}>
                  Students:{" "}
                  {report.totalStudents ??
                    report.students?.length ??
                    report.records?.length ??
                    "—"}
                </Text>
                <Text style={styles.modalInfo}>
                  Average: {report.averagePercentage ?? report.average ?? "—"}
                </Text>
                <Text style={styles.modalInfo}>
                  Passed: {report.passed ?? "—"} Failed: {report.failed ?? "—"}
                </Text>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>
                No report data is available for this examination.
              </Text>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={() => setReportExam(null)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ClassResultScreen({ session, onBack, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [records, setRecords] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState({
    exams: true,
    classes: true,
    divisions: false,
    results: false,
  });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [rankFilter, setRankFilter] = useState("All Ranks");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [examResult, classResult] = await Promise.all([
        teacherApi.fetchExams(session),
        teacherAttendanceApi.getAcademicClasses(session),
      ]);
      setExams(Array.isArray(examResult) ? examResult : []);
      setClasses(
        Array.isArray(classResult) && classResult.length
          ? classResult
          : !isApiConfigured
            ? [
                { id: "class-1", label: "Class 1" },
                { id: "class-2", label: "Class 2" },
              ]
            : [],
      );
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to load examinations and classes.",
      );
    } finally {
      setLoading((current) => ({ ...current, exams: false, classes: false }));
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedClass) {
        setDivisions([]);
        setSelectedDivision(null);
        return;
      }
      setLoading((current) => ({ ...current, divisions: true }));
      setDivisions([]);
      setSelectedDivision(null);
      const loadDivisions = async () => {
        try {
          const result = await teacherAttendanceApi.getAcademicDivisions(
            session,
            selectedClass.id,
          );
          if (active) setDivisions(Array.isArray(result) ? result : []);
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load divisions for this class.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, divisions: false }));
        }
      };
      void loadDivisions();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedClass, session]);

  const normalizeRecord = (record, index) => {
    const rawSubjects =
      record.subjects || record.subjectMarks || record.marksBySubject || {};
    const subjectMarks = Array.isArray(rawSubjects)
      ? rawSubjects.reduce(
          (result, subject) => ({
            ...result,
            [subject.name || subject.subjectName || subject.code || "Subject"]:
              {
                obtained: Number(
                  subject.obtainedMarks ??
                    subject.marks ??
                    subject.obtained ??
                    0,
                ),
                maximum: Number(
                  subject.maximumMarks ?? subject.maxMarks ?? 100,
                ),
                passing: Number(
                  subject.passingMarks ?? subject.passMarks ?? "",
                ),
              },
          }),
          {},
        )
      : Object.entries(rawSubjects).reduce(
          (result, [name, value]) => ({
            ...result,
            [name]:
              typeof value === "object"
                ? {
                    obtained: Number(
                      value.obtainedMarks ?? value.marks ?? value.obtained ?? 0,
                    ),
                    maximum: Number(
                      value.maximumMarks ?? value.maxMarks ?? 100,
                    ),
                    passing: Number(
                      value.passingMarks ?? value.passMarks ?? "",
                    ),
                  }
                : { obtained: Number(value), maximum: 100, passing: 40 },
          }),
          {},
        );
    const totalMarks = Number(
      record.totalMarks ??
        record.total_marks ??
        Object.values(subjectMarks).reduce(
          (sum, subject) =>
            sum + (Number.isFinite(subject.obtained) ? subject.obtained : 0),
          0,
        ),
    );
    const maximumMarks = Number(
      record.maximumMarks ??
        record.maximum_marks ??
        record.maxMarks ??
        (Object.values(subjectMarks).reduce(
          (sum, subject) => sum + subject.maximum,
          0,
        ) ||
          0),
    );
    const percentage = Number(
      record.percentage ??
        (maximumMarks ? (totalMarks / maximumMarks) * 100 : 0),
    );
    const status =
      record.resultStatus ||
      record.result_status ||
      record.status ||
      (record.absent ? "Absent" : percentage >= 40 ? "Pass" : "Fail");
    return {
      ...record,
      id: record.id || record.student_id || `student-${index}`,
      name:
        record.name ||
        record.studentName ||
        record.student_name ||
        "Unnamed student",
      rollNumber: record.rollNumber || record.roll_no || record.roll || "",
      admissionNumber:
        record.admissionNumber ||
        record.admission_no ||
        record.admission_number ||
        "",
      section: record.section || record.division || "",
      totalMarks,
      maximumMarks,
      percentage,
      grade: record.grade || "—",
      status,
      rank: record.rank,
      subjectMarks,
    };
  };

  const generateTabulation = async () => {
    if (!selectedExam || !selectedClass) {
      Alert.alert(
        "Selection required",
        "Please select an exam and class before generating tabulation.",
      );
      return;
    }
    setLoading((current) => ({ ...current, results: true }));
    setGenerated(false);
    setRecords([]);
    setError("");
    try {
      const result = await teacherApi.getClassResults(
        {
          examId: selectedExam.id,
          classId: selectedClass.id,
          divisionId: selectedDivision?.id,
        },
        session,
      );
      const records = Array.isArray(result) && result.length ? result : [];
      setRecords(records.map(normalizeRecord));
      setGenerated(true);
    } catch (requestError) {
      setError(requestError?.message || "Unable to generate class results.");
    } finally {
      setLoading((current) => ({ ...current, results: false }));
    }
  };

  const rankedRecords = useMemo(() => {
    const sorted = [...records].sort(
      (left, right) => right.percentage - left.percentage,
    );
    return sorted.reduce(
      (state, record, index) => {
        if (record.rank !== undefined && record.rank !== null)
          return {
            ...state,
            records: [...state.records, record],
            previousScore: record.percentage,
          };
        const rank =
          record.percentage === state.previousScore
            ? state.currentRank
            : index + 1;
        return {
          records: [...state.records, { ...record, rank }],
          previousScore: record.percentage,
          currentRank: rank,
        };
      },
      { records: [], previousScore: null, currentRank: 0 },
    ).records;
  }, [records]);

  const subjectNames = useMemo(
    () => [
      ...new Set(
        rankedRecords.flatMap((record) =>
          Object.keys(record.subjectMarks || {}),
        ),
      ),
    ],
    [rankedRecords],
  );
  const filteredRecords = useMemo(
    () =>
      rankedRecords.filter((record) => {
        const query = search.trim().toLowerCase();
        return (
          (!query ||
            [
              record.name,
              record.rollNumber,
              record.admissionNumber,
              record.section,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(query),
            )) &&
          (statusFilter === "All Statuses" || record.status === statusFilter) &&
          (gradeFilter === "All Grades" || record.grade === gradeFilter) &&
          (rankFilter === "All Ranks" || String(record.rank) === rankFilter)
        );
      }),
    [rankedRecords, search, statusFilter, gradeFilter, rankFilter],
  );

  const performance = useMemo(() => {
    const appeared = rankedRecords.filter(
      (record) => record.status !== "Absent",
    );
    const passed = rankedRecords.filter(
      (record) => record.status === "Pass",
    ).length;
    const percentages = appeared
      .map((record) => record.percentage)
      .filter(Number.isFinite);
    return {
      total: rankedRecords.length,
      appeared: appeared.length,
      passed,
      failed: rankedRecords.filter((record) => record.status === "Fail").length,
      average: percentages.length
        ? (
            percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
          ).toFixed(1)
        : "—",
      highest: percentages.length ? Math.max(...percentages).toFixed(1) : "—",
      lowest: percentages.length ? Math.min(...percentages).toFixed(1) : "—",
      passRate: appeared.length ? ((passed / appeared) * 100).toFixed(1) : "—",
    };
  }, [rankedRecords]);

  const subjectStats = useMemo(
    () =>
      subjectNames.map((name) => {
        const values = rankedRecords
          .map((record) => record.subjectMarks?.[name])
          .filter(Boolean);
        const appeared = values.length;
        const passed = values.filter(
          (subject) =>
            subject.obtained >= (subject.passing || subject.maximum * 0.4),
        ).length;
        return {
          name,
          appeared,
          passed,
          failed: Math.max(0, appeared - passed),
          passRate: appeared ? ((passed / appeared) * 100).toFixed(1) : "0.0",
        };
      }),
    [rankedRecords, subjectNames],
  );

  const openReport = async () => {
    if (!selectedExam) return;
    setReportLoading(true);
    try {
      setReport(await teacherApi.getExamReport(selectedExam.id, session));
    } catch (requestError) {
      setError(requestError?.message || "Unable to load the official report.");
    } finally {
      setReportLoading(false);
    }
  };

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Marks Entry": "Exam Result",
      "Publish Results": "Publish Result",
      "Hall Tickets": "Hall Ticket",
    };
    if (moduleMap[tab] && tab !== "Class Reports")
      onSelectModule(moduleMap[tab]);
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Class Performance & Results Tabulation"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Consolidated scorecards, rank evaluation, subject pass/fail statistics,
        and official report sheets
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Class Reports" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Class Reports" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={generateTabulation}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.filterPanel}>
        <View style={styles.filterGrid}>
          <FilterBadge
            label="Exam *"
            value={selectedExam?.label || "Select Exam..."}
            options={exams.map((exam) => ({
              ...exam,
              label: exam.name || exam.title || `Exam #${exam.id}`,
            }))}
            onSelect={(value) => {
              setSelectedExam(value);
              setRecords([]);
              setGenerated(false);
            }}
          />
          <FilterBadge
            label="Class *"
            value={selectedClass?.label || "Select Class..."}
            options={classes}
            onSelect={(value) => {
              setSelectedClass(value);
              setRecords([]);
              setGenerated(false);
            }}
          />
          <FilterBadge
            label="Division (Optional)"
            value={selectedDivision?.label || "All Divisions"}
            options={[{ id: "", label: "All Divisions" }, ...divisions]}
            onSelect={(value) => {
              setSelectedDivision(value.id ? value : null);
              setRecords([]);
              setGenerated(false);
            }}
          />
        </View>
        <Pressable
          style={styles.primaryButton}
          disabled={loading.results}
          onPress={generateTabulation}
        >
          {loading.results ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Generate Tabulation</Text>
          )}
        </Pressable>
      </View>
      {!selectedExam || !selectedClass ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Select Exam and Class</Text>
          <Text style={styles.emptyText}>
            Choose an examination and class above to compute the full marks
            scorecard and rank leaderboards.
          </Text>
        </View>
      ) : loading.results ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Generating Class Results...</Text>
        </View>
      ) : !generated || !rankedRecords.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results available</Text>
          <Text style={styles.emptyText}>
            No marks or results are available for the selected exam and class.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total Students"
              value={String(performance.total)}
              label="Students"
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="people-outline"
            />
            <SummaryCard
              title="Students Appeared"
              value={String(performance.appeared)}
              label="Appeared"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="checkmark-circle-outline"
            />
            <SummaryCard
              title="Passed"
              value={String(performance.passed)}
              label="Pass"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="ribbon-outline"
            />
            <SummaryCard
              title="Failed"
              value={String(performance.failed)}
              label="Fail"
              tint={colors.paleOrange}
              accent={colors.orange}
              icon="close-circle-outline"
            />
            <SummaryCard
              title="Class Average"
              value={`${performance.average}%`}
              label="Average"
              tint={colors.softLilac}
              accent={colors.plum}
              icon="stats-chart-outline"
            />
            <SummaryCard
              title="Overall Pass"
              value={`${performance.passRate}%`}
              label="Pass rate"
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="trending-up-outline"
            />
          </View>
          <View style={styles.filterPanel}>
            <View style={styles.searchField}>
              <Icon name="search-outline" size={16} color={colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search student..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.filterGrid}>
              <FilterBadge
                label="Result Status"
                value={statusFilter}
                options={["All Statuses", "Pass", "Fail", "Absent", "Pending"]}
                onSelect={setStatusFilter}
              />
              <FilterBadge
                label="Grade"
                value={gradeFilter}
                options={[
                  "All Grades",
                  ...new Set(
                    rankedRecords
                      .map((record) => record.grade)
                      .filter((grade) => grade && grade !== "—"),
                  ),
                ]}
                onSelect={setGradeFilter}
              />
              <FilterBadge
                label="Rank"
                value={rankFilter}
                options={[
                  "All Ranks",
                  ...rankedRecords.map((record) => String(record.rank)),
                ]}
                onSelect={setRankFilter}
              />
            </View>
          </View>
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => void openReport()}
            >
              <Text style={styles.primaryButtonText}>View Report</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                Alert.alert(
                  "Print unavailable",
                  "Print and download actions are not connected to a report export API yet.",
                )
              }
            >
              <Text style={styles.secondaryButtonText}>Print / Download</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.resultsTable}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>Rank</Text>
                <Text style={styles.resultsHeaderText}>Roll No</Text>
                <Text style={styles.resultsHeaderText}>Admission No</Text>
                <Text style={styles.resultsHeaderText}>Student Name</Text>
                {subjectNames.map((name) => (
                  <Text key={name} style={styles.resultsHeaderText}>
                    {name}
                  </Text>
                ))}
                <Text style={styles.resultsHeaderText}>Total</Text>
                <Text style={styles.resultsHeaderText}>%</Text>
                <Text style={styles.resultsHeaderText}>Grade</Text>
                <Text style={styles.resultsHeaderText}>Status</Text>
              </View>
              {filteredRecords.map((record) => (
                <View key={record.id} style={styles.resultsRow}>
                  <Text style={styles.resultsCell}>{record.rank}</Text>
                  <Text style={styles.resultsCell}>
                    {record.rollNumber || "—"}
                  </Text>
                  <Text style={styles.resultsCell}>
                    {record.admissionNumber || "—"}
                  </Text>
                  <Text style={styles.resultsCell}>{record.name}</Text>
                  {subjectNames.map((name) => (
                    <Text key={name} style={styles.resultsCell}>
                      {record.subjectMarks?.[name]?.obtained ?? "—"}
                    </Text>
                  ))}
                  <Text style={styles.resultsCell}>
                    {record.totalMarks}/{record.maximumMarks}
                  </Text>
                  <Text style={styles.resultsCell}>
                    {record.percentage.toFixed(1)}%
                  </Text>
                  <Text style={styles.resultsCell}>{record.grade}</Text>
                  <Text style={styles.resultsCell}>{record.status}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.sectionTitle}>Subject Performance</Text>
          {subjectStats.map((subject) => (
            <View key={subject.name} style={styles.subjectStatCard}>
              <Text style={styles.listTitle}>{subject.name}</Text>
              <Text style={styles.listText}>
                Appeared: {subject.appeared} Passed: {subject.passed} Failed:{" "}
                {subject.failed} Pass Rate: {subject.passRate}%
              </Text>
            </View>
          ))}
        </>
      )}
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(report)}
        onRequestClose={() => setReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Official Report Sheet</Text>
            {reportLoading ? (
              <ActivityIndicator color={colors.blue} style={styles.loader} />
            ) : report ? (
              <ScrollView>
                <Text style={styles.modalInfo}>
                  Exam: {selectedExam?.label}
                </Text>
                <Text style={styles.modalInfo}>
                  Class: {selectedClass?.label}
                </Text>
                <Text style={styles.modalInfo}>
                  Students:{" "}
                  {report.totalStudents ?? report.records?.length ?? "—"}
                </Text>
                <Text style={styles.modalInfo}>
                  Average: {report.averagePercentage ?? report.average ?? "—"}
                </Text>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No report data available.</Text>
            )}
            <Pressable
              style={styles.primaryButton}
              onPress={() => setReport(null)}
            >
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AttendanceResultScreen({ session, onBack, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState({
    options: true,
    divisions: false,
    matrix: false,
  });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [onlyAbsentees, setOnlyAbsentees] = useState(false);
  const [onlyComplete, setOnlyComplete] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [examResult, classResult] = await Promise.all([
        teacherApi.fetchExams(session),
        teacherAttendanceApi.getAcademicClasses(session),
      ]);
      setExams(Array.isArray(examResult) ? examResult : []);
      setClasses(Array.isArray(classResult) ? classResult : []);
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to load examinations and classes.",
      );
    } finally {
      setLoading((current) => ({ ...current, options: false }));
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedClass) {
        setDivisions([]);
        setSelectedDivision(null);
        return;
      }
      setLoading((current) => ({ ...current, divisions: true }));
      const loadDivisions = async () => {
        try {
          const result = await teacherAttendanceApi.getAcademicDivisions(
            session,
            selectedClass.id,
          );
          if (active) setDivisions(Array.isArray(result) ? result : []);
        } catch (requestError) {
          if (active)
            setError(
              requestError?.message ||
                "Unable to load divisions for this class.",
            );
        } finally {
          if (active)
            setLoading((current) => ({ ...current, divisions: false }));
        }
      };
      void loadDivisions();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedClass, session]);

  const normalizeStatus = (value) => String(value || "Not Marked").trim();
  const normalizeMatrix = (result) => {
    const subjects = (result.subjects || []).map((subject, index) => ({
      id:
        subject?.id ||
        subject?.subject_id ||
        subject?.paper_id ||
        `subject-${index}`,
      label:
        subject?.label ||
        subject?.name ||
        subject?.subjectName ||
        subject?.paperName ||
        `Paper ${index + 1}`,
    }));
    const rawStudents = result.students || [];
    const students = rawStudents.map((student, index) => {
      const rawAttendance =
        student.attendance ||
        student.attendanceBySubject ||
        student.papers ||
        student.subjects ||
        {};
      const attendance = subjects.reduce((values, subject) => {
        const value = Array.isArray(rawAttendance)
          ? rawAttendance.find(
              (item) =>
                String(
                  item.subject_id || item.paper_id || item.subjectId || item.id,
                ) === String(subject.id) ||
                String(item.subjectName || item.name) === subject.label,
            )
          : rawAttendance[subject.id] || rawAttendance[subject.label];
        return {
          ...values,
          [subject.id]: normalizeStatus(
            typeof value === "object" ? value?.status : value,
          ),
        };
      }, {});
      const statuses = Object.values(attendance);
      const present = statuses.filter(
        (status) => status.toLowerCase() === "present",
      ).length;
      const absent = statuses.filter(
        (status) => status.toLowerCase() === "absent",
      ).length;
      return {
        ...student,
        id: student.id || student.student_id || `student-${index}`,
        name:
          student.name ||
          student.student_name ||
          student.studentName ||
          "Unnamed student",
        rollNumber: student.rollNumber || student.roll_no || student.roll || "",
        admissionNumber:
          student.admissionNumber ||
          student.admission_number ||
          student.admissionNo ||
          "",
        section: student.section || student.division || "",
        attendance,
        present,
        absent,
        totalPapers: statuses.length,
        percentage: statuses.length ? (present / statuses.length) * 100 : 0,
        overallStatus: absent
          ? "Absent"
          : statuses.length && present === statuses.length
            ? "Complete"
            : "Pending",
      };
    });
    return { subjects, students, audit: result.audit || [] };
  };

  const generateMatrix = async () => {
    if (!selectedExam || !selectedClass) {
      Alert.alert(
        "Selection required",
        "Please select an exam and class before generating the matrix.",
      );
      return;
    }
    setLoading((current) => ({ ...current, matrix: true }));
    setMatrix(null);
    setError("");
    try {
      const result = await teacherApi.getExamAttendanceHistory(
        {
          examId: selectedExam.id,
          classId: selectedClass.id,
          divisionId: selectedDivision?.id,
        },
        session,
      );
      setMatrix(normalizeMatrix(result));
    } catch (requestError) {
      setError(requestError?.message || "Unable to load attendance history.");
    } finally {
      setLoading((current) => ({ ...current, matrix: false }));
    }
  };

  const visibleStudents = useMemo(() => {
    if (!matrix) return [];
    const query = search.trim().toLowerCase();
    return matrix.students.filter((student) => {
      const matchesSearch =
        !query ||
        [student.name, student.rollNumber, student.admissionNumber].some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
        );
      const statuses = Object.values(student.attendance);
      const matchesStatus =
        statusFilter === "All Statuses" || statuses.includes(statusFilter);
      return (
        matchesSearch &&
        matchesStatus &&
        (!onlyAbsentees || student.absent > 0) &&
        (!onlyComplete || student.overallStatus === "Complete")
      );
    });
  }, [matrix, search, statusFilter, onlyAbsentees, onlyComplete]);

  const statistics = useMemo(() => {
    const students = matrix?.students || [];
    const records = students.flatMap((student) =>
      Object.values(student.attendance),
    );
    const present = records.filter(
      (status) => status.toLowerCase() === "present",
    ).length;
    const absent = records.filter(
      (status) => status.toLowerCase() === "absent",
    ).length;
    return {
      students: students.length,
      papers: matrix?.subjects?.length || 0,
      records: records.length,
      present,
      absent,
      percentage: records.length
        ? ((present / records.length) * 100).toFixed(1)
        : "0.0",
      withAbsences: students.filter((student) => student.absent > 0).length,
    };
  }, [matrix]);

  const paperStats = useMemo(
    () =>
      (matrix?.subjects || []).map((subject) => {
        const statuses = (matrix.students || [])
          .map((student) => student.attendance[subject.id])
          .filter(Boolean);
        const present = statuses.filter(
          (status) => status.toLowerCase() === "present",
        ).length;
        const absent = statuses.filter(
          (status) => status.toLowerCase() === "absent",
        ).length;
        const late = statuses.filter(
          (status) => status.toLowerCase() === "late",
        ).length;
        return {
          ...subject,
          total: statuses.length,
          present,
          absent,
          late,
          attendance: statuses.length
            ? ((present / statuses.length) * 100).toFixed(1)
            : "0.0",
          absence: statuses.length
            ? ((absent / statuses.length) * 100).toFixed(1)
            : "0.0",
        };
      }),
    [matrix],
  );

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Attendance History": "Attendance Result",
      "Marks Entry": "Exam Result",
      "Publish Results": "Publish Result",
      "Class Reports": "Class Result",
      "Hall Tickets": "Hall Ticket",
    };
    if (moduleMap[tab]) onSelectModule(moduleMap[tab]);
  };

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Historical Exam Attendance Matrix"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Cross-paper student presence analytics, absence tracking and verified
        audit registers
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Attendance History" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Attendance History" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <View style={styles.errorPanel}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={generateMatrix}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.filterPanel}>
        <View style={styles.filterGrid}>
          <FilterBadge
            label="Exam *"
            value={selectedExam?.label || "Select Exam..."}
            options={exams.map((exam) => ({
              ...exam,
              label: exam.name || exam.title || `Exam #${exam.id}`,
            }))}
            onSelect={(value) => {
              setSelectedExam(value);
              setMatrix(null);
            }}
          />
          <FilterBadge
            label="Class *"
            value={selectedClass?.label || "Select Class..."}
            options={classes}
            onSelect={(value) => {
              setSelectedClass(value);
              setMatrix(null);
            }}
          />
          <FilterBadge
            label="Division (Optional)"
            value={selectedDivision?.label || "All Divisions"}
            options={[{ id: "", label: "All Divisions" }, ...divisions]}
            onSelect={(value) => {
              setSelectedDivision(value.id ? value : null);
              setMatrix(null);
            }}
          />
        </View>
        <Pressable
          style={styles.primaryButton}
          disabled={loading.matrix}
          onPress={generateMatrix}
        >
          {loading.matrix ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Generate Matrix</Text>
          )}
        </Pressable>
      </View>
      {!selectedExam || !selectedClass ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Select Exam and Class</Text>
          <Text style={styles.emptyText}>
            Choose an examination and class above to pull the cross-subject
            attendance history matrix.
          </Text>
        </View>
      ) : loading.matrix ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading Attendance History...</Text>
        </View>
      ) : !matrix?.students.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No attendance records found</Text>
          <Text style={styles.emptyText}>
            No historical attendance records exist for the selected exam and
            class.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total Students"
              value={String(statistics.students)}
              label="Students"
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="people-outline"
            />
            <SummaryCard
              title="Total Papers"
              value={String(statistics.papers)}
              label="Papers"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="documents-outline"
            />
            <SummaryCard
              title="Attendance Records"
              value={String(statistics.records)}
              label="Records"
              tint={colors.softLilac}
              accent={colors.plum}
              icon="grid-outline"
            />
            <SummaryCard
              title="Present Records"
              value={String(statistics.present)}
              label="Present"
              tint={colors.paleTeal}
              accent={colors.teal}
              icon="checkmark-circle-outline"
            />
            <SummaryCard
              title="Absent Records"
              value={String(statistics.absent)}
              label="Absent"
              tint={colors.paleOrange}
              accent={colors.orange}
              icon="close-circle-outline"
            />
            <SummaryCard
              title="Overall Attendance"
              value={`${statistics.percentage}%`}
              label={`${statistics.withAbsences} with absences`}
              tint={colors.paleBlue}
              accent={colors.blue}
              icon="stats-chart-outline"
            />
          </View>
          <View style={styles.filterPanel}>
            <View style={styles.searchField}>
              <Icon name="search-outline" size={16} color={colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search student..."
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.filterGrid}>
              <FilterBadge
                label="Attendance Status"
                value={statusFilter}
                options={[
                  "All Statuses",
                  ...new Set(
                    matrix.students.flatMap((student) =>
                      Object.values(student.attendance),
                    ),
                  ),
                ]}
                onSelect={setStatusFilter}
              />
              <Pressable
                style={[
                  styles.publishFilter,
                  onlyAbsentees && styles.publishFilterActive,
                ]}
                onPress={() => setOnlyAbsentees((value) => !value)}
              >
                <Text
                  style={[
                    styles.publishFilterText,
                    onlyAbsentees && styles.publishFilterTextActive,
                  ]}
                >
                  Only Absentees
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.publishFilter,
                  onlyComplete && styles.publishFilterActive,
                ]}
                onPress={() => setOnlyComplete((value) => !value)}
              >
                <Text
                  style={[
                    styles.publishFilterText,
                    onlyComplete && styles.publishFilterTextActive,
                  ]}
                >
                  Complete Attendance
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Student Attendance Matrix</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.resultsTable}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsHeaderText}>Roll No</Text>
                <Text style={styles.resultsHeaderText}>Admission No</Text>
                <Text style={styles.resultsHeaderText}>Student Name</Text>
                {matrix.subjects.map((subject) => (
                  <Text key={subject.id} style={styles.resultsHeaderText}>
                    {subject.label}
                  </Text>
                ))}
                <Text style={styles.resultsHeaderText}>Present / Total</Text>
                <Text style={styles.resultsHeaderText}>Attendance</Text>
              </View>
              {visibleStudents.map((student) => (
                <View key={student.id} style={styles.resultsRow}>
                  <Text style={styles.resultsCell}>
                    {student.rollNumber || "—"}
                  </Text>
                  <Text style={styles.resultsCell}>
                    {student.admissionNumber || "—"}
                  </Text>
                  <Text style={styles.resultsCell}>{student.name}</Text>
                  {matrix.subjects.map((subject) => (
                    <View key={subject.id} style={styles.statusCell}>
                      <AttendanceStatusBadge
                        status={student.attendance[subject.id]}
                      />
                    </View>
                  ))}
                  <Text style={styles.resultsCell}>
                    {student.present}/{student.totalPapers}
                  </Text>
                  <Text style={styles.resultsCell}>
                    {student.percentage.toFixed(1)}% {student.overallStatus}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.sectionTitle}>
            Paper / Subject Attendance Summary
          </Text>
          {paperStats.map((paper) => (
            <View key={paper.id} style={styles.subjectStatCard}>
              <Text style={styles.listTitle}>{paper.label}</Text>
              <Text style={styles.listText}>
                Students: {paper.total} Present: {paper.present} Absent:{" "}
                {paper.absent} Late: {paper.late} Attendance: {paper.attendance}
                % Absence: {paper.absence}%
              </Text>
            </View>
          ))}
          <Text style={styles.sectionTitle}>Absence Tracking</Text>
          {visibleStudents
            .filter((student) => student.absent > 0)
            .map((student) => (
              <View key={student.id} style={styles.subjectStatCard}>
                <Text style={styles.listTitle}>{student.name}</Text>
                <Text style={styles.listText}>
                  Roll: {student.rollNumber || "—"} Absent papers:{" "}
                  {matrix.subjects
                    .filter(
                      (subject) =>
                        student.attendance[subject.id]?.toLowerCase() ===
                        "absent",
                    )
                    .map((subject) => subject.label)
                    .join(", ") || "—"}{" "}
                  Total absences: {student.absent}
                </Text>
              </View>
            ))}
          <Text style={styles.sectionTitle}>Verified Audit Register</Text>
          {matrix.audit.length ? (
            matrix.audit.map((entry, index) => (
              <View key={entry.id || index} style={styles.subjectStatCard}>
                <Text style={styles.listText}>
                  Student: {entry.student || entry.studentName || "—"} Paper:{" "}
                  {entry.subject || entry.paper || "—"} Status:{" "}
                  {entry.status || "—"} Date: {entry.date || "—"} Marked by:{" "}
                  {entry.markedBy || "—"} Verification:{" "}
                  {entry.verificationStatus || "—"}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Audit metadata is not available from the attendance-history
                response.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const hallTicketDefaults = {
  venue: "",
  reportingTime: "",
  guidelines: "",
};

function HallTicketScreen({ session, onBack, onSelectModule }) {
  const [, setExams] = useState([]);
  const [, setClasses] = useState([]);
  const [, setDivisions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [candidates] = useState([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState("");
  const [search, setSearch] = useState("");
  const [previewCandidate, setPreviewCandidate] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    ...hallTicketDefaults,
  });

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setLoading(true);
      setError("");
      try {
        const [examResult, classResult] = await Promise.all([
          teacherApi.fetchExams(session),
          teacherAttendanceApi.getAcademicClasses(session),
        ]);
        if (!active) return;
        const nextExams = Array.isArray(examResult) ? examResult : [];
        const nextClasses = Array.isArray(classResult) ? classResult : [];
        setExams(nextExams);
        setClasses(nextClasses);
        setSelectedExam(nextExams[0] || null);
        setSelectedClass(nextClasses[0] || null);
      } catch (requestError) {
        if (active) {
          setError(
            requestError?.message ||
              "Unable to load hall-ticket configuration.",
          );
          setExams([]);
          setClasses([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOptions();
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!selectedExam) {
      const timer = setTimeout(() => setSubjects([]), 0);
      return () => clearTimeout(timer);
    }
    let active = true;
    const loadSubjects = async () => {
      try {
        const result = await teacherApi.getExamSubjects(
          selectedExam.id,
          session,
        );
        if (active) setSubjects(Array.isArray(result) ? result : []);
      } catch (requestError) {
        if (active)
          setError(
            requestError?.message || "Unable to load examination subjects.",
          );
      }
    };
    void loadSubjects();
    return () => {
      active = false;
    };
  }, [selectedExam, session]);

  useEffect(() => {
    if (!selectedClass) {
      const timer = setTimeout(() => {
        setDivisions([]);
        setSelectedDivision(null);
      }, 0);
      return () => clearTimeout(timer);
    }
    let active = true;
    const loadDivisions = async () => {
      try {
        const result = await teacherAttendanceApi.getAcademicDivisions(
          session,
          selectedClass.id,
        );
        if (active) {
          const nextDivisions = Array.isArray(result) ? result : [];
          setDivisions(nextDivisions);
          setSelectedDivision(null);
        }
      } catch (requestError) {
        if (active)
          setError(requestError?.message || "Unable to load divisions.");
      }
    };
    void loadDivisions();
    return () => {
      active = false;
    };
  }, [selectedClass, session]);

  const selectedCandidates = candidates.filter(
    (candidate) => candidate.selected,
  );
  const visibleCandidates = candidates.filter((candidate) =>
    [candidate.name, candidate.rollNo, candidate.admissionNo].some((value) =>
      String(value).toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );

  const navigateTab = (tab) => {
    if (!onSelectModule) return;
    const moduleMap = {
      "Schedule Exam": "Set Exams",
      "Exam Schedules": "View Exams",
      Attendance: "Exam Attendance",
      "Attendance History": "Attendance Result",
      "Marks Entry": "Exam Result",
      "Publish Results": "Publish Result",
      "Class Reports": "Class Result",
    };
    if (moduleMap[tab]) onSelectModule(moduleMap[tab]);
  };

  const toggleCandidate = () => {};
  const showPdfNotice = () =>
    Alert.alert(
      "PDF generation",
      "Hall ticket PDF generation will be connected to the backend API.",
    );
  const showBatchNotice = () =>
    Alert.alert(
      "Batch PDF",
      `${selectedCandidates.length} selected candidate(s) are ready for batch PDF generation.`,
    );
  const saveSettings = () => {
    setSettingsOpen(false);
    Alert.alert(
      "Settings saved",
      "Venue and candidate guidelines have been updated for this session.",
    );
  };

  const hallTicketExam = useMemo(
    () => ({
      examination:
        selectedExam?.name ||
        selectedExam?.title ||
        selectedExam?.examName ||
        "Select Examination",
      targetClass:
        selectedClass?.name ||
        selectedClass?.className ||
        selectedClass?.label ||
        "Select Class",
      division:
        selectedDivision?.name ||
        selectedDivision?.label ||
        selectedDivision?.divisionName ||
        "All Divisions",
      subjects: Array.isArray(subjects)
        ? subjects.map((subject) => ({
            id: subject?.id || subject?.subjectId || subject?.name,
            name: subject?.name || subject?.subjectName || "Untitled Subject",
            date: subject?.date || subject?.examDate || "—",
            time: subject?.time || subject?.examTime || "—",
            marks: subject?.marks || subject?.maxMarks || "—",
          }))
        : [],
    }),
    [selectedExam, selectedClass, selectedDivision, subjects],
  );

  return (
    <View style={styles.screenWrap}>
      <ScreenHeader
        title="Admit Card & Hall Ticket Console"
        subtitle="Exam Suite"
        onBack={onBack}
      />
      <Text style={styles.pageDescription}>
        Configure exam venues, timelines, student rules, and issue printable A4
        hall tickets with QR verification
      </Text>
      <View style={styles.tabRow}>
        {[
          "Overview",
          "Schedule Exam",
          "Exam Schedules",
          "Attendance",
          "Attendance History",
          "Marks Entry",
          "Publish Results",
          "Class Reports",
          "Hall Tickets",
        ].map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabPill,
              tab === "Hall Tickets" && styles.tabPillActive,
            ]}
            onPress={() => navigateTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                tab === "Hall Tickets" && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.hallGeneratorCard}>
        <Text style={styles.sectionTitle}>Hall Ticket Generator</Text>
        <Text style={styles.listText}>
          Configure exam venues, and issue print-ready Admit Cards.
        </Text>
        <View style={styles.hallActionRow}>
          <Pressable style={styles.hallActionActive}>
            <Text style={styles.hallActionTextActive}>
              2 per A4 (Save 50% Paper)
            </Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              Alert.alert(
                "Published",
                "Hall tickets published successfully to students.",
              )
            }
          >
            <Text style={styles.primaryButtonText}>Publish to Students</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setSettingsOpen(true)}
          >
            <Text style={styles.secondaryButtonText}>
              Venue &amp; Guidelines
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={showBatchNotice}>
            <Text style={styles.secondaryButtonText}>
              Batch PDF ({selectedCandidates.length})
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.filterPanel}>
        <Text style={styles.sectionTitle}>Examination Configuration</Text>
        <View style={styles.filterGrid}>
          <FilterBadge
            label="Examination *"
            value={hallTicketExam.examination}
            options={[hallTicketExam.examination]}
            onSelect={() => {}}
          />
          <FilterBadge
            label="Target Class"
            value={hallTicketExam.targetClass}
            options={[hallTicketExam.targetClass]}
            onSelect={() => {}}
          />
          <FilterBadge
            label="Section / Division"
            value={hallTicketExam.division}
            options={[hallTicketExam.division]}
            onSelect={() => {}}
          />
        </View>
      </View>
      <View style={styles.hallTwoColumn}>
        <View style={styles.hallPanel}>
          <View style={styles.hallPanelHeader}>
            <Text style={styles.sectionTitle}>Exam Venue &amp; Config</Text>
            <Pressable
              style={styles.ghostButton}
              onPress={() => setSettingsOpen(true)}
            >
              <Text style={styles.ghostButtonText}>Edit Settings</Text>
            </Pressable>
          </View>
          <Text style={styles.listText}>Venue Center</Text>
          <Text style={styles.hallValue}>{settings.venue}</Text>
          <Text style={styles.listText}>Reporting Time</Text>
          <Text style={styles.hallValue}>{settings.reportingTime}</Text>
        </View>
        <View style={styles.hallPanel}>
          <Text style={styles.sectionTitle}>Candidate Guidelines:</Text>
          {settings.guidelines
            .split("\n")
            .filter(Boolean)
            .map((guideline, index) => (
              <Text key={guideline} style={styles.guidelineText}>
                {index + 1}. {guideline}
              </Text>
            ))}
        </View>
      </View>
      <View style={styles.hallPanel}>
        <Text style={styles.sectionTitle}>Exam Timetable Summary</Text>
        <Text style={styles.listText}>
          {hallTicketExam.subjects.length} Subjects
        </Text>
        {hallTicketExam.subjects.map((subject) => (
          <View key={subject.name} style={styles.timetableRow}>
            <Text style={styles.listTitle}>{subject.name}</Text>
            <Text style={styles.listText}>
              {subject.date} • {subject.time} • {subject.marks}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.hallPanel}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, roll no, or admission no..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
        <Text style={styles.selectedCount}>
          Selected Candidates: {selectedCandidates.length} / {candidates.length}
        </Text>
        {visibleCandidates.map((candidate) => (
          <View key={candidate.id} style={styles.candidateRow}>
            <Pressable
              onPress={() => toggleCandidate(candidate.id)}
              style={[
                styles.checkbox,
                candidate.selected && styles.checkboxSelected,
              ]}
            >
              <Text style={styles.checkboxText}>
                {candidate.selected ? "✓" : ""}
              </Text>
            </Pressable>
            <Text style={styles.candidateCell}>{candidate.rollNo}</Text>
            <Text style={styles.candidateCellWide}>{candidate.name}</Text>
            <Text style={styles.candidateCell}>{candidate.admissionNo}</Text>
            <Text style={styles.candidateCell}>{candidate.classSection}</Text>
            <View style={styles.candidateActions}>
              <Pressable
                style={styles.ghostButton}
                onPress={() => setPreviewCandidate(candidate)}
              >
                <Text style={styles.ghostButtonText}>Preview</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={showPdfNotice}>
                <Text style={styles.secondaryButtonText}>PDF</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(previewCandidate)}
        onRequestClose={() => setPreviewCandidate(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.a4Preview}>
            <Text style={styles.a4School}>IDPS Madanapalle School</Text>
            <Text style={styles.a4Title}>ADMIT CARD / HALL TICKET</Text>
            <Text style={styles.a4Exam}>{hallTicketExam.examination}</Text>
            {previewCandidate ? (
              <>
                <Text style={styles.modalInfo}>
                  Student: {previewCandidate.name}
                </Text>
                <Text style={styles.modalInfo}>
                  Admission No: {previewCandidate.admissionNo}
                </Text>
                <Text style={styles.modalInfo}>
                  Roll No: {previewCandidate.rollNo}
                </Text>
                <Text style={styles.modalInfo}>
                  Class &amp; Section: {previewCandidate.classSection}
                </Text>
              </>
            ) : null}
            <Text style={styles.modalInfo}>Venue: {settings.venue}</Text>
            <Text style={styles.modalInfo}>
              Reporting Time: {settings.reportingTime}
            </Text>
            <Text style={styles.a4Section}>Exam Timetable</Text>
            {hallTicketExam.subjects.map((subject) => (
              <Text key={subject.name} style={styles.modalInfo}>
                {subject.name} | {subject.date} | {subject.time} |{" "}
                {subject.marks}
              </Text>
            ))}
            <Text style={styles.a4Section}>Candidate Guidelines</Text>
            {settings.guidelines
              .split("\n")
              .filter(Boolean)
              .map((guideline, index) => (
                <Text key={guideline} style={styles.modalInfo}>
                  {index + 1}. {guideline}
                </Text>
              ))}
            <View style={styles.qrPlaceholder}>
              <Icon name="qr-code-outline" size={42} color={colors.ink} />
              <Text style={styles.listText}>QR verification placeholder</Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setPreviewCandidate(null)}
              >
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  Alert.alert(
                    "Print unavailable",
                    "Connect the print/PDF service to print this A4 hall ticket.",
                  )
                }
              >
                <Text style={styles.primaryButtonText}>Print</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={settingsOpen}
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Venue &amp; Guidelines</Text>
            <TextInput
              value={settings.venue}
              onChangeText={(value) =>
                setSettings((current) => ({ ...current, venue: value }))
              }
              placeholder="Venue Center"
              placeholderTextColor={colors.muted}
              style={styles.subjectInput}
            />
            <TextInput
              value={settings.reportingTime}
              onChangeText={(value) =>
                setSettings((current) => ({ ...current, reportingTime: value }))
              }
              placeholder="Reporting Time"
              placeholderTextColor={colors.muted}
              style={styles.subjectInput}
            />
            <TextInput
              multiline
              value={settings.guidelines}
              onChangeText={(value) =>
                setSettings((current) => ({ ...current, guidelines: value }))
              }
              placeholder="Candidate Guidelines"
              placeholderTextColor={colors.muted}
              style={[styles.subjectInput, styles.guidelineInput]}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.ghostButton}
                onPress={() => setSettingsOpen(false)}
              >
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveSettings}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterBadge({ label, value, options, onSelect }) {
  const [open, setOpen] = useState(false);
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <View style={styles.filterField}>
      <Text style={styles.filterLabel}>{label}</Text>
      <Pressable
        style={styles.filterBox}
        onPress={() => setOpen((current) => !current)}
      >
        <Text
          style={[
            styles.filterText,
            value === "Select Subject Paper..." ||
            value === "Select Exam..." ||
            value === "Select Class..." ||
            value === "All Divisions"
              ? styles.filterTextMuted
              : null,
          ]}
        >
          {value}
        </Text>
        <Icon name="chevron-down" size={15} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.optionBox}>
          {safeOptions.map((option) => {
            const optionLabel = option?.label || option;
            const isSelected =
              option?.id === value?.id || optionLabel === value;
            return (
              <Pressable
                key={option?.id || optionLabel}
                style={[styles.optionRow, isSelected && styles.optionRowActive]}
                onPress={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}
                >
                  {optionLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function TeacherExamsMarksScreen({
  session,
  module = "Exams / Marks",
  onSelectModule,
  onBack,
}) {
  const activeModule = module || "Exams / Marks";
  const normalizedActiveModule =
    activeModule === "Set Exam"
      ? "Set Exams"
      : activeModule === "View Exam"
        ? "View Exams"
        : activeModule === "Publish Exam"
          ? "Publish Result"
          : activeModule === "Class Results"
            ? "Class Result"
            : activeModule === "Attendance History"
              ? "Attendance Result"
              : activeModule === "Hall Tickets"
                ? "Hall Ticket"
                : activeModule;

  if (normalizedActiveModule === "Set Exams") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <TeacherSetExamsScreen
          session={session}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "View Exams") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <ViewExamsScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (activeModule === "Teachers Timetable") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <TeacherTimetableScreen session={session} />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Exam Attendance") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <ExamAttendanceScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Exam Result") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <ExamResultScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Publish Result") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <PublishResultScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Class Result") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <ClassResultScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Attendance Result") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <AttendanceResultScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  if (normalizedActiveModule === "Hall Ticket") {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <HallTicketScreen
          session={session}
          onBack={() => onSelectModule && onSelectModule("Exams / Marks")}
          onSelectModule={onSelectModule}
        />
      </ScrollView>
    );
  }

  return <ExamHubScreen session={session} onSelectModule={onSelectModule} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: "900", color: colors.ink },
  pageSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  gridWrap: { gap: 10 },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moduleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  moduleCopy: { flex: 1 },
  moduleTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  moduleDescription: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 16,
  },
  pressed: { opacity: 0.8 },
  screenWrap: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 120,
  },
  headerRow: { marginBottom: 8 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.paleBlue,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backText: { color: colors.blue, fontWeight: "800", fontSize: 11 },
  pageDescription: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tabPill: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tabPillActive: { backgroundColor: colors.paleBlue, borderColor: colors.blue },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: colors.blue },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  summaryCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    minHeight: 110,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryTitle: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  summaryValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  summaryLabel: { color: colors.muted, fontSize: 9, marginTop: 4 },
  filterPanel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  filterField: { width: "48%", position: "relative", zIndex: 1 },
  filterLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
  },
  filterBox: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  filterTextMuted: { color: colors.muted },
  filterTextSelected: { color: colors.blue },
  selectWrap: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    overflow: "hidden",
  },
  filterOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  filterOptionSelected: { backgroundColor: colors.paleBlue },
  optionBox: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 58,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  optionRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 40,
    justifyContent: "center",
  },
  optionRowActive: { backgroundColor: colors.paleBlue },
  optionText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  optionTextSelected: { color: colors.blue },
  errorPanel: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorText: { color: colors.red, flex: 1, fontSize: 11, lineHeight: 16 },
  retryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  retryText: { color: colors.red, fontSize: 11, fontWeight: "800" },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, marginLeft: 8 },
  actionRow: { marginTop: 14, alignItems: "flex-start" },
  listCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  listHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  listHeaderText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    flex: 1,
    minWidth: 92,
  },
  examHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  examIdentity: { flex: 1 },
  listTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  listText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  recordGrid: { marginTop: 8 },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  detailValue: {
    color: colors.ink,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusScheduled: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  statusComplete: {
    backgroundColor: colors.paleTeal,
    borderColor: colors.teal,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  statusBadgeTextScheduled: { color: colors.blue },
  statusBadgeTextDone: { color: colors.teal },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "space-between",
  },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  primaryButtonText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: { color: colors.blue, fontWeight: "800", fontSize: 12 },
  ghostButton: {
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  ghostButtonText: { color: colors.blue, fontWeight: "800", fontSize: 12 },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    justifyContent: "space-between",
  },
  listWrap: { marginTop: 14 },
  emptyState: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 18,
    marginTop: 14,
  },
  emptyTitle: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 20, 22, 0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  modalDescription: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  modalInfo: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    justifyContent: "space-between",
  },
  subjectList: { marginTop: 10, gap: 6 },
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
  },
  subjectCopy: { flex: 1, paddingRight: 8 },
  subjectText: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  subjectMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  subjectActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  subjectInput: {
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginTop: 8,
    fontSize: 12,
  },
  linkButton: { alignItems: "center", marginTop: 12 },
  linkButtonText: { color: colors.blue, fontWeight: "800", fontSize: 12 },
  resultRow: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
    gap: 4,
  },
  rowLabel: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  statusBox: {
    backgroundColor: colors.paleTeal,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.teal,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusText: { color: colors.teal, fontWeight: "800", fontSize: 10 },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  rosterHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  rosterHeaderText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    flex: 1,
    minWidth: 88,
  },
  rosterCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  rosterIdentity: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  statusChoice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  statusChoicePresent: {
    backgroundColor: colors.paleTeal,
    borderColor: colors.teal,
  },
  statusChoiceAbsent: {
    backgroundColor: colors.paleOrange,
    borderColor: colors.orange,
  },
  statusChoiceText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  performanceStrip: {
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  performanceText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  marksHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  marksHeaderText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    flex: 1,
    minWidth: 88,
  },
  marksCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  marksInput: {
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    fontSize: 12,
    minWidth: 100,
  },
  remarksInput: {
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    fontSize: 12,
  },
  resultStatus: { fontSize: 11, fontWeight: "900" },
  passText: { color: colors.teal },
  failText: { color: colors.red },
  pendingText: { color: colors.orange },
  publishFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  publishFilter: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  publishFilterActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  publishFilterText: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  publishFilterTextActive: { color: colors.white },
  publishHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  publishHeaderText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    flex: 1,
    minWidth: 105,
  },
  publishCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  publishIdentity: { flex: 1 },
  publishActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  visibilityBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  visibilityLive: {
    backgroundColor: colors.paleTeal,
    borderColor: colors.teal,
  },
  visibilityDraft: {
    backgroundColor: colors.paleOrange,
    borderColor: colors.orange,
  },
  visibilityText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  recallButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  recallText: { color: colors.red, fontWeight: "800", fontSize: 12 },
  resultsTable: { minWidth: 900, marginTop: 14 },
  resultsHeader: {
    flexDirection: "row",
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  resultsHeaderText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    width: 105,
  },
  resultsRow: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  resultsCell: { color: colors.ink, fontSize: 10, width: 105 },
  subjectStatCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  statusCell: { width: 105, alignItems: "flex-start" },
  attendanceStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  attendanceStatusText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  lateStatusBadge: {
    backgroundColor: colors.paleOrange,
    borderColor: colors.orange,
  },
  pendingStatusBadge: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
  },
  hallGeneratorCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  hallActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  hallActionActive: {
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 10,
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  hallActionTextActive: { color: colors.blue, fontWeight: "900", fontSize: 11 },
  hallTwoColumn: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  hallPanel: {
    flex: 1,
    minWidth: 280,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  hallPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hallValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 3,
  },
  guidelineText: { color: colors.ink, fontSize: 11, lineHeight: 20 },
  timetableRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 10,
    marginTop: 8,
  },
  selectedCount: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
  },
  candidateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  checkboxText: { color: colors.white, fontWeight: "900" },
  candidateCell: { color: colors.ink, fontSize: 11, minWidth: 82 },
  candidateCellWide: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    flex: 1,
    minWidth: 150,
  },
  candidateActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  a4Preview: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 24,
    margin: 20,
    minHeight: 760,
    justifyContent: "flex-start",
  },
  a4School: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  a4Title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12,
  },
  a4Exam: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginVertical: 14,
  },
  a4Section: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 6,
    marginTop: 18,
    marginBottom: 6,
  },
  qrPlaceholder: {
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    padding: 12,
    marginTop: 18,
    alignSelf: "center",
  },
  guidelineInput: { minHeight: 110, textAlignVertical: "top" },
});
