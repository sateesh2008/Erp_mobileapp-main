import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
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
  green: "#334BD6",
  orange: "#D9822B",
  red: "#C65353",
};

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function HomeworkSelect({ assignments, value, onChange }) {
  const [open, setOpen] = useState(false);
  const label = value
    ? `${value.subject || "Subject"} - ${value.title || value.topic || "Untitled"} (${value.className || value.class || "Class"}-${value.section || "A"})`
    : "Select Homework";
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Select Homework...</Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text
          style={[styles.selectText, !value && styles.placeholder]}
          numberOfLines={2}
        >
          {label}
        </Text>
        <Icon name="chevron-down" size={17} color={colors.muted} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.options} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Select Homework</Text>
            {assignments.map((assignment) => (
              <Pressable
                key={assignment.id}
                style={styles.option}
                onPress={() => {
                  onChange(assignment);
                  setOpen(false);
                }}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>
                    {assignment.title ||
                      assignment.topic ||
                      "Untitled assignment"}
                  </Text>
                  <Text style={styles.optionMeta}>
                    {assignment.subject} |{" "}
                    {assignment.className || assignment.class}-
                    {assignment.section || "A"} | Due{" "}
                    {assignment.dueDate || "N/A"}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SubmissionCard({ submission, onEvaluate }) {
  const status =
    submission.evaluationStatus ||
    submission.submissionStatus ||
    "Not Submitted";
  const canEvaluate = [
    "Submitted",
    "Pending Evaluation",
    "Late Submission",
  ].includes(status);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {submission.studentName?.charAt(0) || "?"}
          </Text>
        </View>
        <View style={styles.studentCopy}>
          <Text style={styles.studentName}>{submission.studentName}</Text>
          <Text style={styles.studentMeta}>
            {submission.className}-{submission.section} | Roll:{" "}
            {submission.rollNumber || submission.admissionNumber || "N/A"}
          </Text>
        </View>
        <Text
          style={[
            styles.badge,
            status === "Evaluated" && styles.evaluatedBadge,
            status === "Submitted" && styles.submittedBadge,
          ]}
        >
          {status}
        </Text>
      </View>
      <View style={styles.detailGrid}>
        <Text style={styles.detail}>
          Submitted: {submission.submittedDate || "Not submitted"}
        </Text>
        <Text style={styles.detail}>
          Score:{" "}
          {submission.score == null
            ? "Not graded"
            : `${submission.score}/${submission.maxMarks || 100}`}
        </Text>
      </View>
      {canEvaluate ? (
        <Pressable
          style={styles.evaluateButton}
          onPress={() => onEvaluate(submission)}
        >
          <Icon name="create-outline" size={16} color={colors.white} />
          <Text style={styles.evaluateText}>Evaluate</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EvaluationModal({ submission, homework, session, onClose, onSaved }) {
  const [marks, setMarks] = useState(
    submission?.score == null ? "" : String(submission.score),
  );
  const [remarks, setRemarks] = useState(submission?.remarks || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMarks(submission?.score == null ? "" : String(submission.score));
    setRemarks(submission?.remarks || "");
  }, [submission]);
  if (!submission) return null;
  const maxMarks = Number(submission.maxMarks || homework?.maxMarks || 100);
  const save = async () => {
    const score = Number(marks);
    if (
      !marks.trim() ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > maxMarks
    ) {
      Alert.alert("Invalid marks", `Enter a number between 0 and ${maxMarks}.`);
      return;
    }
    setSaving(true);
    try {
      await teacherApi.saveHomeworkEvaluation(
        homework.id,
        submission.id,
        { score, maxMarks, remarks: remarks.trim() },
        session,
      );
      onSaved();
    } catch {
      Alert.alert("Unable to save evaluation", "Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={styles.modalScreen}
        contentContainerStyle={styles.modalContent}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Evaluate Submission</Text>
          <Pressable onPress={onClose}>
            <Icon name="close" size={23} />
          </Pressable>
        </View>
        <Text style={styles.detailHeading}>{submission.studentName}</Text>
        <Text style={styles.modalMeta}>
          {homework?.title || homework?.topic} | {homework?.subject}
        </Text>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Submission Details</Text>
          <Text style={styles.detailValue}>
            {submission.submissionDetails || "Student submission received."}
          </Text>
          <Text style={styles.detailValue}>
            Submitted: {submission.submittedDate || "N/A"}
          </Text>
          {submission.attachmentName ? (
            <Text style={styles.detailValue}>
              File: {submission.attachmentName}
            </Text>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Marks / Score (max {maxMarks})</Text>
          <TextInput
            value={marks}
            onChangeText={(value) => setMarks(value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder={`0-${maxMarks}`}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Teacher Remarks / Feedback</Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Optional feedback"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.textarea]}
            multiline
          />
        </View>
        <Pressable
          disabled={saving}
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={save}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Icon name="checkmark" size={17} color={colors.white} />
              <Text style={styles.saveText}>Save Evaluation</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

export default function TeacherHomeworkEvaluationScreen({ session }) {
  const [assignments, setAssignments] = useState([]);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loadingHomework, setLoadingHomework] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loadHomework = async () => {
    setLoadingHomework(true);
    setError("");
    try {
      setAssignments(await teacherApi.getHomework(session));
    } catch {
      setError("Unable to load homework assignments. Please try again.");
    } finally {
      setLoadingHomework(false);
    }
  };
  const loadSubmissions = async (homework, refresh = false) => {
    if (!homework) return;
    refresh ? setRefreshing(true) : setLoadingSubmissions(true);
    setError("");
    try {
      setSubmissions(
        await teacherApi.getHomeworkSubmissions(homework.id, session),
      );
    } catch {
      setError("Unable to load student submissions. Please try again.");
    } finally {
      setLoadingSubmissions(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    loadHomework();
  }, [session]);
  const selectHomework = (homework) => {
    setSelectedHomework(homework);
    setSubmissions([]);
    loadSubmissions(homework);
  };
  const saveComplete = async () => {
    setSelectedSubmission(null);
    await loadSubmissions(selectedHomework, true);
    Alert.alert(
      "Evaluation saved",
      "The student evaluation was updated successfully.",
    );
  };
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              selectedHomework
                ? loadSubmissions(selectedHomework, true)
                : loadHomework()
            }
            tintColor={colors.blue}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Evaluate Homework</Text>
          <Text style={styles.count}>
            {selectedHomework ? `${submissions.length} STUDENTS` : "0 STUDENTS"}
          </Text>
        </View>
        {loadingHomework ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.stateText}>Loading homework...</Text>
          </View>
        ) : error && !selectedHomework ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={loadHomework}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <HomeworkSelect
            assignments={assignments}
            value={selectedHomework}
            onChange={selectHomework}
          />
        )}
        {error && selectedHomework ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadSubmissions(selectedHomework)}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!selectedHomework ? (
          <Text style={styles.instruction}>
            Select a homework from the dropdown above to view and evaluate
            student submissions.
          </Text>
        ) : loadingSubmissions ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.stateText}>Loading student submissions...</Text>
          </View>
        ) : submissions.length ? (
          submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onEvaluate={setSelectedSubmission}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Icon name="people-outline" size={30} color={colors.blue} />
            <Text style={styles.emptyTitle}>
              No student submissions found for this homework.
            </Text>
          </View>
        )}
      </ScrollView>
      <EvaluationModal
        submission={selectedSubmission}
        homework={selectedHomework}
        session={session}
        onClose={() => setSelectedSubmission(null)}
        onSaved={saveComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 120 },
  header: { marginBottom: 18 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  count: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 5,
  },
  field: { marginBottom: 15 },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 7,
  },
  select: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  selectText: { color: colors.ink, fontSize: 13, flex: 1 },
  placeholder: { color: colors.muted },
  instruction: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 38,
  },
  state: { alignItems: "center", gap: 9, padding: 38 },
  stateText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: "#FDECEC",
    borderRadius: 9,
    padding: 14,
    alignItems: "center",
    marginBottom: 13,
  },
  errorText: { color: colors.red, fontSize: 12, textAlign: "center" },
  retry: { color: colors.blue, fontWeight: "900", marginTop: 9 },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: "center",
    padding: 27,
    marginTop: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.blue, fontSize: 17, fontWeight: "900" },
  studentCopy: { flex: 1, marginLeft: 10 },
  studentName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  studentMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  badge: {
    color: colors.ink,
    backgroundColor: "#FFF1DF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: "900",
  },
  submittedBadge: { backgroundColor: colors.paleBlue },
  evaluatedBadge: { backgroundColor: colors.paleTeal },
  detailGrid: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 12,
    paddingTop: 10,
    gap: 5,
  },
  detail: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    padding: 13,
    marginBottom: 15,
  },
  detailHeading: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  modalMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 5,
    marginBottom: 16,
  },
  detailLabel: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  detailValue: { color: colors.muted, fontSize: 12, marginTop: 7 },
  evaluateButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.blue,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
  },
  evaluateText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  modalScreen: { flex: 1, backgroundColor: colors.canvas },
  modalContent: { padding: 20, paddingBottom: 45 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
    color: colors.ink,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textarea: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  saveButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 17,
    maxHeight: "75%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  optionMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
});
