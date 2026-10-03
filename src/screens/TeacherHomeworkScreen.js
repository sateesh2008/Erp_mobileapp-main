import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
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
  blue: "#1E32CC",
  pale: "#EEF0FC",
  green: "#334BD6",
  orange: "#D9822B",
  red: "#C65353",
};
const academicYears = ["All Academic Years"];
const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value) => {
  const parts = String(value || "")
    .split(/[/-]/)
    .map(Number);
  if (parts.length !== 3) return null;
  return String(value).startsWith("20")
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(parts[2], parts[1] - 1, parts[0]);
};
const formatDate = (value) => {
  const date = parseDate(value);
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";
};
const statusOf = (item) => {
  if (item.completed || String(item.status || "").toUpperCase() === "COMPLETED")
    return "COMPLETED";
  const due = parseDate(item.dueDate);
  if (!due) return "ACTIVE";
  if (dateKey(due) === dateKey(new Date())) return "DUE TODAY";
  return dateKey(due) < dateKey(new Date()) ? "LAPSED" : "ACTIVE";
};
const statusText = (value) =>
  value === "DUE TODAY"
    ? "Due Today"
    : value.charAt(0) + value.slice(1).toLowerCase();
const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Select({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
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
          <View style={styles.options}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option}
                style={styles.option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
function Button({ title, onPress, secondary, disabled }) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Summary({ label, value, icon, tint, accent }) {
  return (
    <View style={[styles.summary, { backgroundColor: tint }]}>
      <View style={[styles.summaryIcon, { backgroundColor: colors.white }]}>
        <Icon name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
function AssignmentCard({ item, index, onPreview, session }) {
  const status = statusOf(item);
  return (
    <View style={styles.card}>
      <Text style={styles.serial}>{String(index + 1).padStart(2, "0")}</Text>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.copy}>
            <Text style={styles.classText}>
              {item.className || item.class || "Class"}
              {item.section ? `-${item.section}` : ""}
            </Text>
            <Text style={styles.subject}>{item.subject}</Text>
            <Text style={styles.topic}>{item.title || item.topic}</Text>
          </View>
          <Text style={styles.badge}>{statusText(status)}</Text>
        </View>
        <Text style={styles.meta}>
          Teacher:{" "}
          {item.teacher || session?.name || session?.user?.name || "Teacher"}
        </Text>
        <Text style={styles.meta}>
          Due: {formatDate(item.dueDate)} |{" "}
          {item.academicYear || session?.academicYear || ""}
        </Text>
        <Pressable style={styles.preview} onPress={() => onPreview(item)}>
          <Text style={styles.previewText}>Preview</Text>
        </Pressable>
      </View>
    </View>
  );
}
function Preview({ item, onClose, session }) {
  if (!item) return null;
  const fields = [
    ["Subject", item.subject],
    ["Assignment Title", item.title || item.topic],
    [
      "Class",
      `${item.className || item.class || "N/A"}${item.section ? `-${item.section}` : ""}`,
    ],
    [
      "Teacher",
      item.teacher || session?.name || session?.user?.name || "Teacher",
    ],
    ["Description", item.description || "No description provided."],
    ["Assigned Date", formatDate(item.assignedDate)],
    ["Due Date", formatDate(item.dueDate)],
    ["Academic Year", item.academicYear || session?.academicYear || ""],
    ["Submission Status", statusText(statusOf(item))],
  ];
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={styles.modalScreen}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Assignment Details</Text>
          <Pressable onPress={onClose}>
            <Icon name="close" size={22} />
          </Pressable>
        </View>
        {fields.map(([label, value]) => (
          <View style={styles.detail} key={label}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || "N/A"}</Text>
          </View>
        ))}
      </ScrollView>
    </Modal>
  );
}
function LegacyAddAssignment({ visible, classes, session, onClose, onSaved }) {
  const [form, setForm] = useState({
    className: "",
    section: "",
    subject: "",
    title: "",
    description: "",
    assignedDate: new Date(),
    dueDate: new Date(),
    academicYear: session?.academicYear || "",
  });
  const [dateField, setDateField] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    if (
      !form.className ||
      !form.section ||
      !form.subject.trim() ||
      !form.title.trim()
    )
      return Alert.alert(
        "Complete required fields",
        "Class, section, subject, and assignment title are required.",
      );
    if (form.dueDate < form.assignedDate)
      return Alert.alert(
        "Invalid dates",
        "Due date cannot be before assigned date.",
      );
    setSaving(true);
    try {
      await teacherApi.createHomework(
        {
          ...form,
          assignedDate: dateKey(form.assignedDate),
          dueDate: dateKey(form.dueDate),
          subject: form.subject.trim(),
          title: form.title.trim(),
        },
        session,
      );
      onSaved();
    } catch {
      Alert.alert("Unable to create assignment", "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={styles.modalScreen}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Assignment</Text>
          <Pressable onPress={onClose}>
            <Icon name="close" size={22} />
          </Pressable>
        </View>
        <Select
          label="Class *"
          value={form.className}
          options={classes}
          onChange={(value) => set("className", value)}
        />
        <Select
          label="Section *"
          value={form.section}
          options={["A", "B", "C"]}
          onChange={(value) => set("section", value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Subject *"
          value={form.subject}
          onChangeText={(value) => set("subject", value)}
        />
        <TextInput
          style={styles.input}
          placeholder="Assignment Title *"
          value={form.title}
          onChangeText={(value) => set("title", value)}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Description"
          value={form.description}
          onChangeText={(value) => set("description", value)}
          multiline
        />
        <Text style={styles.label}>Assigned Date *</Text>
        <Pressable
          style={styles.select}
          onPress={() => setDateField("assignedDate")}
        >
          <Text style={styles.selectText}>
            {formatDate(dateKey(form.assignedDate))}
          </Text>
        </Pressable>
        {dateField === "assignedDate" && (
          <DateTimePicker
            value={form.assignedDate}
            mode="date"
            onChange={(_, value) => {
              setDateField("");
              if (value) set("assignedDate", value);
            }}
          />
        )}
        <Text style={styles.label}>Due Date *</Text>
        <Pressable
          style={styles.select}
          onPress={() => setDateField("dueDate")}
        >
          <Text style={styles.selectText}>
            {formatDate(dateKey(form.dueDate))}
          </Text>
        </Pressable>
        {dateField === "dueDate" && (
          <DateTimePicker
            value={form.dueDate}
            mode="date"
            onChange={(_, value) => {
              setDateField("");
              if (value) set("dueDate", value);
            }}
          />
        )}
        <Select
          label="Academic Year *"
          value={form.academicYear}
          options={academicYears.slice(1)}
          onChange={(value) => set("academicYear", value)}
        />
        <View style={styles.modalActions}>
          <Button title="Cancel" secondary onPress={onClose} />
          <Button
            title={saving ? "Saving..." : "Create Assignment"}
            disabled={saving}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </Modal>
  );
}

export default function TeacherHomeworkScreen({ session }) {
  const [items, setItems] = useState([]);
  const [year, setYear] = useState(session?.academicYear || "");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState("10");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        setItems(await teacherApi.getHomework(session));
        setError("");
      } catch {
        setError("Unable to load homework assignments. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const text = query.toLowerCase().trim();
        return (
          (year === academicYears[0] ||
            (item.academicYear || session?.academicYear || "") === year) &&
          (!text ||
            [
              item.title,
              item.topic,
              item.subject,
              item.className,
              item.class,
              item.section,
              item.teacher,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(text),
            ))
        );
      }),
    [items, year, query, session?.academicYear],
  );
  const counts = {
    active: visible.filter((item) => statusOf(item) === "ACTIVE").length,
    due: visible.filter((item) => statusOf(item) === "DUE TODAY").length,
    past: visible.filter((item) => statusOf(item) === "LAPSED").length,
    classes: new Set(
      visible.map((item) => item.className || item.class).filter(Boolean),
    ).size,
  };
  const pageSize = Number(perPage);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const classes = [
    ...new Set(
      items.map((item) => item.className || item.class).filter(Boolean),
    ),
  ];
  const exportCsv = async () => {
    if (!visible.length)
      return Alert.alert(
        "Nothing to export",
        "No assignments match the current filters.",
      );
    const rows = [
      [
        "S.No",
        "Class",
        "Section",
        "Grade Level",
        "Subject",
        "Assignment Title",
        "Teacher",
        "Assigned Date",
        "Due Date",
        "Status",
        "Academic Year",
      ],
      ...visible.map((item, index) => [
        index + 1,
        item.className || item.class,
        item.section,
        item.gradeLevel || "Grade Level",
        item.subject,
        item.title || item.topic,
        item.teacher || session?.name || session?.user?.name || "Teacher",
        item.assignedDate,
        item.dueDate,
        statusText(statusOf(item)),
        item.academicYear || session?.academicYear || "",
      ]),
    ];
    try {
      await Share.share({
        title: "Homework Assignments CSV",
        message: rows.map((row) => row.map(csvValue).join(",")).join("\n"),
      });
    } catch {
      Alert.alert("Export unavailable", "Unable to open the share sheet.");
    }
  };
  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
      >
        <Text style={styles.title}>Homework & Assignments</Text>
        <Text style={styles.subtitle}>{visible.length} ASSIGNMENTS</Text>
        <View style={styles.actions}>
          <Button title="Export" secondary onPress={exportCsv} />
          <Button title="Add Assignment" onPress={() => setFormOpen(true)} />
        </View>
        <View style={styles.summaryGrid}>
          <Summary
            label="Active Assignments"
            value={counts.active}
            icon="book-outline"
            tint={colors.pale}
            accent={colors.blue}
          />
          <Summary
            label="Due Today"
            value={counts.due}
            icon="calendar-outline"
            tint="#FFF1DF"
            accent={colors.orange}
          />
          <Summary
            label="Past Due"
            value={counts.past}
            icon="alert-circle-outline"
            tint="#FDECEC"
            accent={colors.red}
          />
          <Summary
            label="Classes"
            value={counts.classes}
            icon="people-outline"
            tint={colors.pale}
            accent={colors.green}
          />
        </View>
        <View style={styles.filterBox}>
          <Select
            label="Academic Year"
            value={year}
            options={academicYears}
            onChange={(value) => {
              setYear(value);
              setPage(1);
            }}
          />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search assignment, subject, class..."
          />
        </View>
        <Text style={styles.sectionTitle}>Homework List</Text>
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text>Loading homework assignments...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Pressable onPress={() => load()}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : pageItems.length ? (
          pageItems.map((item, index) => (
            <AssignmentCard
              key={item.id || `${item.title}-${index}`}
              item={item}
              index={(currentPage - 1) * pageSize + index}
              onPreview={setPreview}
              session={session}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {year === academicYears[0]
                ? "No homework assignments found."
                : "No assignments found for the selected academic year."}
            </Text>
          </View>
        )}
        <Text style={styles.pagination}>
          Showing {visible.length ? (currentPage - 1) * pageSize + 1 : 0} -{" "}
          {Math.min(currentPage * pageSize, visible.length)} of {visible.length}{" "}
          entries
        </Text>
        <View style={styles.pageControls}>
          <Text>Per page</Text>
          <Select
            label="Per page"
            value={perPage}
            options={["5", "10", "20", "50"]}
            onChange={(value) => {
              setPerPage(value);
              setPage(1);
            }}
          />
          <Pressable onPress={() => setPage((value) => Math.max(1, value - 1))}>
            <Icon name="chevron-back" color={colors.blue} />
          </Pressable>
          <Text>
            {currentPage}/{totalPages}
          </Text>
          <Pressable
            onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            <Icon name="chevron-forward" color={colors.blue} />
          </Pressable>
        </View>
      </ScrollView>
      <Preview
        item={preview}
        onClose={() => setPreview(null)}
        session={session}
      />
      <LegacyAddAssignment
        visible={formOpen}
        classes={classes.length ? classes : ["Class_1"]}
        session={session}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load(true);
          Alert.alert(
            "Assignment created",
            "The homework assignment was added successfully.",
          );
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 24, padding: 24, paddingBottom: 120 },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 13 },
  button: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { color: colors.white, fontWeight: "900", fontSize: 11 },
  secondaryText: { color: colors.blue },
  disabled: { opacity: 0.5 },
  filterBox: {
    backgroundColor: "#EAF4FF",
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 16,
  },
  field: { marginBottom: 10 },
  label: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  select: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  selectText: { color: colors.ink, fontSize: 12 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
    marginBottom: 22,
  },
  summary: {
    width: "48%",
    minHeight: 108,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 11,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: { color: colors.muted, fontSize: 10, marginTop: 8 },
  summaryValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 9,
  },
  serial: { color: colors.blue, fontWeight: "900", marginRight: 10 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row" },
  copy: { flex: 1 },
  classText: { color: colors.blue, fontWeight: "900", fontSize: 11 },
  subject: { color: colors.ink, fontWeight: "900", marginTop: 4 },
  topic: { color: colors.muted, marginTop: 3 },
  badge: {
    color: colors.ink,
    backgroundColor: "#FDECEC",
    padding: 6,
    borderRadius: 6,
    fontSize: 9,
    fontWeight: "900",
    alignSelf: "flex-start",
  },
  meta: { color: colors.muted, fontSize: 11, marginTop: 8 },
  preview: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    padding: 8,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  previewText: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  state: { alignItems: "center", padding: 35, gap: 8 },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 25,
    alignItems: "center",
  },
  emptyTitle: { color: colors.ink, fontWeight: "900", textAlign: "center" },
  retry: { color: colors.blue, marginTop: 10, fontWeight: "900" },
  pagination: { color: colors.muted, fontSize: 11, marginTop: 15 },
  pageControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 11,
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.35)",
    justifyContent: "flex-end",
  },
  options: {
    backgroundColor: colors.white,
    padding: 17,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  option: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  optionText: { color: colors.ink },
  modalScreen: { flex: 1, backgroundColor: colors.canvas },
  modalContent: { padding: 20 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 19, fontWeight: "900", color: colors.ink },
  detail: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  detailValue: { color: colors.ink, marginTop: 5 },
  modalActions: { flexDirection: "row", gap: 8 },
});
