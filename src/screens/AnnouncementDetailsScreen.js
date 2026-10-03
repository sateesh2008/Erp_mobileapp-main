import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { announcementsApi } from "../services/announcementsApi";
import { resolveApiUrl } from "../services/api";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  canvas: "#F7F8FF",
  white: "#FFFFFF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  orange: "#D9822B",
  paleOrange: "#FFF1DF",
  red: "#C65353",
};

const textValue = (value, fallback = "Not available") =>
  value === undefined || value === null || value === ""
    ? fallback
    : String(value);

const formatPriority = (value) => {
  const priority = textValue(value, "GENERAL").toUpperCase();
  return priority.includes("PRIORITY") ? priority : `${priority} PRIORITY`;
};

const normalizeAnnouncement = (record) => ({
  ...record,
  id: record?.id || record?.announcement_id,
  noticeId:
    record?.noticeId ||
    record?.notice_id ||
    record?.announcement_id ||
    record?.id,
  priority: formatPriority(record?.priority),
  category: textValue(record?.category || record?.type, "GENERAL"),
  targetAudience: textValue(
    record?.targetAudience || record?.target_audience || record?.audience,
    "ALL",
  ).toUpperCase(),
  title: textValue(record?.title || record?.subject, "Announcement"),
  message: textValue(
    record?.message || record?.content || record?.description,
    "No message content available.",
  ),
  creator: textValue(
    record?.creator ||
      record?.creator_name ||
      record?.created_by_name ||
      record?.created_by,
    "School Administration",
  ),
  institution: textValue(
    record?.institution || record?.school_name || record?.schoolName,
    "Demo School",
  ),
  date: textValue(record?.date || record?.created_at || record?.createdAt),
  time: textValue(
    record?.time || record?.created_time || record?.createdAtTime,
    "04:30 pm",
  ),
});

const formatDate = (value) => {
  if (/^\d{1,2} [A-Za-z]{3,9} \d{4}$/.test(String(value))) return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? textValue(value)
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AnnouncementDetailsScreen({
  session,
  announcement,
  onBack,
}) {
  const [details, setDetails] = useState(() =>
    normalizeAnnouncement(announcement),
  );
  const [loading, setLoading] = useState(
    Boolean(announcement?.id && !String(announcement.id).startsWith("sample-")),
  );
  const [error, setError] = useState("");

  const loadDetails = useCallback(async () => {
    if (!announcement?.id || String(announcement.id).startsWith("sample-"))
      return;
    setLoading(true);
    setError("");
    try {
      const result = await announcementsApi.getAnnouncement(
        session,
        announcement.id,
      );
      const payload =
        result?.announcement ||
        result?.data?.announcement ||
        result?.data ||
        result;
      if (!payload || typeof payload !== "object")
        throw new Error("Announcement not found.");
      setDetails(normalizeAnnouncement({ ...announcement, ...payload }));
    } catch (requestError) {
      if (requestError?.status === 404) setDetails(null);
      setError(requestError?.message || "Unable to load announcement details.");
    } finally {
      setLoading(false);
    }
  }, [announcement, session]);

  useEffect(() => {
    const timer = setTimeout(() => void loadDetails(), 0);
    return () => clearTimeout(timer);
  }, [loadDetails]);

  const noticeUrl =
    details?.url ||
    details?.link ||
    resolveApiUrl(`/announcements/${encodeURIComponent(details?.id || details?.noticeId || "notice")}`);
  const shareMessage = `${details.title}\n${details.message}`;

  const shareWhatsApp = async () => {
    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(`${shareMessage}\n${noticeUrl}`)}`;
      if (await Linking.canOpenURL(whatsappUrl))
        await Linking.openURL(whatsappUrl);
      else
        await Share.share({
          title: details.title,
          message: `${shareMessage}\n${noticeUrl}`,
        });
    } catch {
      Alert.alert(
        "Sharing unavailable",
        "WhatsApp is not available on this device.",
      );
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(noticeUrl);
      Alert.alert("Link copied", "The announcement link is ready to share.");
    } catch {
      Alert.alert("Copy failed", "Unable to copy the announcement link.");
    }
  };

  const shareNative = async () => {
    try {
      await Share.share({
        title: details.title,
        message: `${shareMessage}\n${noticeUrl}`,
      });
    } catch (shareError) {
      if (shareError?.message && !/cancel/i.test(shareError.message)) {
        Alert.alert(
          "Share unavailable",
          "Unable to open the device share sheet.",
        );
      }
    }
  };

  if (!announcement) {
    return <StateView title="Announcement not found" onBack={onBack} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={onBack}>
          <Icon name="arrow-back" size={18} color={colors.blue} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.headingLabel}>Announcements</Text>
          <Text style={styles.title}>{details.title}</Text>
        </View>
        <View style={styles.topActions}>
          <ActionButton
            icon="logo-whatsapp"
            label="WhatsApp"
            onPress={() => void shareWhatsApp()}
          />
          <ActionButton
            icon="copy-outline"
            label="Copy Link"
            onPress={() => void copyLink()}
          />
        </View>
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.stateText}>
              Loading announcement details...
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && details ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.priority}>{details.priority}</Text>
                <Text style={styles.category}>{details.category}</Text>
              </View>
              <Text style={styles.detailTitle}>{details.title}</Text>
              <View style={styles.infoGrid}>
                <Info label="Target Audience" value={details.targetAudience} />
                <Info label="Institution" value={details.institution} />
                <Info label="Published" value={formatDate(details.date)} />
                <Info label="Time" value={details.time} />
                <Info label="Author" value={details.creator} />
              </View>
            </View>
            <View style={styles.bodyCard}>
              <Text style={styles.sectionTitle}>
                Official Communication Body
              </Text>
              <Text style={styles.message}>{details.message}</Text>
              <View style={styles.footer}>
                <Text style={styles.footerTitle}>
                  Institutional Broadcast System
                </Text>
                <Text style={styles.footerText}>
                  Authorized by School Administration
                </Text>
              </View>
            </View>
            <Text style={styles.verification}>
              Notice ID: #{details.noticeId || "Unavailable"} • Verified
              transmission
            </Text>
            <View style={styles.shareCard}>
              <Text style={styles.sectionTitle}>
                Disseminate this announcement:
              </Text>
              <View style={styles.shareActions}>
                <ActionButton
                  icon="logo-whatsapp"
                  label="WhatsApp Broadcast"
                  onPress={() => void shareWhatsApp()}
                />
                <ActionButton
                  icon="copy-outline"
                  label="Copy Notice Link"
                  onPress={() => void copyLink()}
                />
                <ActionButton
                  icon="share-outline"
                  label="Share"
                  onPress={() => void shareNative()}
                />
              </View>
            </View>
          </>
        ) : null}
        {!loading && !details ? (
          <StateView title="Announcement not found" onBack={onBack} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Icon name={icon} size={16} color={colors.blue} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StateView({ title, onBack }) {
  return (
    <View style={styles.stateScreen}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Pressable style={styles.closeButton} onPress={onBack}>
        <Text style={styles.closeButtonText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 36 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  backText: { color: colors.blue, fontSize: 13, fontWeight: "800" },
  heading: { marginBottom: 14 },
  headingLabel: { color: colors.blue, fontSize: 13, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900", marginTop: 5 },
  topActions: { flexDirection: "row", gap: 8, marginBottom: 14 },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  actionText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
  },
  cardTop: { flexDirection: "row", gap: 7 },
  priority: {
    color: colors.orange,
    backgroundColor: colors.paleOrange,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "900",
  },
  category: {
    color: colors.blue,
    backgroundColor: colors.paleBlue,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  detailTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 15,
  },
  infoGrid: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 15,
    paddingTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  info: { width: "46%" },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  infoValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  bodyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  message: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 22,
    paddingTop: 12,
  },
  footerTitle: { color: colors.navy, fontSize: 12, fontWeight: "900" },
  footerText: { color: colors.muted, fontSize: 11, marginTop: 4 },
  verification: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 11,
    marginVertical: 16,
  },
  shareCard: {
    backgroundColor: colors.paleBlue,
    borderRadius: 14,
    padding: 15,
  },
  shareActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: {
    color: colors.red,
    backgroundColor: "#FDECEC",
    borderRadius: 9,
    padding: 10,
    marginBottom: 12,
    fontSize: 12,
  },
  state: { alignItems: "center", paddingVertical: 24, gap: 8 },
  stateText: { color: colors.muted, fontSize: 12 },
  stateScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  closeButton: {
    backgroundColor: colors.blue,
    borderRadius: 9,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginTop: 16,
  },
  closeButtonText: { color: colors.white, fontWeight: "900" },
});
