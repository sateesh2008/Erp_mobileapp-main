import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppColors as colors } from "../constants/theme";

export default function AcademicHealthPresenceCard({
  percentage,
  daysPresent,
  daysAbsent,
  onPress,
}) {
  const numericPercentage = Number(percentage);
  const safePercentage = Number.isFinite(numericPercentage)
    ? Math.min(100, Math.max(0, numericPercentage))
    : 0;
  const displayPercentage = Math.round(safePercentage);
  const safeDaysPresent = Number.isFinite(Number(daysPresent))
    ? Number(daysPresent)
    : 0;
  const safeDaysAbsent = Number.isFinite(Number(daysAbsent))
    ? Number(daysAbsent)
    : 0;

  return (
    <Pressable
      accessible
      accessibilityLabel={`Academic health and presence: ${displayPercentage} percent, ${safeDaysPresent} days present, ${safeDaysAbsent} days absent`}
      accessibilityRole={onPress ? "button" : "summary"}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Ionicons
            name="trending-up"
            size={19}
            color={colors.red}
            accessibilityLabel="Attendance trend"
          />
          <Text style={styles.title} numberOfLines={1}>
            ACADEMIC HEALTH & PRESENCE
          </Text>
        </View>
        <Text style={styles.percentage}>{displayPercentage}%</Text>
      </View>
      <View style={styles.track} accessibilityRole="progressbar">
        <View style={[styles.fill, { width: `${safePercentage}%` }]} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.metric}>
          <Text style={styles.metricValue}>{safeDaysPresent}</Text> Days Present
        </Text>
        <Text style={[styles.metric, styles.metricRight]}>
          <Text style={styles.metricValue}>{safeDaysAbsent}</Text> Days Absent
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.navy,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  percentage: {
    color: colors.red,
    fontSize: 22,
    fontWeight: "900",
    flexShrink: 0,
  },
  track: {
    height: 8,
    width: "100%",
    borderRadius: 8,
    backgroundColor: colors.paleRed,
    overflow: "hidden",
    marginTop: 18,
  },
  fill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: colors.red,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  metric: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricRight: { textAlign: "right" },
  metricValue: { color: colors.ink, fontWeight: "900" },
});
