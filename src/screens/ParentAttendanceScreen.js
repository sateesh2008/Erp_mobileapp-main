import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { attendanceApi } from "../services/attendanceApi";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  orange: "#A76E00",
  paleBlue: "#EEF0FC",
  green: "#1E8E5E",
  paleGreen: "#E8F8F1",
  red: "#B94E4E",
  paleRed: "#FDECEC",
  paleOrange: "#FFF7DF",
  attendanceRateTint: "#EEF0FC",
  attendanceRateAccent: "#334BD6",
  daysPresentTint: "#E5F6EE",
  daysPresentAccent: "#1F9D6B",
  daysAbsentTint: "#FFF1DF",
  daysAbsentAccent: "#D9822B",
  lateEntriesTint: "#FDECEC",
  lateEntriesAccent: "#C65353",
  purple: "#7A5AA6",
  palePurple: "#F2ECFB",
  border: "#C9D3F5",
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

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({ label, value: index + 1 }));

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, index) => {
  const value = currentYear - 2 + index;
  return { label: String(value), value };
});

const getAttendanceDate = (value) => {
  const dateValue = String(value || "").split("T")[0];
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const filterAttendanceByMonth = (records, month, year) =>
  records.filter((record) => {
    const dateParts = getAttendanceDate(record.date);
    return dateParts?.month === month && dateParts?.year === year;
  });

const messageForError = (error) =>
  error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again later.";

function Loading({ label = "Loading..." }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.blue} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function EmptyState({ message = "No records found matching your criteria" }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar-clear-outline" size={28} color={colors.blue} />
      </View>
      <Text style={styles.emptyTitle}>No data available</Text>
      <Text style={styles.emptySubtitle}>{message}</Text>
    </View>
  );
}

function MetricCard({
  title,
  value,
  icon,
  backgroundColor,
  accentColor,
  cardWidth,
}) {
  return (
    <View
      style={[
        styles.metricCard,
        { width: cardWidth, borderColor: accentColor, backgroundColor },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: accentColor }]}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={[styles.metricValue, { color: accentColor }]}>
          {value ?? 0}
        </Text>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
    </View>
  );
}

function PeriodSelector({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${label}`}
        onPress={() => setOpen(true)}
        style={styles.selectorButton}
      >
        <Text style={styles.selectorValue}>{selectedOption?.label}</Text>
        <Ionicons name="chevron-down" size={17} color={colors.blue} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.selectorBackdrop}
          onPress={() => setOpen(false)}
        >
          <View style={styles.selectorMenu}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[
                  styles.selectorOption,
                  option.value === value && styles.selectorOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.selectorOptionText,
                    option.value === value && styles.selectorOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {option.value === value ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.blue} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function AttendanceLog({ record, cardWidth }) {
  const status = record.status || "Unmarked";
  const statusAppearance =
    status === "Present"
      ? {
          accent: colors.green,
          tint: colors.paleGreen,
          border: "#B6E7D0",
          icon: "checkmark-circle",
        }
      : status === "Absent"
        ? {
            accent: colors.red,
            tint: colors.paleRed,
            border: "#F4C4C4",
            icon: "close-circle",
          }
        : ["Late", "Half Day"].includes(status)
          ? {
              accent: colors.orange,
              tint: colors.paleOrange,
              border: "#F5D98B",
              icon: "time",
            }
          : {
              accent: colors.muted,
              tint: colors.paleBlue,
              border: colors.line,
              icon: "help-circle",
            };
  const dateParts = getAttendanceDate(record.date);
  const date = dateParts
    ? new Date(dateParts.year, dateParts.month - 1, dateParts.day)
    : null;
  const remarks = record.remarks || record.remark || record.notes;

  return (
    <View
      style={[
        styles.logCard,
        { width: cardWidth, borderColor: statusAppearance.border },
      ]}
    >
      <View
        style={[styles.logAccent, { backgroundColor: statusAppearance.accent }]}
      />
      <View
        style={[styles.dateTile, { backgroundColor: statusAppearance.accent }]}
      >
        <Text style={styles.dateDay}>{date ? date.getDate() : "--"}</Text>
        <Text style={styles.dateMonth}>
          {date ? date.toLocaleDateString("en-IN", { month: "short" }) : ""}
        </Text>
      </View>
      <View style={styles.logDetails}>
        <View style={styles.logStatusRow}>
          <Text style={styles.logDay}>
            {date
              ? date.toLocaleDateString("en-US", { weekday: "short" })
              : "Date unavailable"}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusAppearance.tint,
                borderColor: statusAppearance.border,
              },
            ]}
          >
            <Ionicons
              name={statusAppearance.icon}
              size={12}
              color={statusAppearance.accent}
            />
            <Text style={[styles.statusText, { color: statusAppearance.accent }]}>
              {status}
            </Text>
          </View>
        </View>
        {remarks ? (
          <View style={styles.logNote}>
            <Ionicons
              name="information-circle-outline"
              size={12}
              color={colors.muted}
            />
            <Text style={styles.logNoteText} numberOfLines={1}>
              {remarks}
            </Text>
          </View>
        ) : record.biometricPunch ? (
          <Text style={styles.biometricText} numberOfLines={1}>
            Biometric punch at {record.biometricPunch}
          </Text>
        ) : null}
        {remarks && record.biometricPunch ? (
          <Text style={styles.biometricText} numberOfLines={1}>
            Biometric punch at {record.biometricPunch}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ParentAttendanceScreen({
  session,
  selectedStudentId,
  onSessionExpired,
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const metricCardWidth = viewportWidth >= 900 ? "23.5%" : "48.5%";
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loadedKey, setLoadedKey] = useState("");
  const requestId = useRef(0);
  const filtersKey = `${selectedStudentId}:${selectedYear}:${selectedMonth}`;

  const loadDaily = useCallback(async () => {
    const requestKey = `${selectedStudentId}:${selectedYear}:${selectedMonth}`;
    const requestNumber = ++requestId.current;
    setLoading(true);
    setError("");
    setMonthlyRecords([]);
    setSummary({});
    setLoadedKey("");
    if (!selectedStudentId) {
      setLoadedKey(requestKey);
      setLoading(false);
      return;
    }

    try {
      const { summary: nextSummary, records: nextMonthlyRecords } =
        await attendanceApi.getMonthlyData(
          selectedMonth,
          session,
          selectedStudentId,
          selectedYear,
        );
      if (requestNumber !== requestId.current) return;
      const filteredRecords = filterAttendanceByMonth(
        Array.isArray(nextMonthlyRecords) ? nextMonthlyRecords : [],
        selectedMonth,
        selectedYear,
      ).sort((left, right) => {
        const leftDate = getAttendanceDate(left.date);
        const rightDate = getAttendanceDate(right.date);
        if (!leftDate || !rightDate) return 0;
        return (
          Date.UTC(leftDate.year, leftDate.month - 1, leftDate.day) -
          Date.UTC(rightDate.year, rightDate.month - 1, rightDate.day)
        );
      });
      setSummary(nextSummary);
      setMonthlyRecords(filteredRecords);
      setLoadedKey(requestKey);
    } catch (requestError) {
      if (requestNumber === requestId.current) {
        setSummary({});
        setMonthlyRecords([]);
        setError(messageForError(requestError));
        setLoadedKey(requestKey);
        if (requestError.status === 401) onSessionExpired?.();
      }
    } finally {
      if (requestNumber === requestId.current) {
        setLoading(false);
      }
    }
  }, [
    onSessionExpired,
    selectedMonth,
    selectedStudentId,
    selectedYear,
    session,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => void loadDaily(), 0);
    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadDaily]);

  const selectedMonthLabel =
    monthOptions.find((option) => option.value === selectedMonth)?.label || "";
  const resultIsCurrent = loadedKey === filtersKey;
  const displayedSummary = resultIsCurrent ? summary : {};
  const displayedRecords = resultIsCurrent ? monthlyRecords : [];
  const displayedError = resultIsCurrent ? error : "";
  const isLoading = Boolean(selectedStudentId) && (loading || !resultIsCurrent);
  const attendanceRate = Math.round(
    Number(displayedSummary.attendanceRate) || 0,
  );
  const logCardWidth =
    viewportWidth >= 1200
      ? "23.5%"
      : viewportWidth >= 900
        ? "31.5%"
        : viewportWidth >= 600
          ? "48.5%"
          : "100%";

  return (
    <View style={styles.container}>
      <View style={styles.summaryGrid}>
        <MetricCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          icon="clipboard"
          backgroundColor={colors.attendanceRateTint}
          accentColor={colors.attendanceRateAccent}
          cardWidth={metricCardWidth}
        />
        <MetricCard
          title="Days Present"
          value={displayedSummary.daysPresent ?? 0}
          icon="checkmark-circle"
          backgroundColor={colors.daysPresentTint}
          accentColor={colors.daysPresentAccent}
          cardWidth={metricCardWidth}
        />
        <MetricCard
          title="Days Absent"
          value={displayedSummary.daysAbsent ?? 0}
          icon="close-circle"
          backgroundColor={colors.daysAbsentTint}
          accentColor={colors.daysAbsentAccent}
          cardWidth={metricCardWidth}
        />
        <MetricCard
          title="Late Entries"
          value={displayedSummary.lateEntries ?? 0}
          icon="time"
          backgroundColor={colors.lateEntriesTint}
          accentColor={colors.lateEntriesAccent}
          cardWidth={metricCardWidth}
        />
      </View>
      <View style={styles.contentCard}>
        <View style={styles.contentHeader}>
          <View style={styles.contentHeading}>
            <View style={styles.contentIcon}>
              <Ionicons name="calendar" size={20} color={colors.white} />
            </View>
            <View style={styles.contentHeadingCopy}>
              <Text style={styles.contentTitle}>Monthly Attendance Record</Text>
              <Text style={styles.contentSubtitle}>
                {selectedMonthLabel} {selectedYear} · Day-by-day logs
              </Text>
            </View>
          </View>
          <View style={styles.selectorRow}>
            <PeriodSelector
              label="Month"
              value={selectedMonth}
              options={monthOptions}
              onChange={setSelectedMonth}
            />
            <PeriodSelector
              label="Academic Year"
              value={selectedYear}
              options={yearOptions}
              onChange={setSelectedYear}
            />
          </View>
        </View>
        {displayedError ? (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.red} />
            <Text style={styles.errorText}>{displayedError}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadDaily()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.logsGrid}>
          {isLoading ? (
            <View style={styles.fullSpan}>
              <Loading label="Loading attendance..." />
            </View>
          ) : displayedRecords.length === 0 ? (
            <View style={styles.fullSpan}>
              <EmptyState message="No attendance logs found for this period." />
            </View>
          ) : (
            displayedRecords.map((record, index) => (
              <AttendanceLog
                key={record.id || `${record.date}-${index}`}
                record={record}
                cardWidth={logCardWidth}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 8 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderTopWidth: 5,
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 10,
    ...shadow(),
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricCopy: { flex: 1, minWidth: 0 },
  metricValue: { fontSize: 22, fontWeight: "900", lineHeight: 26 },
  metricTitle: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  contentCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: "hidden",
    ...shadow(0.12, 12, 4),
  },
  contentHeader: {
    backgroundColor: colors.paleBlue,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  contentHeading: {
    flex: 1,
    minWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  contentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  contentHeadingCopy: { flex: 1, minWidth: 0 },
  contentTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  contentSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  selectorRow: { flexDirection: "row", flex: 1, minWidth: 220, gap: 10 },
  selectorWrap: { flex: 1, minWidth: 104 },
  selectorLabel: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  selectorButton: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorValue: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  selectorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(19, 19, 127, 0.4)",
    justifyContent: "center",
    padding: 24,
  },
  selectorMenu: {
    maxHeight: "80%",
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 8,
    ...shadow(0.25, 16, 8),
  },
  selectorOption: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  selectorOptionActive: { backgroundColor: colors.paleBlue },
  selectorOptionText: { color: colors.ink, fontSize: 14 },
  selectorOptionTextActive: { color: colors.blue, fontWeight: "900" },
  logsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
  },
  fullSpan: { width: "100%" },
  logCard: {
    minHeight: 72,
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 10,
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow(0.08, 6, 2),
  },
  logAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  dateTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateDay: { color: colors.white, fontSize: 16, fontWeight: "900" },
  dateMonth: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  logDetails: { flex: 1, minWidth: 0, gap: 4 },
  logStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  logDay: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: "900" },
  logNote: { flexDirection: "row", alignItems: "center", gap: 4 },
  logNoteText: { flex: 1, color: colors.muted, fontSize: 10 },
  biometricText: { color: colors.muted, fontSize: 10 },
  loading: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  emptyState: {
    backgroundColor: colors.palePurple,
    borderWidth: 1.5,
    borderColor: "#D8C8EE",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  errorState: {
    backgroundColor: colors.paleRed,
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 16,
    margin: 14,
    marginBottom: 0,
    padding: 16,
    alignItems: "center",
    gap: 5,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "900" },
});