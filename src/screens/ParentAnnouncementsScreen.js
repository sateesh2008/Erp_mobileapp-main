import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { announcementsApi } from "../services/announcementsApi";
import { ApiError } from "../services/api";

const colors = {
  ink: Colors.light.text,
  muted: Colors.light.textSecondary,
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  red: "#C65353",
  paleRed: "#FDECEC",
  orange: "#A76E00",
  paleOrange: "#FFF7DF",
  blueTint: "#EAF0FB",
  blueAccent: "#5274B8",
  goldTint: "#FFF6D9",
  goldAccent: "#B8861B",
  purpleTint: "#F2ECFB",
  purpleAccent: "#7A5AA6",
};

const announcementCardColors = [
  [colors.paleBlue, colors.blue],
  [colors.blueTint, colors.blueAccent],
  [colors.paleOrange, colors.orange],
  [colors.paleRed, colors.red],
];

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

const priorityStyle = (priority) => {
  if (String(priority).toLowerCase() === "high") {
    return { backgroundColor: colors.paleRed, color: colors.red };
  }
  if (String(priority).toLowerCase() === "medium") {
    return { backgroundColor: colors.paleOrange, color: colors.orange };
  }
  return { backgroundColor: colors.paleBlue, color: colors.blue };
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

export default function ParentAnnouncementsScreen({
  session,
  selectedStudentId,
  onSessionExpired,
  onAnnouncementsLoaded,
  onAnnouncementRead,
  title = "Announcements",
  eventOnly = false,
}) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnnouncements = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const records = await announcementsApi.getAnnouncements(
        session,
        selectedStudentId,
      );
      if (!eventOnly) onAnnouncementsLoaded?.(records);
      setAnnouncements(
        eventOnly
          ? records.filter((record) =>
              String(record.type).toLowerCase().includes("event"),
            )
          : records,
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load announcements. Please try again.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadAnnouncements(), 0);
    return () => clearTimeout(timer);
  }, [session, selectedStudentId]);

  const handleMarkAsRead = async (announcement) => {
    if (
      !announcement?.id ||
      announcementsApi.isAnnouncementRead(announcement)
    ) {
      return;
    }

    setAnnouncements((current) =>
      current.map((item) =>
        item.id === announcement.id ? { ...item, is_read: true } : item,
      ),
    );
    onAnnouncementRead?.(announcement.id, true);

    try {
      await announcementsApi.markAsRead(session, announcement.id);
    } catch (requestError) {
      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id ? { ...item, is_read: false } : item,
        ),
      );
      onAnnouncementRead?.(announcement.id, false);
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to mark notification as read.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    }
  };

  const unreadCount = announcements.filter(
    (item) => !announcementsApi.isAnnouncementRead(item),
  ).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadAnnouncements(true)}
          tintColor={colors.blue}
        />
      }
    >
      <View style={styles.heading}>
        <View style={styles.iconBox}>
          <Ionicons name="megaphone" size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {eventOnly
              ? "School events and activities"
              : "School messages and notifications"}
          </Text>
        </View>
        {!loading && !error && announcements.length > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{unreadCount}</Text>
            <Text style={styles.unreadLabel}>NEW</Text>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.stateText}>Loading {title.toLowerCase()}...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => loadAnnouncements()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="notifications-off-outline"
              size={30}
              color={colors.blue}
            />
          </View>
          <Text style={styles.emptyTitle}>No {title.toLowerCase()}</Text>
          <Text style={styles.emptyText}>
            New school notices will appear here.
          </Text>
        </View>
      ) : (
        announcements.map((announcement, index) => {
          const badge = priorityStyle(announcement.priority);
          const [cardBackground, cardAccent] =
            announcementCardColors[index % announcementCardColors.length];
          const isRead = announcementsApi.isAnnouncementRead(announcement);
          return (
            <Pressable
              key={announcement.id || `${announcement.title}-${index}`}
              style={({ pressed }) => [
                styles.card,
                { borderColor: cardAccent, borderLeftColor: cardAccent },
                isRead && styles.cardRead,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleMarkAsRead(announcement)}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[styles.typePill, { backgroundColor: cardBackground }]}
                >
                  <Ionicons
                    name="notifications"
                    size={13}
                    color={cardAccent}
                  />
                  <Text style={[styles.type, { color: cardAccent }]}>
                    {announcement.type}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  {!isRead ? <View style={styles.unreadDot} /> : null}
                  <Text
                    style={[
                      styles.priority,
                      {
                        backgroundColor: badge.backgroundColor,
                        color: badge.color,
                      },
                    ]}
                  >
                    {announcement.priority}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.message}>{announcement.message}</Text>
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={cardAccent}
                  />
                  <Text style={styles.metaText}>
                    {formatDate(announcement.date)}
                  </Text>
                </View>
                {announcement.creator ? (
                  <View style={[styles.metaItem, { flexShrink: 1 }]}>
                    <Ionicons
                      name="person-outline"
                      size={13}
                      color={cardAccent}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {announcement.creator}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas },
  content: { paddingBottom: 24 },
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
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  unreadBadge: {
    backgroundColor: colors.paleRed,
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: "center",
    minWidth: 48,
  },
  unreadCount: { color: colors.red, fontSize: 17, fontWeight: "900" },
  unreadLabel: { color: colors.red, fontSize: 8, fontWeight: "900" },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderLeftWidth: 6,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...shadow(),
  },
  cardRead: { opacity: 0.75 },
  cardPressed: { opacity: 0.85 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 1,
  },
  type: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 7 },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.white,
  },
  priority: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    overflow: "hidden",
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 12,
  },
  message: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 12,
    paddingTop: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  state: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: colors.paleRed,
    borderWidth: 1.5,
    borderColor: colors.red,
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
  emptyBox: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: "#C9D3F5",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    ...shadow(),
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: { color: colors.muted, fontSize: 12, marginTop: 5 },
});