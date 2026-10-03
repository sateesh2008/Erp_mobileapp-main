import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { homeworkApi } from "../services/homeworkApi";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  green: "#1E8E5E",
  paleGreen: "#E8F8F1",
  orange: "#A76E00",
  paleOrange: "#FFF7DF",
  red: "#B94E4E",
  blueTint: "#EEF0FC",
  blueAccent: "#334BD6",
  indigoTint: "#EAF0FB",
  indigoAccent: "#5274B8",
  orangeTint: "#FFF1DF",
  orangeAccent: "#D9822B",
  redTint: "#FDECEC",
  redAccent: "#C65353",
  purpleTint: "#F2ECFB",
  purpleAccent: "#7A5AA6",
  skyTint: "#EAF5FB",
  skyAccent: "#3284A8",
  goldTint: "#FFF6D9",
  goldAccent: "#B8861B",
  violetTint: "#F0EDF8",
  violetAccent: "#6C63A8",
};

const filters = ["All", "Active", "Overdue"];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function HomeworkCard({ assignment, studentId }) {
  const router = useRouter();
  const params = encodeURIComponent(
    JSON.stringify({
      ...assignment,
      target_student_id:
        assignment.target_student_id || assignment.student_id || studentId,
      attachment_url: assignment.attachment_url || assignment.material || null,
    }),
  );
  const isOverdue = assignment.status === "Overdue";
  const submissionState = String(assignment.submissionStatus || "")
    .trim()
    .toLowerCase();
  const isEvaluated = submissionState === "evaluated";
  const isSubmitted =
    submissionState &&
    !["pending", "pending submission", "not submitted"].includes(
      submissionState,
    );
  const statusLabel = isEvaluated ? "Evaluated" : isSubmitted ? "Submitted" : null;
  const subjectAccent = isOverdue ? colors.redAccent : colors.green;
  const marks = assignment.marks_obtained ?? assignment.marksObtained;

  return (
    <View
      style={[
        styles.card,
        { borderColor: isOverdue ? "#F4C4C4" : colors.line },
      ]}
    >
      <View
        style={[styles.cardAccent, { backgroundColor: subjectAccent }]}
      />
      <View style={styles.cardHeader}>
        <View style={styles.subjectWrap}>
          <View style={styles.subjectIcon}>
            <Icon name="book-outline" size={16} color={colors.blue} />
          </View>
          <View style={styles.subjectCopy}>
            <Text style={styles.subject} numberOfLines={1}>
              {assignment.subject}
            </Text>
            <Text style={styles.topic} numberOfLines={2}>
              {assignment.topic}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            isOverdue ? styles.overdueBadge : styles.activeBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isOverdue ? styles.overdueText : styles.activeText,
            ]}
          >
            {assignment.status}
          </Text>
        </View>
      </View>
      <View style={styles.dateRow}>
        <View style={styles.dateItem}>
          <Icon name="calendar-outline" size={13} color={colors.muted} />
          <View>
            <Text style={styles.label}>Assigned</Text>
            <Text style={styles.value}>{assignment.assignedDate || "N/A"}</Text>
          </View>
        </View>
        <View style={styles.dateItem}>
          <Icon
            name="time-outline"
            size={13}
            color={isOverdue ? colors.red : colors.green}
          />
          <View>
            <Text style={styles.label}>Due date</Text>
            <Text
              style={[styles.value, isOverdue && styles.overdueValue]}
            >
              {assignment.dueDate || "N/A"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${assignment.topic}`}
          style={styles.outlineButton}
          onPress={() => router.push(`/homework-details?assignment=${params}`)}
        >
          <Icon name="eye-outline" size={14} color={colors.blue} />
          <Text style={styles.outlineButtonText}>Details</Text>
        </Pressable>
        {assignment.material || assignment.attachment_url ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View attachment for ${assignment.topic}`}
            style={styles.fileButton}
            onPress={() =>
              router.push(`/homework-details?assignment=${params}`)
            }
          >
            <Icon name="attach-outline" size={14} color={colors.green} />
            <Text style={styles.fileButtonText}>File</Text>
          </Pressable>
        ) : null}
        <View style={styles.submissionAction}>
          {statusLabel ? (
            <View style={styles.submissionState}>
              <Text
                style={[
                  styles.submissionStateText,
                  isEvaluated ? styles.evaluatedText : styles.submittedText,
                ]}
              >
                {statusLabel}
              </Text>
              {isEvaluated && marks !== undefined ? (
                <Text style={styles.marksText}>Marks: {marks}</Text>
              ) : null}
            </View>
          ) : null}
          {!isEvaluated ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isSubmitted ? "Edit" : "Submit"} ${assignment.topic}`}
              style={styles.primaryButton}
              onPress={() =>
                router.push(`/homework-submission?assignment=${params}`)
              }
            >
              <Icon
                name={isSubmitted ? "create-outline" : "arrow-up-circle-outline"}
                size={14}
                color={colors.white}
              />
              <Text style={styles.primaryButtonText}>
                {isSubmitted ? "Edit" : "Submit"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function ParentHomeworkScreen({
  session,
  selectedStudentId,
  onSessionExpired,
}) {
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAssignments = useCallback(() => {
    setLoading(true);
    setError("");
    return homeworkApi
      .getAssignments(session, selectedStudentId)
      .then(setAssignments)
      .catch((requestError) => {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Unable to load homework. Please try again later.",
        );
        if (requestError.status === 401) onSessionExpired?.();
      })
      .finally(() => setLoading(false));
  }, [session, selectedStudentId, onSessionExpired]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void loadAssignments(), 0);
      return () => clearTimeout(timer);
    }, [loadAssignments]),
  );

  const visibleAssignments = useMemo(
    () =>
      filter === "All"
        ? assignments
        : assignments.filter((assignment) => assignment.status === filter),
    [assignments, filter],
  );
  const filterCounts = useMemo(
    () => ({
      All: assignments.length,
      Active: assignments.filter((item) => item.status === "Active").length,
      Overdue: assignments.filter((item) => item.status === "Overdue").length,
    }),
    [assignments],
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarHeading}>
          <View style={styles.toolbarIcon}>
            <Icon name="book-outline" size={17} color={colors.ink} />
          </View>
          <View style={styles.toolbarCopy}>
            <Text style={styles.toolbarTitle}>Homework & Assignments</Text>
            <Text style={styles.toolbarSubtitle}>
              {assignments.length} assignments
            </Text>
          </View>
        </View>
        <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item }}
            style={[styles.filter, filter === item && styles.filterActive]}
            onPress={() => setFilter(item)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.filterTextActive,
              ]}
            >
              {item} <Text style={filter === item ? styles.filterCountActive : styles.filterCount}>
                {filterCounts[item]}
              </Text>
            </Text>
          </Pressable>
        ))}
      </View>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading homework...</Text>
        </View>
      ) : error ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.redTint, borderColor: colors.redAccent },
          ]}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadAssignments}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : visibleAssignments.length === 0 ? (
        <View
          style={[
            styles.empty,
            {
              backgroundColor: colors.goldTint,
              borderColor: colors.goldAccent,
            },
          ]}
        >
          <Text style={styles.emptyTitle}>No homework found</Text>
          <Text style={styles.emptyText}>
            There are no records for this filter.
          </Text>
        </View>
      ) : (
        visibleAssignments.map((assignment) => (
          <HomeworkCard
            key={assignment.id}
            assignment={assignment}
            studentId={selectedStudentId}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 12 },
  toolbar: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toolbarHeading: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarIcon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarCopy: { flex: 1, minWidth: 0 },
  toolbarTitle: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  toolbarSubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 },
  filters: {
    minWidth: 210,
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 6,
    backgroundColor: colors.canvas,
  },
  filter: {
    flex: 1,
    minHeight: 34,
    paddingHorizontal: 7,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  filterActive: {
    backgroundColor: colors.navy,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  filterTextActive: { color: colors.white },
  filterCount: { color: colors.muted, fontSize: 9, fontWeight: "600" },
  filterCountActive: { color: "#C8DBF2", fontSize: 9, fontWeight: "800" },
  card: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    paddingLeft: 13,
    marginBottom: 8,
  },
  cardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  subjectWrap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  subjectIcon: {
    width: 29,
    height: 29,
    borderRadius: 6,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  subjectCopy: { flex: 1, minWidth: 0 },
  subject: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  topic: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: { fontSize: 9, fontWeight: "900" },
  activeBadge: { backgroundColor: colors.paleGreen, borderColor: "#B6E7D0" },
  activeText: { color: colors.green },
  overdueBadge: { backgroundColor: colors.paleRed, borderColor: "#F4C4C4" },
  overdueText: { color: colors.red },
  dateRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 8,
    paddingTop: 8,
  },
  dateItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  value: { color: colors.ink, fontSize: 10, fontWeight: "800", marginTop: 2 },
  overdueValue: { color: colors.red },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 8,
    paddingTop: 8,
  },
  outlineButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  outlineButtonText: { color: colors.blue, fontSize: 9, fontWeight: "900" },
  fileButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#B6E7D0",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  fileButtonText: { color: colors.green, fontSize: 9, fontWeight: "900" },
  submissionAction: {
    flex: 1,
    minWidth: 115,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  submissionState: { alignItems: "flex-end" },
  submissionStateText: { fontSize: 9, fontWeight: "900" },
  submittedText: { color: colors.blue },
  evaluatedText: { color: colors.green },
  marksText: { color: colors.green, fontSize: 9, fontWeight: "800", marginTop: 2 },
  primaryButton: {
    backgroundColor: colors.blue,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  primaryButtonText: { color: colors.white, fontSize: 9, fontWeight: "900" },
  loading: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: "#FDECEC",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  errorText: { color: colors.red, fontSize: 11, textAlign: "center" },
  retryText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
  },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 22,
    alignItems: "center",
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
