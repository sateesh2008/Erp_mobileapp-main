import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { timetableApi } from "../services/timetableApi";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
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

const timetableBoxColors = [
  [colors.blueTint, colors.blueAccent],
  [colors.orangeTint, colors.orangeAccent],
  [colors.indigoTint, colors.indigoAccent],
  [colors.redTint, colors.redAccent],
  [colors.skyTint, colors.skyAccent],
  [colors.goldTint, colors.goldAccent],
  [colors.purpleTint, colors.purpleAccent],
  [colors.violetTint, colors.violetAccent],
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function SessionCard({ session, index }) {
  const hasClass = Boolean(session.subject);
  const [backgroundColor, accentColor] =
    timetableBoxColors[index % timetableBoxColors.length];

  return (
    <View
      style={[
        styles.sessionCard,
        { borderColor: accentColor, borderLeftColor: accentColor },
      ]}
    >
      <View style={[styles.timeChip, { backgroundColor }]}>
        <Icon name="time-outline" size={14} color={accentColor} />
        <Text style={[styles.time, { color: accentColor }]}>
          {session.startTime} TO {session.endTime}
        </Text>
      </View>
      {hasClass ? (
        <View style={styles.sessionLine}>
          <Text style={styles.subject}>{session.subject}</Text>
          <View style={styles.metaRow}>
            {session.room ? (
              <View style={[styles.metaChip, { backgroundColor }]}>
                <Icon name="location-outline" size={13} color={accentColor} />
                <Text style={[styles.room, { color: accentColor }]}>
                  {session.room}
                </Text>
              </View>
            ) : null}
            {session.teacher ? (
              <View style={styles.teacherRow}>
                <Icon name="person-outline" size={14} color={accentColor} />
                <Text style={[styles.teacher, { color: accentColor }]}>
                  {session.teacher}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.emptySession}>
          <Icon name="remove-circle-outline" size={18} color={accentColor} />
          <Text style={[styles.emptySessionText, { color: accentColor }]}>
            No class scheduled
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ParentTimetableScreen({
  session,
  selectedStudentId,
  onSessionExpired,
}) {
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTimetable(
        await timetableApi.getWeeklySchedule(session, selectedStudentId),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load timetable. Please try again.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedStudentId, session]);

  useEffect(() => {
    const timer = setTimeout(() => void loadTimetable(), 0);
    return () => clearTimeout(timer);
  }, [loadTimetable]);

  const sessions = timetable[selectedDay] || [];

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Icon name="calendar" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Weekly Schedule</Text>
          <Text style={styles.description}>Institutional Class Timetable</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{loading ? "–" : sessions.length}</Text>
          <Text style={styles.countLabel}>{selectedDay}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabs}
      >
        {days.map((day, index) => {
          const [backgroundColor, accentColor] =
            timetableBoxColors[index % timetableBoxColors.length];
          const active = selectedDay === day;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.dayTab,
                { backgroundColor, borderColor: accentColor },
                active && { backgroundColor: accentColor },
                active && shadow(0.25, 8, 3),
              ]}
              onPress={() => setSelectedDay(day)}
            >
              <Text
                style={[
                  styles.dayText,
                  { color: accentColor },
                  active && styles.dayTextActive,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading timetable...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Icon name="alert-circle-outline" size={24} color={colors.redAccent} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadTimetable}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="cafe-outline" size={30} color={colors.goldAccent} />
          <Text style={styles.emptyText}>No timetable available.</Text>
        </View>
      ) : (
        sessions.map((item, index) => (
          <SessionCard
            key={`${selectedDay}-${item.startTime}-${index}`}
            session={item}
            index={index}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 20 },
  intro: {
    backgroundColor: colors.purpleAccent,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#A98BD3",
    ...shadow(0.2, 12, 5),
  },
  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  description: { color: "#E6DAF5", fontSize: 12, marginTop: 3 },
  countBadge: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 54,
  },
  countText: { color: colors.purpleAccent, fontSize: 18, fontWeight: "900" },
  countLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  dayTabs: { gap: 8, paddingBottom: 6, paddingRight: 8, marginBottom: 10 },
  dayTab: {
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 12, fontWeight: "900" },
  dayTextActive: { color: colors.white },
  sessionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderLeftWidth: 6,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...shadow(),
  },
  timeChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  time: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  sessionLine: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  subject: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  room: { fontSize: 11, fontWeight: "800" },
  teacherRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  teacher: { fontSize: 12, fontWeight: "700", flexShrink: 1 },
  emptySession: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  emptySessionText: { fontSize: 12, fontWeight: "700" },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: colors.redTint,
    borderWidth: 1.5,
    borderColor: colors.redAccent,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    gap: 6,
  },
  errorText: { color: colors.red, fontSize: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: colors.blue,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 6,
  },
  retryText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  empty: {
    backgroundColor: colors.goldTint,
    borderWidth: 1.5,
    borderColor: colors.goldAccent,
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { color: colors.goldAccent, fontSize: 13, fontWeight: "800" },
});