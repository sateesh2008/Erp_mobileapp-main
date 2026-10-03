import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
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
  paleRed: "#FDECEC",
};

const textValue = (value, fallback = "") =>
  value === undefined || value === null || value === ""
    ? fallback
    : String(value);

const normalizeAnnouncement = (record, index) => ({
  ...record,
  id: record?.id || record?.announcement_id || `announcement-${index}`,
  priority: textValue(record?.priority, "GENERAL").toUpperCase(),
  category: textValue(
    record?.category || record?.type,
    "GENERAL",
  ).toUpperCase(),
  targetAudience: textValue(
    record?.targetAudience || record?.target_audience || record?.audience,
    "ALL",
  ).toUpperCase(),
  title: textValue(record?.title || record?.subject, "Announcement"),
  message: textValue(record?.message || record?.content || record?.description),
  creator: textValue(
    record?.creator ||
      record?.creator_name ||
      record?.created_by_name ||
      record?.created_by,
    "School Administration",
  ),
  date: textValue(
    record?.date || record?.created_at || record?.createdAt,
    "Date unavailable",
  ),
});

const formatDate = (value) => {
  if (/^\d{1,2} [A-Za-z]{3,9} \d{4}$/.test(String(value))) return String(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? textValue(value, "Date unavailable")
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function StatCard({ label, value, description, icon, tint }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tint }]}>
      <View style={styles.statIcon}>
        <Icon name={icon} size={17} color={colors.blue} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statDescription}>{description}</Text>
    </View>
  );
}

export default function BroadcastLedgerScreen({
  session,
  onBack,
  onOpenAnnouncement,
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnnouncements = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const result = await announcementsApi.getAnnouncements(session);
        setAnnouncements(
          (Array.isArray(result) ? result : []).map(normalizeAnnouncement),
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Unable to load announcements. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAnnouncements();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const matchesPriority =
        priorityFilter === "ALL" || announcement.priority === priorityFilter;
      const matchesCategory =
        categoryFilter === "ALL" || announcement.category === categoryFilter;
      const searchableText = [
        announcement.title,
        announcement.message,
        announcement.creator,
        announcement.targetAudience,
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesPriority &&
        matchesCategory &&
        (!normalizedQuery || searchableText.includes(normalizedQuery))
      );
    });
  }, [announcements, categoryFilter, priorityFilter, query]);

  const announcementUrl = (announcement) =>
    announcement.url ||
    announcement.link ||
    resolveApiUrl(`/announcements/${encodeURIComponent(announcement.id)}`);

  const shareWhatsApp = async (announcement) => {
    const message = `${announcement.title}\n${announcement.message}`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      if (await Linking.canOpenURL(whatsappUrl)) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ title: announcement.title, message });
      }
    } catch {
      Alert.alert(
        "Sharing unavailable",
        "WhatsApp is not available on this device.",
      );
    }
  };

  const copyLink = async (announcement) => {
    try {
      await Clipboard.setStringAsync(announcementUrl(announcement));
      Alert.alert("Link copied", "The announcement link is ready to share.");
    } catch {
      Alert.alert("Copy failed", "Unable to copy the announcement link.");
    }
  };

  const renderFilter = (label, selected, onPress) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAnnouncements(true)}
            tintColor={colors.blue}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            {onBack ? (
              <Pressable style={styles.backButton} onPress={onBack}>
                <Icon name="arrow-back" size={16} color={colors.blue} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            <Text style={styles.title}>Broadcast Ledger</Text>
            <Text style={styles.subtitle}>
              Institutional intelligence and strategic announcements
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <Icon name="megaphone-outline" size={22} color={colors.blue} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Active Broadcasts"
            value={announcements.length}
            description="Live transmissions"
            icon="radio-outline"
            tint={colors.paleBlue}
          />
          <StatCard
            label="System Reach"
            value="Global"
            description="All target nodes"
            icon="globe-outline"
            tint="#EAF0FB"
          />
          <StatCard
            label="High Priority"
            value={
              announcements.filter((announcement) =>
                String(announcement.priority).toLowerCase().includes("high"),
              ).length
            }
            description="Critical alerts"
            icon="warning-outline"
            tint={colors.paleOrange}
          />
          <StatCard
            label="Last Sync"
            value="Live"
            description="Buffer synchronized"
            icon="sync-outline"
            tint="#F2ECFB"
          />
        </View>

        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <Icon name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search broadcast audit log..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <Text style={styles.filterLabel}>PRIORITY</Text>
          <View style={styles.filterRow}>
            {["MEDIUM PRIORITY", "ALL"].map((label) =>
              renderFilter(label, priorityFilter === label, () =>
                setPriorityFilter(label),
              ),
            )}
          </View>
          <Text style={styles.filterLabel}>CATEGORY</Text>
          <View style={styles.filterRow}>
            {["GENERAL", "HOLIDAY", "ALL"].map((label) =>
              renderFilter(label, categoryFilter === label, () =>
                setCategoryFilter(label),
              ),
            )}
          </View>
        </View>

        {error ? (
          <View>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => void loadAnnouncements()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.stateText}>
              Synchronizing broadcast ledger...
            </Text>
          </View>
        ) : null}
        {!loading && !filteredAnnouncements.length ? (
          <View style={styles.empty}>
            <Icon name="file-tray-outline" size={30} color={colors.muted} />
            <Text style={styles.emptyTitle}>No matching broadcasts</Text>
            <Text style={styles.emptyText}>
              Try a different search term or filter.
            </Text>
          </View>
        ) : null}

        {!loading &&
          filteredAnnouncements.map((announcement) => (
            <View key={announcement.id} style={styles.announcementCard}>
              <View style={styles.cardTopRow}>
                <View style={styles.badgeRow}>
                  <Text style={styles.priorityBadge}>
                    {announcement.priority}
                  </Text>
                  <Text style={styles.categoryBadge}>
                    {announcement.category}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(announcement.date)}</Text>
              </View>
              <Text style={styles.announcementTitle}>{announcement.title}</Text>
              <Text style={styles.message}>
                {announcement.message || "No message content available."}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  <Icon name="person-outline" size={13} color={colors.muted} />{" "}
                  {announcement.creator}
                </Text>
                <Text style={styles.meta}>
                  <Icon name="people-outline" size={13} color={colors.muted} />{" "}
                  {announcement.targetAudience}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => void shareWhatsApp(announcement)}
                >
                  <Icon name="logo-whatsapp" size={15} color={colors.blue} />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => void copyLink(announcement)}
                >
                  <Icon name="copy-outline" size={15} color={colors.blue} />
                  <Text style={styles.actionText}>Copy Link</Text>
                </Pressable>
                <Pressable
                  style={styles.noticeButton}
                  onPress={() => onOpenAnnouncement?.(announcement)}
                >
                  <Text style={styles.noticeButtonText}>View Notice Page</Text>
                  <Icon name="arrow-forward" size={14} color={colors.white} />
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 16, paddingBottom: 36 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerCopy: { flex: 1 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  backText: { color: colors.blue, fontSize: 12, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  headerIcon: {
    backgroundColor: colors.paleBlue,
    borderRadius: 12,
    padding: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: { width: "48.5%", minHeight: 124, borderRadius: 13, padding: 12 },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  statValue: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 3,
  },
  statDescription: { color: colors.muted, fontSize: 10, marginTop: 2 },
  controls: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 12,
    marginBottom: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    paddingVertical: 10,
    marginLeft: 7,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 7,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  filterTextSelected: { color: colors.white },
  error: {
    color: colors.red,
    backgroundColor: colors.paleRed,
    borderRadius: 9,
    padding: 10,
    marginBottom: 12,
    fontSize: 12,
  },
  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.blue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  retryButtonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  state: { alignItems: "center", paddingVertical: 22, gap: 8 },
  stateText: { color: colors.muted, fontSize: 12 },
  empty: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 28,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: { color: colors.muted, fontSize: 12, marginTop: 5 },
  announcementCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 14,
    marginBottom: 11,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  priorityBadge: {
    color: colors.orange,
    backgroundColor: colors.paleOrange,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },
  categoryBadge: {
    color: colors.blue,
    backgroundColor: colors.paleBlue,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },
  date: { color: colors.muted, fontSize: 10 },
  announcementTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  message: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 13 },
  meta: { color: colors.muted, fontSize: 11 },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  actionText: { color: colors.blue, fontSize: 11, fontWeight: "800" },
  noticeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.blue,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginLeft: "auto",
  },
  noticeButtonText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14, 31, 36, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  detailCard: { backgroundColor: colors.white, borderRadius: 14, padding: 17 },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  detailSubject: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 18,
  },
  detailBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 14,
  },
  detailMeta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  closeButton: {
    backgroundColor: colors.blue,
    borderRadius: 9,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 18,
  },
  closeButtonText: { color: colors.white, fontWeight: "900", fontSize: 13 },
});
