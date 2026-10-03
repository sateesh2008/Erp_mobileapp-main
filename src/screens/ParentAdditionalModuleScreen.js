import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  navy: "#13137F", // was missing before, which made the student card invisible
};

const moduleContent = {
  "Student Profile": {
    icon: "person-circle-outline",
    empty: "Student profile information is not available.",
    tint: "#EAF0FB",
    accent: "#5274B8",
  },
  Transport: {
    icon: "bus-outline",
    empty: "Transport details are not currently available.",
    tint: "#FDECEC",
    accent: "#C65353",
  },
  "Messaging / Notifications": {
    icon: "megaphone-outline",
    empty: "No messages or notifications available.",
    tint: "#F2ECFB",
    accent: "#7A5AA6",
  },
  Events: {
    icon: "school-outline",
    empty: "No events available.",
    tint: "#EAF5FB",
    accent: "#3284A8",
  },
  Leave: {
    icon: "create-outline",
    empty: "No leave information available.",
    tint: "#FFF6D9",
    accent: "#B8861B",
  },
  Documents: {
    icon: "document-text-outline",
    empty: "No documents available.",
    tint: "#F0EDF8",
    accent: "#6C63A8",
  },
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

export default function ParentAdditionalModuleScreen({
  title,
  selectedStudent,
}) {
  const content = moduleContent[title] || {
    icon: "information-circle-outline",
    empty: "Information is not available.",
    tint: colors.paleBlue,
    accent: colors.blue,
  };
  const studentName = selectedStudent?.name || "Student";

  return (
    <View style={styles.container}>
      <View style={styles.studentCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {studentName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.studentLabel}>SELECTED STUDENT</Text>
          <Text style={styles.studentName} numberOfLines={1}>
            {studentName}
          </Text>
          <Text style={styles.studentClass} numberOfLines={1}>
            {selectedStudent?.className || "Student information unavailable"}
            {selectedStudent?.section
              ? ` · Section ${selectedStudent.section}`
              : ""}
          </Text>
        </View>
      </View>

      <View style={[styles.emptyCard, { borderColor: content.accent }]}>
        <View style={[styles.emptyIcon, { backgroundColor: content.tint }]}>
          <Ionicons name={content.icon} size={34} color={content.accent} />
        </View>
        <Text style={styles.moduleTitle}>{title}</Text>
        <Text style={styles.emptyTitle}>{content.empty}</Text>
        <View style={[styles.notePill, { backgroundColor: content.tint }]}>
          <Ionicons
            name="information-circle-outline"
            size={15}
            color={content.accent}
          />
          <Text style={[styles.emptyText, { color: content.accent }]}>
            This module is ready for parent-scoped API integration.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 24 },
  studentCard: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3E8BEA",
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow(0.25, 12, 5),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#3E8BEA",
    borderWidth: 2,
    borderColor: "#FFD27A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 21, fontWeight: "900" },
  studentLabel: {
    color: "#A9C6E8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  studentName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  studentClass: { color: "#C8DBF2", fontSize: 12, marginTop: 3 },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    ...shadow(),
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  notePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  emptyText: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
});