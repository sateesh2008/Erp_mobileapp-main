import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  red: "#C65353",
};
const subjects = ["English", "Telugu", "Math", "Hindi", "Science", "Social"];
const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const displayDate = (date) =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
const initialForm = (session) => ({
  classIds: [],
  subject: "",
  title: "",
  homeworkDate: new Date(),
  dueDate: null,
  description: "",
  academicYear: session?.academicYear || "",
  attachment: null,
});

function Icon({ name, size = 19, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Select({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]}>
          {value || "Select an option"}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.options} onStartShouldSetResponder={() => true}>
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
                <Text
                  style={[
                    styles.optionText,
                    option === value && styles.activeOption,
                  ]}
                >
                  {option}
                </Text>
                {option === value ? (
                  <Icon name="checkmark" size={18} color={colors.blue} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function TeacherAddAssignmentModal({
  visible,
  classes,
  session,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => initialForm(session));
  const [dateField, setDateField] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const yearOptions = useMemo(() => {
    const values = [session?.academicYear].filter(Boolean);
    return [...new Set(values)];
  }, [session?.academicYear]);
  const classOptions = useMemo(
    () =>
      (Array.isArray(classes) ? classes : []).map((item) =>
        typeof item === "string"
          ? {
              id: item,
              label: item,
              className: item.split("-")[0],
              section: item.split("-")[1] || "A",
            }
          : item,
      ),
    [classes],
  );
  const set = (field, value) => {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  };
  const toggleClass = (classId) =>
    set(
      "classIds",
      form.classIds.includes(classId)
        ? form.classIds.filter((id) => id !== classId)
        : [...form.classIds, classId],
    );
  const close = () => {
    if (!saving) {
      setForm(initialForm(session));
      setError("");
      onClose();
    }
  };
  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      if (file.size && file.size > 10 * 1024 * 1024) {
        setError("File size must not exceed 10MB.");
        return;
      }
      set("attachment", file);
    } catch {
      setError("Unable to select the attachment. Please try again.");
    }
  };
  const submit = async () => {
    const trimmedTitle = form.title.trim();
    if (!form.classIds.length)
      return setError("Please select at least one class.");
    if (!form.subject) return setError("Please select a subject.");
    if (!trimmedTitle) return setError("Assignment title is required.");
    if (!form.dueDate) return setError("Due date is required.");
    if (form.dueDate < form.homeworkDate)
      return setError("Due date cannot be earlier than the homework date.");
    setSaving(true);
    setError("");
    try {
      await teacherApi.createHomework(
        {
          assignedClassIds: form.classIds,
          assignedClasses: form.classIds
            .map((id) => classOptions.find((item) => item.id === id))
            .filter(Boolean),
          subject: form.subject,
          title: trimmedTitle,
          homeworkDate: dateKey(form.homeworkDate),
          assignedDate: dateKey(form.homeworkDate),
          dueDate: dateKey(form.dueDate),
          description: form.description.trim(),
          academicYear: form.academicYear,
          attachment: form.attachment
            ? {
                name: form.attachment.name,
                uri: form.attachment.uri,
                mimeType: form.attachment.mimeType,
                size: form.attachment.size,
              }
            : null,
        },
        session,
      );
      setForm(initialForm());
      onSaved();
    } catch {
      setError("Unable to create assignment. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add Assignment</Text>
              <Text style={styles.subtitle}>New Assignment Details</Text>
              <Text style={styles.description}>
                Fill in the details to assign homework to multiple classes at
                once.
              </Text>
            </View>
            <Pressable onPress={close}>
              <Icon name="close" size={23} />
            </Pressable>
          </View>
          <Text style={styles.sectionTitle}>Select Assigned Classes</Text>
          <Text style={styles.requiredHint}>Select one or more classes *</Text>
          <View style={styles.classList}>
            {classOptions.map((item) => {
              const selected = form.classIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.classOption,
                    selected && styles.classOptionSelected,
                  ]}
                  onPress={() => toggleClass(item.id)}
                >
                  <Icon
                    name={selected ? "checkbox" : "square-outline"}
                    color={selected ? colors.blue : colors.muted}
                  />
                  <Text
                    style={[styles.classText, selected && styles.activeOption]}
                  >
                    {item.label || `${item.className}-${item.section}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Select
            label="Subject *"
            value={form.subject}
            options={subjects}
            onChange={(value) => set("subject", value)}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Assignment Title *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(value) => set("title", value)}
              placeholder="e.g. Euclidean Algorithms & Proofs"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Homework Date *</Text>
            <Pressable
              style={styles.select}
              onPress={() => setDateField("homeworkDate")}
            >
              <Text style={styles.selectText}>
                {displayDate(form.homeworkDate)}
              </Text>
              <Icon name="calendar-outline" color={colors.blue} />
            </Pressable>
            {dateField === "homeworkDate" ? (
              <DateTimePicker
                value={form.homeworkDate}
                mode="date"
                onChange={(_, value) => {
                  setDateField("");
                  if (value) set("homeworkDate", value);
                }}
              />
            ) : null}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Due Date *</Text>
            <Pressable
              style={styles.select}
              onPress={() => setDateField("dueDate")}
            >
              <Text
                style={[styles.selectText, !form.dueDate && styles.placeholder]}
              >
                {form.dueDate ? displayDate(form.dueDate) : "dd-mm-yyyy"}
              </Text>
              <Icon name="calendar-outline" color={colors.blue} />
            </Pressable>
            {dateField === "dueDate" ? (
              <DateTimePicker
                value={form.dueDate || form.homeworkDate}
                mode="date"
                onChange={(_, value) => {
                  setDateField("");
                  if (value) set("dueDate", value);
                }}
              />
            ) : null}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.description}
              onChangeText={(value) => set("description", value)}
              placeholder="Enter details for this assignment..."
              placeholderTextColor={colors.muted}
              multiline
            />
          </View>
          <Select
            label="Academic Year *"
            value={form.academicYear}
            options={yearOptions}
            onChange={(value) => set("academicYear", value)}
          />
          <View style={styles.field}>
            <Text style={styles.label}>Attach File</Text>
            <Text style={styles.fileHint}>(Max 10MB)</Text>
            <Pressable style={styles.attachButton} onPress={pickAttachment}>
              <Icon name="attach-outline" size={18} color={colors.blue} />
              <Text style={styles.attachText}>
                {form.attachment?.name || "Choose a file"}
              </Text>
            </Pressable>
            {form.attachment ? (
              <Pressable onPress={() => set("attachment", null)}>
                <Text style={styles.removeText}>Remove attachment</Text>
              </Pressable>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={close}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, saving && styles.disabled]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <ActivityIndicator color={colors.white} />
                  <Text style={styles.saveText}>Saving...</Text>
                </>
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 45 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 21,
  },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  subtitle: {
    color: colors.blue,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 10,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 300,
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  requiredHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 9,
  },
  classList: { gap: 8, marginBottom: 16 },
  classOption: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
  },
  classOptionSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.paleBlue,
  },
  classText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  activeOption: { color: colors.blue, fontWeight: "900" },
  field: { marginBottom: 14 },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
  },
  select: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  selectText: { color: colors.ink, fontSize: 13, flex: 1 },
  placeholder: { color: colors.muted },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 13,
  },
  textarea: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  fileHint: {
    color: colors.muted,
    fontSize: 10,
    marginTop: -3,
    marginBottom: 7,
  },
  attachButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  attachText: { color: colors.blue, fontSize: 12, flex: 1 },
  removeText: {
    color: colors.red,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },
  error: {
    color: colors.red,
    backgroundColor: "#FDECEC",
    borderRadius: 8,
    padding: 11,
    fontSize: 12,
    marginBottom: 12,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 7 },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  cancelText: { color: colors.blue, fontWeight: "900" },
  saveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.blue,
  },
  saveText: { color: colors.white, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,31,.35)",
    justifyContent: "flex-end",
  },
  options: {
    backgroundColor: colors.white,
    padding: 17,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "75%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  option: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionText: { color: colors.ink, fontSize: 13 },
});
