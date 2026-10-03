import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
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
import { teacherApi } from "../services/teacherApi";

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

const examTargetOptions = [
  "Global (All Classes)",
  "Class_1",
  "Class_1 • A",
  "Class_1 • B",
  "Class_1 • C",
  "Class_2 • A",
  "Class_4",
  "Class_4 • A",
  "Class_5 • A",
  "Class_6",
  "Class_10 • A",
];

const statusFilters = ["ALL", "Scheduled", "Completed"];
const subjectPool = [
  "Mathematics",
  "Science",
  "English",
  "Social Science",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Computer",
];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateInput(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
}

function parseDateString(value) {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function normalizeTarget(target) {
  if (!target) return "Global (All Classes)";
  if (target === "Global (All Classes)") return target;
  return target;
}

function SelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.selectBox} onPress={() => setOpen(true)}>
        <Text style={styles.selectText}>{value || "Select an option"}</Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={styles.optionSheet}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.optionTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionRow,
                  value === option && styles.optionRowActive,
                ]}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === option && styles.optionTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SummaryCard({ label, value, helper, tint, accent, icon }) {
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
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryHelper}>{helper}</Text>
    </View>
  );
}

function ExamListItem({ item, onView, onSubjects }) {
  return (
    <View style={styles.examCard}>
      <View style={styles.examHeader}>
        <View style={styles.examIdentity}>
          <Text style={styles.examTitle}>{item.name}</Text>
          <Text style={styles.examId}>ID: #{item.id}</Text>
        </View>
        <View
          style={[
            styles.statusPill,
            item.status === "Completed"
              ? styles.statusComplete
              : styles.statusScheduled,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === "Completed"
                ? styles.statusTextDone
                : styles.statusTextScheduled,
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.detailText}>
        <Text style={styles.detailLabel}>Target:</Text>{" "}
        {normalizeTarget(item.targetClass)}
      </Text>
      <Text style={styles.detailText}>
        <Text style={styles.detailLabel}>Date:</Text> {item.startDate}
      </Text>
      <Text style={styles.detailText}>
        <Text style={styles.detailLabel}>Time:</Text> {item.startTime} -{" "}
        {item.endTime}
      </Text>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => onSubjects(item)}
        >
          <Text style={styles.secondaryButtonText}>Subjects</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => onView(item)}>
          <Text style={styles.primaryButtonText}>View</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TeacherSetExamsScreen({ session, onSelectModule }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedExam, setSelectedExam] = useState(null);
  const [subjectListVisible, setSubjectListVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateField, setDateField] = useState("");
  const [timeField, setTimeField] = useState("");
  const [visibleSubjects, setVisibleSubjects] = useState([]);
  const [form, setForm] = useState({
    name: "",
    targetClass: "Global (All Classes)",
    section: "",
    startDate: "",
    endDate: "",
    startTime: "09:00",
    endTime: "10:00",
    description: "",
    status: "Scheduled",
    subjects: [],
  });

  useEffect(() => {
    let isActive = true;

    const fetchExams = async () => {
      setLoading(true);
      try {
        const data = await teacherApi.getExams(session);
        if (isActive) {
          setExams(Array.isArray(data) ? data : []);
        }
      } catch {
        if (isActive) {
          setExams([]);
          Alert.alert(
            "Unable to load exams",
            "There was a problem loading exam data.",
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchExams();

    return () => {
      isActive = false;
    };
  }, [session]);

  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();

    return exams.filter((exam) => {
      const statusMatch =
        statusFilter === "ALL" || exam.status === statusFilter;
      const queryMatch =
        !query ||
        [exam.name, String(exam.id), exam.targetClass, exam.section || ""].some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
        );
      return statusMatch && queryMatch;
    });
  }, [exams, search, statusFilter]);

  const summary = useMemo(() => {
    const total = exams.length;
    const active = exams.filter((exam) => exam.status === "Scheduled").length;
    const completed = exams.filter(
      (exam) => exam.status === "Completed",
    ).length;
    const globalExams = exams.filter((exam) =>
      (exam.targetClass || "").toLowerCase().includes("global"),
    ).length;

    return { total, active, completed, globalExams };
  }, [exams]);

  const handleCreateExam = async () => {
    const requiredFields = [
      form.name.trim(),
      form.targetClass,
      form.startDate,
      form.endDate,
      form.startTime,
      form.endTime,
    ];
    if (!requiredFields.every(Boolean)) {
      Alert.alert(
        "Required fields missing",
        "Please complete all required exam details before saving.",
      );
      return;
    }

    const start = parseDateString(form.startDate);
    const end = parseDateString(form.endDate);
    if (!start || !end) {
      Alert.alert(
        "Invalid date",
        "Please use the date picker and select valid start and end dates.",
      );
      return;
    }

    if (end < start) {
      Alert.alert(
        "Invalid dates",
        "End date cannot be earlier than the start date.",
      );
      return;
    }

    setSaving(true);
    try {
      const created = await teacherApi.createExam(
        {
          name: form.name.trim(),
          targetClass: form.targetClass,
          section: form.section || null,
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime,
          description: form.description.trim(),
          status: form.status || "Scheduled",
          subjects: form.subjects.length ? form.subjects : ["General"],
        },
        session,
      );

      setExams((current) => [created, ...current]);
      setFormVisible(false);
      setForm({
        name: "",
        targetClass: "Global (All Classes)",
        section: "",
        startDate: "",
        endDate: "",
        startTime: "09:00",
        endTime: "10:00",
        description: "",
        status: "Scheduled",
        subjects: [],
      });
      Alert.alert(
        "Exam scheduled",
        `${created.name || "Exam"} has been added successfully.`,
      );
    } catch {
      Alert.alert("Unable to schedule exam", "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  const selectedSubjectList = useMemo(
    () => (visibleSubjects.length ? visibleSubjects : ["No subjects assigned"]),
    [visibleSubjects],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Schedule & Configure Examination</Text>
        <Text style={styles.headerMeta}>Exam Suite</Text>
        <Text style={styles.headerCopy}>
          Create new examination sessions, set start/end dates, assign targeted
          classes and configure timetables
        </Text>
      </View>

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
                  : tab === "Attendance History"
                    ? "Attendance Result"
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
              (tab === "Overview" ||
                tab === "Schedule Exam" ||
                tab === "Exam Schedules") &&
                styles.tabPillActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                (tab === "Overview" ||
                  tab === "Schedule Exam" ||
                  tab === "Exam Schedules") &&
                  styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => setFormVisible(true)}
        >
          <Icon name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.primaryButtonText}>Schedule New Exam</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Total"
          value={String(summary.total)}
          helper="Total Exams"
          tint={colors.paleBlue}
          accent={colors.blue}
          icon="document-text-outline"
        />
        <SummaryCard
          label="Active"
          value={String(summary.active)}
          helper="Active Schedules"
          tint={colors.paleTeal}
          accent={colors.teal}
          icon="calendar-outline"
        />
        <SummaryCard
          label="Done"
          value={String(summary.completed)}
          helper="Completed"
          tint={colors.paleOrange}
          accent={colors.orange}
          icon="checkmark-done-outline"
        />
        <SummaryCard
          label="Global Exams"
          value={String(summary.globalExams)}
          helper="Global"
          tint={colors.softLilac}
          accent={colors.plum}
          icon="globe-outline"
        />
      </View>

      <View style={styles.filterPanel}>
        <View style={styles.searchWrap}>
          <Icon name="search-outline" size={17} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search exams by name or class..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {statusFilters.map((filter) => (
            <Pressable
              key={filter}
              style={[
                styles.filterChip,
                statusFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Examinations</Text>
        <Text style={styles.sectionCount}>{filteredExams.length} records</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={styles.loadingText}>Loading exams...</Text>
        </View>
      ) : filteredExams.length ? (
        filteredExams.map((exam) => (
          <ExamListItem
            key={exam.id}
            item={exam}
            onView={(item) => setSelectedExam(item)}
            onSubjects={(item) => {
              setVisibleSubjects(item.subjects || []);
              setSubjectListVisible(true);
            }}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Icon name="calendar-outline" size={28} color={colors.muted} />
          <Text style={styles.emptyTitle}>No exams found</Text>
          <Text style={styles.emptyText}>
            Try a different search or create a new exam schedule.
          </Text>
        </View>
      )}

      <Modal
        transparent
        visible={Boolean(selectedExam)}
        animationType="fade"
        onRequestClose={() => setSelectedExam(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setSelectedExam(null)}
        >
          <View
            style={styles.detailSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Examination Details</Text>
              <Pressable onPress={() => setSelectedExam(null)}>
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            {selectedExam ? (
              <View style={styles.detailList}>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Examination:</Text>{" "}
                  {selectedExam.name}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Exam ID:</Text> #
                  {selectedExam.id}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Target class:</Text>{" "}
                  {normalizeTarget(selectedExam.targetClass)}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Section:</Text>{" "}
                  {selectedExam.section || "All"}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Start date:</Text>{" "}
                  {formatDisplayDate(parseDateString(selectedExam.startDate)) ||
                    selectedExam.startDate}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>End date:</Text>{" "}
                  {formatDisplayDate(parseDateString(selectedExam.endDate)) ||
                    selectedExam.endDate}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Start time:</Text>{" "}
                  {selectedExam.startTime}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>End time:</Text>{" "}
                  {selectedExam.endTime}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Status:</Text>{" "}
                  {selectedExam.status}
                </Text>
                <Text style={styles.detailRow}>
                  <Text style={styles.detailKey}>Assigned subjects:</Text>{" "}
                  {(selectedExam.subjects || []).join(", ") || "None assigned"}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={subjectListVisible}
        animationType="fade"
        onRequestClose={() => setSubjectListVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setSubjectListVisible(false)}
        >
          <View
            style={styles.detailSheet}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assigned Subjects</Text>
              <Pressable onPress={() => setSubjectListVisible(false)}>
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            {selectedSubjectList.map((subject) => (
              <View key={subject} style={styles.subjectChip}>
                <Text style={styles.subjectChipText}>{subject}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={formVisible}
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setFormVisible(false)}
        >
          <View style={styles.formSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule New Exam</Text>
              <Pressable onPress={() => setFormVisible(false)}>
                <Icon name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  Examination Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  value={form.name}
                  onChangeText={(text) =>
                    setForm((current) => ({ ...current, name: text }))
                  }
                  placeholder="Periodic Text"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>

              <SelectField
                label="Target Class / Section"
                value={form.targetClass}
                options={examTargetOptions}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    targetClass: value,
                    section: value.includes("•")
                      ? value.split("•")[1]?.trim() || ""
                      : "",
                  }))
                }
              />

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Start Date</Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setDateField("startDate")}
                >
                  <Text style={styles.selectText}>
                    {form.startDate || "Select start date"}
                  </Text>
                  <Icon
                    name="calendar-outline"
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
                {dateField === "startDate" ? (
                  <DateTimePicker
                    value={parseDateString(form.startDate) || new Date()}
                    mode="date"
                    onChange={(_, selectedDate) => {
                      setDateField("");
                      if (selectedDate) {
                        setForm((current) => ({
                          ...current,
                          startDate: formatDateInput(selectedDate),
                        }));
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>End Date</Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setDateField("endDate")}
                >
                  <Text style={styles.selectText}>
                    {form.endDate || "Select end date"}
                  </Text>
                  <Icon
                    name="calendar-outline"
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
                {dateField === "endDate" ? (
                  <DateTimePicker
                    value={parseDateString(form.endDate) || new Date()}
                    mode="date"
                    onChange={(_, selectedDate) => {
                      setDateField("");
                      if (selectedDate) {
                        setForm((current) => ({
                          ...current,
                          endDate: formatDateInput(selectedDate),
                        }));
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setTimeField("startTime")}
                >
                  <Text style={styles.selectText}>
                    {form.startTime || "Select start time"}
                  </Text>
                  <Icon name="time-outline" size={16} color={colors.muted} />
                </Pressable>
                {timeField === "startTime" ? (
                  <DateTimePicker
                    value={
                      new Date(
                        2024,
                        0,
                        1,
                        Number(form.startTime.split(":")[0]) || 9,
                        Number(form.startTime.split(":")[1]) || 0,
                      )
                    }
                    mode="time"
                    onChange={(_, selectedDate) => {
                      setTimeField("");
                      if (selectedDate) {
                        const hours = String(selectedDate.getHours()).padStart(
                          2,
                          "0",
                        );
                        const minutes = String(
                          selectedDate.getMinutes(),
                        ).padStart(2, "0");
                        setForm((current) => ({
                          ...current,
                          startTime: `${hours}:${minutes}`,
                        }));
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>End Time</Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() => setTimeField("endTime")}
                >
                  <Text style={styles.selectText}>
                    {form.endTime || "Select end time"}
                  </Text>
                  <Icon name="time-outline" size={16} color={colors.muted} />
                </Pressable>
                {timeField === "endTime" ? (
                  <DateTimePicker
                    value={
                      new Date(
                        2024,
                        0,
                        1,
                        Number(form.endTime.split(":")[0]) || 10,
                        Number(form.endTime.split(":")[1]) || 0,
                      )
                    }
                    mode="time"
                    onChange={(_, selectedDate) => {
                      setTimeField("");
                      if (selectedDate) {
                        const hours = String(selectedDate.getHours()).padStart(
                          2,
                          "0",
                        );
                        const minutes = String(
                          selectedDate.getMinutes(),
                        ).padStart(2, "0");
                        setForm((current) => ({
                          ...current,
                          endTime: `${hours}:${minutes}`,
                        }));
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  Description / Instructions
                </Text>
                <TextInput
                  value={form.description}
                  onChangeText={(text) =>
                    setForm((current) => ({ ...current, description: text }))
                  }
                  placeholder="Add instructions for students and invigilators"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Subjects</Text>
                <View style={styles.subjectContainer}>
                  {subjectPool.map((subject) => {
                    const active = form.subjects.includes(subject);
                    return (
                      <Pressable
                        key={subject}
                        style={[
                          styles.subjectToggle,
                          active && styles.subjectToggleActive,
                        ]}
                        onPress={() => {
                          setForm((current) => ({
                            ...current,
                            subjects: active
                              ? current.subjects.filter(
                                  (entry) => entry !== subject,
                                )
                              : [...current.subjects, subject],
                          }));
                        }}
                      >
                        <Text
                          style={[
                            styles.subjectToggleText,
                            active && styles.subjectToggleTextActive,
                          ]}
                        >
                          {subject}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Status</Text>
                <Pressable
                  style={styles.selectBox}
                  onPress={() =>
                    setForm((current) => ({
                      ...current,
                      status:
                        current.status === "Scheduled"
                          ? "Completed"
                          : "Scheduled",
                    }))
                  }
                >
                  <Text style={styles.selectText}>{form.status}</Text>
                  <Icon name="refresh-outline" size={16} color={colors.muted} />
                </Pressable>
              </View>

              <View style={styles.formActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setFormVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleCreateExam}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? "Saving..." : "Create Exam"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 120 },
  headerCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  headerTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  headerMeta: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 6,
    textTransform: "uppercase",
  },
  headerCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
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
  actionRow: { marginBottom: 14 },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.blue, fontWeight: "900", fontSize: 12 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    width: "48%",
    minHeight: 112,
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
    marginBottom: 8,
  },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  summaryValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },
  summaryHelper: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 4,
    textTransform: "uppercase",
  },
  filterPanel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 13, marginLeft: 8 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    backgroundColor: colors.canvas,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  filterChipText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  filterChipTextActive: { color: colors.blue },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  sectionCount: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  examCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  examHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  examIdentity: { flex: 1 },
  examTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  examId: { color: colors.muted, fontSize: 11, marginTop: 3 },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  statusScheduled: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  statusComplete: {
    backgroundColor: colors.paleTeal,
    borderColor: colors.teal,
  },
  statusText: { fontSize: 10, fontWeight: "900" },
  statusTextScheduled: { color: colors.blue },
  statusTextDone: { color: colors.teal },
  detailText: { color: colors.ink, fontSize: 12, marginTop: 6 },
  detailLabel: { fontWeight: "800" },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  emptyState: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginTop: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 19, 27, 0.35)",
    justifyContent: "flex-end",
  },
  detailSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "76%",
  },
  formSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  detailList: { gap: 6 },
  detailRow: { color: colors.ink, fontSize: 12 },
  detailKey: { fontWeight: "800" },
  optionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "55%",
  },
  optionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  optionRow: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  optionRowActive: { backgroundColor: colors.paleBlue },
  optionText: { color: colors.ink, fontSize: 13 },
  optionTextActive: { color: colors.blue, fontWeight: "800" },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  required: { color: colors.red },
  selectBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: colors.ink, fontSize: 12, flex: 1 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 9,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 12,
  },
  multilineInput: { minHeight: 86, paddingTop: 10 },
  subjectContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectToggle: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  subjectToggleActive: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  subjectToggleText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  subjectToggleTextActive: { color: colors.blue },
  formActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  subjectChip: {
    backgroundColor: colors.paleBlue,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  subjectChipText: { color: colors.blue, fontWeight: "800", fontSize: 11 },
});
