import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { leaveApi } from "../services/leaveApi";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  blueTint: "#EAF0FB",
  blueAccent: "#5274B8",
  goldTint: "#FFF6D9",
  goldAccent: "#B8861B",
  red: "#C65353",
  paleRed: "#FDECEC",
  navy: "#13137F",
  green: "#1F9D6B",
  paleGreen: "#E5F6EE",
};

const leaveCardColors = [
  [colors.paleBlue, colors.blue],
  [colors.blueTint, colors.blueAccent],
  [colors.goldTint, colors.goldAccent],
  [colors.paleRed, colors.red],
];

// Visual config per leave type (UI only; values sent to the API are unchanged)
const leaveTypeStyles = {
  "Sick Leave": { icon: "medkit-outline", tint: "#FDECEC", accent: "#C65353" },
  "Personal Leave": { icon: "person-outline", tint: "#F2ECFB", accent: "#7A5AA6" },
  Other: { icon: "ellipsis-horizontal-circle-outline", tint: "#EAF5FB", accent: "#3284A8" },
};

const statusStyle = (status) => {
  const value = String(status || "pending").toLowerCase();
  if (value.includes("approv"))
    return { icon: "checkmark-circle", bg: colors.paleGreen, color: colors.green };
  if (value.includes("reject") || value.includes("declin"))
    return { icon: "close-circle", bg: colors.paleRed, color: colors.red };
  return { icon: "time", bg: colors.goldTint, color: colors.goldAccent };
};

const shadow = (opacity = 0.1, radius = 8, y = 3) =>
  Platform.select({
    ios: {
      shadowColor: "#1B2B4B",
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: y },
    },
    android: { elevation: 3 },
    default: { boxShadow: `0px ${y}px ${radius}px rgba(27,43,75,${opacity})` },
  });

const displayDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN");
};

const dateFromInput = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const dateToInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const webDateStyle = {
  minHeight: 46,
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #C9D3F5",
  borderRadius: 12,
  padding: "0 12px",
  color: colors.ink,
  backgroundColor: colors.white,
  fontSize: 13,
};

export default function ParentLeaveScreen({
  session,
  selectedStudentId,
  selectedStudent,
  onSessionExpired,
}) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [datePickerTarget, setDatePickerTarget] = useState(null);
  const [form, setForm] = useState({
    leave_type: "Sick Leave",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLeaves(await leaveApi.getLeaves(session, selectedStudentId));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load leave requests.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedStudentId, session]);

  useEffect(() => {
    const timer = setTimeout(() => void loadLeaves(), 0);
    return () => clearTimeout(timer);
  }, [loadLeaves]);

  const handleDateChange = (event, date) => {
    const target = datePickerTarget;
    setDatePickerTarget(null);
    if (event.type === "dismissed" || !date || !target) return;
    setForm((current) => ({ ...current, [target]: dateToInput(date) }));
  };

  const startDate = dateFromInput(form.start_date);
  const endDate = dateFromInput(form.end_date);

  const submitLeave = async () => {
    if (
      !selectedStudentId ||
      !form.start_date ||
      !form.end_date ||
      !form.reason.trim()
    ) {
      Alert.alert(
        "Missing details",
        selectedStudentId
          ? "Enter the dates and reason before applying."
          : "Select a child before applying for leave.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await leaveApi.applyLeave(session, {
        student_id: selectedStudentId,
        ...form,
        reason: form.reason.trim(),
      });
      setForm({
        leave_type: "Sick Leave",
        start_date: "",
        end_date: "",
        reason: "",
      });
      Alert.alert("Leave applied", "Your leave request has been submitted.");
      void loadLeaves();
    } catch (requestError) {
      Alert.alert(
        "Unable to apply leave",
        requestError instanceof ApiError
          ? requestError.message
          : "Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const studentName = selectedStudent?.name || "Selected child";
  const studentClass =
    [
      selectedStudent?.className || selectedStudent?.class_name,
      selectedStudent?.section,
    ]
      .filter(Boolean)
      .join(" · ") || "";

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="create" size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Student leave</Text>
          <Text style={styles.subtitle}>
            Apply for and track your child&apos;s leave
          </Text>
        </View>
        {!loading && !error ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{leaves.length}</Text>
            <Text style={styles.countLabel}>TOTAL</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.studentCallout}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>
              {studentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentCalloutCopy}>
            <Text style={styles.studentCalloutLabel}>Applying on behalf of</Text>
            <Text style={styles.studentCalloutName} numberOfLines={1}>
              {studentName}
            </Text>
            <Text style={styles.studentCalloutClass} numberOfLines={1}>
              {studentClass}
            </Text>
          </View>
        </View>

        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleBar} />
          <Text style={styles.cardTitle}>Apply for leave</Text>
        </View>

        <Text style={styles.label}>Leave type</Text>
        <View style={styles.typeRow}>
          {["Sick Leave", "Personal Leave", "Other"].map((type) => {
            const active = form.leave_type === type;
            const look = leaveTypeStyles[type];
            return (
              <Pressable
                key={type}
                style={[
                  styles.type,
                  { backgroundColor: look.tint, borderColor: look.accent },
                  active && { backgroundColor: look.accent },
                ]}
                onPress={() => setForm({ ...form, leave_type: type })}
              >
                <Ionicons
                  name={look.icon}
                  size={18}
                  color={active ? colors.white : look.accent}
                />
                <Text
                  style={[
                    styles.typeText,
                    { color: look.accent },
                    active && styles.typeTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
        {Platform.OS === "web" ? (
          <input
            type="date"
            aria-label="Leave start date"
            value={form.start_date}
            max={form.end_date || undefined}
            onChange={(event) =>
              setForm({ ...form, start_date: event.target.value })
            }
            style={webDateStyle}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select leave start date"
            style={styles.dateButton}
            onPress={() => setDatePickerTarget("start_date")}
          >
            <Text
              style={form.start_date ? styles.dateValue : styles.datePlaceholder}
            >
              {form.start_date || "Select start date"}
            </Text>
            <View style={styles.dateIcon}>
              <Ionicons name="calendar" size={16} color={colors.blue} />
            </View>
          </Pressable>
        )}
        {datePickerTarget === "start_date" ? (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "compact" : "default"}
            maximumDate={endDate || undefined}
            onChange={handleDateChange}
          />
        ) : null}

        <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
        {Platform.OS === "web" ? (
          <input
            type="date"
            aria-label="Leave end date"
            value={form.end_date}
            min={form.start_date || undefined}
            onChange={(event) =>
              setForm({ ...form, end_date: event.target.value })
            }
            style={webDateStyle}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select leave end date"
            style={styles.dateButton}
            onPress={() => setDatePickerTarget("end_date")}
          >
            <Text
              style={form.end_date ? styles.dateValue : styles.datePlaceholder}
            >
              {form.end_date || "Select end date"}
            </Text>
            <View style={styles.dateIcon}>
              <Ionicons name="calendar" size={16} color={colors.blue} />
            </View>
          </Pressable>
        )}
        {datePickerTarget === "end_date" ? (
          <DateTimePicker
            value={endDate || startDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "compact" : "default"}
            minimumDate={startDate || undefined}
            onChange={handleDateChange}
          />
        ) : null}

        <Text style={styles.label}>Reason</Text>
        <TextInput
          value={form.reason}
          onChangeText={(value) => setForm({ ...form, reason: value })}
          placeholder="Explain the reason for leave"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.reason]}
        />

        <Pressable
          style={[styles.button, submitting && styles.disabled]}
          disabled={submitting || !selectedStudentId}
          onPress={submitLeave}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={16} color={colors.white} />
              <Text style={styles.buttonText}>Submit application</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.sectionRow}>
        <View style={styles.cardTitleBar} />
        <Text style={styles.sectionTitle}>
          Your child&apos;s previous requests
        </Text>
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.stateText}>Loading leave requests...</Text>
        </View>
      ) : error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadLeaves}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      ) : leaves.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={28} color={colors.blue} />
          </View>
          <Text style={styles.emptyTitle}>No leave requests</Text>
          <Text style={styles.emptyText}>
            Submitted requests will appear here.
          </Text>
        </View>
      ) : (
        leaves.map((leave, index) => {
          const [rowBackground, rowAccent] =
            leaveCardColors[(index + 1) % leaveCardColors.length];
          const status = statusStyle(leave.status);
          return (
            <View
              key={leave.id || index}
              style={[
                styles.leaveRow,
                { borderColor: rowAccent, borderLeftColor: rowAccent },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={[styles.leaveTypePill, { backgroundColor: rowBackground }]}>
                  <Text style={[styles.leaveType, { color: rowAccent }]}>
                    {leave.leave_type || leave.type || "Leave request"}
                  </Text>
                </View>
                <View style={styles.leaveDateRow}>
                  <Ionicons name="calendar-outline" size={14} color={rowAccent} />
                  <Text style={styles.leaveDate}>
                    {displayDate(leave.start_date || leave.from_date)} -{" "}
                    {displayDate(leave.end_date || leave.to_date)}
                  </Text>
                </View>
                <Text style={styles.leaveReason}>
                  {leave.reason || "No reason provided"}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={13} color={status.color} />
                <Text style={[styles.status, { color: status.color }]}>
                  {leave.status || "Pending"}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 10 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 20,
    padding: 14,
    marginBottom: 16,
    ...shadow(0.12, 10, 4),
  },
  headingIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  countBadge: {
    backgroundColor: colors.paleBlue,
    borderWidth: 1.5,
    borderColor: colors.blue,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: "center",
    minWidth: 48,
  },
  countText: { color: colors.blue, fontSize: 17, fontWeight: "900" },
  countLabel: { color: colors.blue, fontSize: 8, fontWeight: "900" },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...shadow(0.12, 12, 4),
  },
  studentCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: "#3E8BEA",
    borderRadius: 16,
    padding: 11,
    marginBottom: 16,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#3E8BEA",
    borderWidth: 2,
    borderColor: "#FFD27A",
    alignItems: "center",
    justifyContent: "center",
  },
  studentAvatarText: { color: colors.white, fontSize: 18, fontWeight: "900" },
  studentCalloutCopy: { flex: 1, minWidth: 0 },
  studentCalloutLabel: {
    color: "#A9C6E8",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  studentCalloutName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  studentCalloutClass: { color: "#C8DBF2", fontSize: 11, marginTop: 2 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  cardTitleBar: {
    width: 5,
    height: 18,
    borderRadius: 3,
    backgroundColor: "#3E8BEA",
    marginRight: 8,
  },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  label: {
    color: colors.blueAccent,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 7,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  type: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 5,
  },
  typeText: { fontSize: 10, fontWeight: "900" },
  typeTextActive: { color: colors.white },
  input: {
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 12,
    backgroundColor: "#FAFCFF",
    minHeight: 46,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 13,
  },
  dateButton: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFCFF",
  },
  dateIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  dateValue: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  datePlaceholder: { color: colors.muted, fontSize: 13 },
  reason: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    ...shadow(0.3, 10, 4),
  },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", flexShrink: 1 },
  leaveRow: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderLeftWidth: 6,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    gap: 10,
    ...shadow(),
  },
  leaveTypePill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  leaveType: { fontSize: 12, fontWeight: "900" },
  leaveDateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9 },
  leaveDate: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  leaveReason: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  status: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  state: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { color: colors.muted, fontSize: 11 },
  error: {
    backgroundColor: colors.paleRed,
    borderWidth: 1.5,
    borderColor: colors.red,
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    gap: 6,
  },
  errorText: { color: colors.red, fontSize: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  retry: { color: colors.white, fontSize: 12, fontWeight: "900" },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 20,
    padding: 26,
    alignItems: "center",
    ...shadow(),
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 11 },
  emptyText: { color: colors.muted, fontSize: 12, marginTop: 5 },
});