import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
};
const items = [
  [
    "OMR Dashboard",
    "Scanner and evaluation overview",
    "speedometer-outline",
    "OMR Dashboard",
  ],
  [
    "Exam Sessions",
    "Manage OMR examination sessions",
    "calendar-outline",
    "Exam Sessions",
  ],
  [
    "Answer Keys",
    "Create and manage answer keys",
    "key-outline",
    "Answer Keys",
  ],
  [
    "Hardware & Optical Scanner",
    "Scan and process OMR sheets",
    "hardware-chip-outline",
    "Hardware & Optical Scanner",
  ],
  [
    "Results & Leaderboards",
    "View scores, ranks, and results",
    "trophy-outline",
    "Results & Leaderboards",
  ],
];

export default function OMRSystemScreen({ onSelectModule, onBack }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <Ionicons name="arrow-back" size={18} color={colors.blue} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>OMR System</Text>
        <Text style={styles.subtitle}>Choose an OMR workflow</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {items.map(([title, description, icon, module]) => (
          <Pressable
            key={title}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => onSelectModule(module)}
          >
            <View style={styles.icon}>
              <Ionicons name={icon} size={22} color={colors.blue} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardDescription}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    padding: 16,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900", marginTop: 14 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  content: { padding: 16, gap: 10, paddingBottom: 100 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: { opacity: 0.78 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  cardDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
