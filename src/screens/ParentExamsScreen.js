import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError, resolveApiUrl } from "../services/api";
import { examsApi } from "../services/examsApi";
import { omrApi } from "../services/omrApi";

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
  red: "#B94E4E",
  paleRed: "#FDECEC",
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

const examBoxColors = [
  [colors.blueTint, colors.blueAccent],
  [colors.orangeTint, colors.orangeAccent],
  [colors.indigoTint, colors.indigoAccent],
  [colors.redTint, colors.redAccent],
  [colors.skyTint, colors.skyAccent],
  [colors.goldTint, colors.goldAccent],
  [colors.purpleTint, colors.purpleAccent],
  [colors.violetTint, colors.violetAccent],
];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function HallTicketCard({ ticket, downloadingId, onDownload }) {
  const downloading = downloadingId === ticket.id;
  return (
    <View style={styles.ticketCard}>
      <View style={styles.ticketCopy}>
        <Text style={styles.ticketDate}>
          {ticket.date}
        </Text>
        <Text style={styles.ticketTitle}>{ticket.title}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Download hall ticket for ${ticket.title}`}
        style={[
          styles.downloadButton,
          downloading && styles.disabled,
        ]}
        disabled={Boolean(downloadingId)}
        onPress={() => onDownload(ticket)}
      >
        <Icon
          name={downloading ? "hourglass-outline" : "download-outline"}
          size={16}
          color={colors.white}
        />
        <Text style={styles.downloadText}>
          {downloading ? "Downloading..." : "Hall Ticket"}
        </Text>
      </Pressable>
    </View>
  );
}

function OMRResultCard({ result }) {
  const score = Number(result.total_score ?? result.totalScore ?? result.score ?? 0);
  const maximum = Number(
    result.max_score ?? result.maxScore ?? result.maximum_score ?? 0,
  );
  const percentage = Number.isFinite(Number(result.percentage))
    ? Math.round(Number(result.percentage))
    : maximum > 0
      ? Math.round((score / maximum) * 100)
      : 0;
  let subjectScores = result.subject_scores_json || result.subjectScores || {};
  if (typeof subjectScores === "string") {
    try {
      subjectScores = JSON.parse(subjectScores || "{}");
    } catch {
      subjectScores = {};
    }
  }
  const subjects =
    subjectScores && typeof subjectScores === "object" && !Array.isArray(subjectScores)
      ? Object.entries(subjectScores)
      : [];
  const rank = result.rank_in_class ?? result.rank;

  return (
    <View style={styles.omrCard}>
      <View style={styles.omrHeader}>
        <View style={styles.omrHeadingCopy}>
          <View style={styles.omrMetaRow}>
            <Text style={styles.omrType}>
              {result.pattern_type || result.patternType || "OMR"} exam
            </Text>
            {result.booklet_code || result.bookletCode ? (
              <Text style={styles.bookletCode}>
                Set {result.booklet_code || result.bookletCode}
              </Text>
            ) : null}
          </View>
          <Text style={styles.omrTitle} numberOfLines={2}>
            {result.exam_name || result.examName || "Competitive Exam"}
          </Text>
          <Text style={styles.omrDate}>
            {result.exam_date || result.examDate || "Date unavailable"}
            {result.total_questions
              ? ` · ${result.total_questions} questions`
              : ""}
          </Text>
        </View>
        <View style={styles.omrScoreBox}>
          {rank ? (
            <Text style={styles.omrRank}>Rank #{rank}</Text>
          ) : null}
          <Text style={styles.omrScore}>
            {score} <Text style={styles.omrMax}>/ {maximum || "—"}</Text>
          </Text>
          <Text style={styles.omrPercent}>{percentage}% overall</Text>
        </View>
      </View>
      <View style={styles.omrStats}>
        <View style={[styles.omrStat, styles.correctStat]}>
          <Text style={[styles.omrStatLabel, styles.correctText]}>Correct</Text>
          <Text style={[styles.omrStatValue, styles.correctText]}>
            {result.correct_count ?? result.correct ?? 0}
          </Text>
        </View>
        <View style={[styles.omrStat, styles.wrongStat]}>
          <Text style={[styles.omrStatLabel, styles.wrongText]}>Incorrect</Text>
          <Text style={[styles.omrStatValue, styles.wrongText]}>
            {result.wrong_count ?? result.wrong ?? 0}
          </Text>
        </View>
        <View style={[styles.omrStat, styles.blankStat]}>
          <Text style={[styles.omrStatLabel, styles.blankText]}>Unattempted</Text>
          <Text style={[styles.omrStatValue, styles.blankText]}>
            {result.unattempted_count ?? result.unattempted ?? result.blank ?? 0}
          </Text>
        </View>
      </View>
      {subjects.length ? (
        <View style={styles.omrSubjects}>
          <Text style={styles.omrSubjectsTitle}>Subject performance</Text>
          {subjects.map(([name, stats]) => (
            <View key={name} style={styles.omrSubjectRow}>
              <View style={styles.omrSubjectCopy}>
                <Text style={styles.omrSubjectName}>{name}</Text>
                <Text style={styles.omrSubjectStats}>
                  +{stats?.correct ?? 0} correct · -{stats?.wrong ?? 0} incorrect · {stats?.unattempted ?? 0} blank
                </Text>
              </View>
              <Text style={styles.omrSubjectScore}>
                {stats?.score ?? 0}/{stats?.max ?? 0}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ResultCard({ result, index }) {
  const [backgroundColor, accentColor] =
    examBoxColors[index % examBoxColors.length];
  return (
    <View
      style={[styles.resultCard, { backgroundColor, borderColor: accentColor }]}
    >
      <View style={styles.resultHeader}>
        <View style={styles.resultCopy}>
          <Text style={styles.resultExam}>{result.examName}</Text>
          <Text style={[styles.resultDate, { color: accentColor }]}>
            {result.date}
          </Text>
        </View>
        <View style={styles.percentage}>
          <Text style={[styles.percentageValue, { color: accentColor }]}>
            {result.percentage}%
          </Text>
          <Text style={styles.percentageLabel}>OVERALL</Text>
        </View>
      </View>
      {result.subjects.map((subject, index) => (
        <View
          key={`${result.id}-${subject.name}-${index}`}
          style={styles.subjectRow}
        >
          <Text style={styles.subjectNumber}>{index + 1}</Text>
          <Text style={styles.subjectName}>{subject.name}</Text>
          <Text style={styles.marks}>
            {subject.obtained.toFixed(2)} / {subject.maximum.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.resultStatus,
              subject.status === "PASS" ? styles.pass : styles.fail,
            ]}
          >
            {subject.status}
          </Text>
        </View>
      ))}
      <View style={styles.aggregate}>
        <Text style={styles.aggregateLabel}>Aggregate Results</Text>
        <Text style={styles.aggregateValue}>{result.aggregate}</Text>
      </View>
    </View>
  );
}

export default function ParentExamsScreen({
  session,
  selectedStudentId,
  onSessionExpired,
}) {
  const [hallTickets, setHallTickets] = useState([]);
  const [results, setResults] = useState([]);
  const [omrResults, setOmrResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextTickets, nextResults, nextOmrResults] = await Promise.all([
        examsApi.getHallTickets(session, selectedStudentId),
        examsApi.getResults(session, selectedStudentId),
        omrApi.getStudentResults(session, selectedStudentId).catch((omrError) => {
          if (omrError?.status === 401) onSessionExpired?.();
          return [];
        }),
      ]);
      setHallTickets(nextTickets || []);
      setResults(nextResults || []);
      setOmrResults(nextOmrResults || []);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load examinations. Please try again.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, selectedStudentId, session]);

  useEffect(() => {
    const timer = setTimeout(() => void loadExams(), 0);
    return () => clearTimeout(timer);
  }, [loadExams]);

  const downloadHallTicket = async (ticket) => {
    setDownloadingId(ticket.id);
    try {
      const response = await examsApi.downloadHallTicket(
        ticket.id,
        selectedStudentId,
        session,
      );
      const ticketUrl =
        typeof response === "string"
          ? response
          : response?.url ||
            response?.download_url ||
            response?.hall_ticket_url ||
            response?.pdf_url ||
              response?.file_url ||
              response?.data?.url ||
              response?.data?.download_url ||
              response?.data?.hall_ticket_url ||
              response?.data?.pdf_url;
        const unpublished =
          response?.available === false ||
          response?.published === false ||
          response?.is_published === false ||
          response?.success === false;
        if (unpublished || !ticketUrl) {
        const examName = ticket.title || "this examination";
        const examDate = ticket.date && ticket.date !== "Date TBD"
          ? ` scheduled for ${ticket.date}`
          : "";
          const serverMessage =
          response?.message ||
          response?.error ||
            response?.data?.message ||
            response?.data?.error;
          const reason = `The hall ticket for ${examName}${examDate} has not been published yet. Please contact the school office or try again later.${serverMessage ? `\n\nSchool system: ${serverMessage}` : ""}`;
        Alert.alert(
            "Hall ticket not published",
          reason,
        );
        return;
      }
      const resolvedUrl = resolveApiUrl(ticketUrl);
      if (Platform.OS === "web") {
        await WebBrowser.openBrowserAsync(resolvedUrl);
        return;
      }
      if (!FileSystem.cacheDirectory) {
        await WebBrowser.openBrowserAsync(resolvedUrl);
        return;
      }
      const localPath = `${FileSystem.cacheDirectory}hall_ticket_${String(ticket.id).replace(/[^a-z\d_-]/gi, "_")}.pdf`;
      const download = await FileSystem.downloadAsync(resolvedUrl, localPath, {
        headers: session?.token
          ? { Authorization: `Bearer ${session.token}` }
          : undefined,
      });
      if (download.status < 200 || download.status >= 300) {
        throw new Error(`Hall ticket download failed (${download.status}).`);
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save or share hall ticket",
          UTI: "com.adobe.pdf",
        });
      } else {
        await WebBrowser.openBrowserAsync(resolvedUrl);
      }
    } catch (downloadError) {
      if (downloadError?.status === 404) {
        Alert.alert(
          "Hall ticket not published",
          `The hall ticket for ${ticket.title || "this examination"} is not available yet. Please contact the school office or try again later.`,
        );
        return;
      }
      Alert.alert(
        "Could not download hall ticket",
        downloadError?.message ||
          "The hall ticket could not be downloaded. Check your connection or contact the school office.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.loadingText}>Loading exam results...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadExams}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.ticketPanel}>
            <View style={styles.ticketPanelHeader}>
              <View style={styles.ticketHeaderIcon}>
                <Icon name="document-text-outline" size={19} color="#F2C14E" />
              </View>
              <View style={styles.ticketPanelCopy}>
                <Text style={styles.ticketPanelTitle}>Examination hall tickets</Text>
                <Text style={styles.ticketPanelSubtitle}>
                  Download admit cards for scheduled examinations.
                </Text>
              </View>
            </View>
            {hallTickets.length ? (
              <View style={styles.ticketGrid}>
                {hallTickets.map((ticket) => (
                  <HallTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    downloadingId={downloadingId}
                    onDownload={downloadHallTicket}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.ticketEmpty}>No scheduled hall tickets available.</Text>
            )}
          </View>

          {omrResults.length ? (
            <View style={styles.resultsSection}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionHeadingCopy}>
                  <Icon name="ribbon-outline" size={18} color={colors.blue} />
                  <Text style={styles.sectionTitle}>OMR competitive exam performance</Text>
                </View>
                <Text style={styles.countBadge}>{omrResults.length} published</Text>
              </View>
              {omrResults.map((result, index) => (
                <OMRResultCard key={result.id || `${result.exam_name}-${index}`} result={result} />
              ))}
            </View>
          ) : null}

          <View style={styles.resultsSection}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Icon name="school-outline" size={18} color={colors.muted} />
                <Text style={styles.sectionTitle}>Curriculum examinations</Text>
              </View>
              {results.length ? (
                <Text style={styles.countBadge}>{results.length} results</Text>
              ) : null}
            </View>
            {results.length ? (
              results.map((result, index) => (
                <ResultCard key={result.id || `${result.examName}-${index}`} result={result} index={index} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Icon name="school-outline" size={25} color={colors.muted} />
                <Text style={styles.emptyTitle}>No results published</Text>
                <Text style={styles.emptyText}>
                  Exam results will appear here when the school publishes them.
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, paddingBottom: 8 },
  ticketPanel: {
    backgroundColor: "#111A35",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ticketPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  ticketHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#29334F",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketPanelCopy: { flex: 1, minWidth: 0 },
  ticketPanelTitle: { color: colors.white, fontSize: 13, fontWeight: "900" },
  ticketPanelSubtitle: { color: "#B7C2D5", fontSize: 10, marginTop: 3 },
  ticketGrid: { gap: 7 },
  ticketEmpty: { color: "#C4CDDC", fontSize: 10, paddingVertical: 7 },
  resultsSection: { marginBottom: 14 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 7,
    marginBottom: 9,
  },
  sectionHeadingCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  countBadge: {
    color: colors.green,
    backgroundColor: colors.paleGreen,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  backHome: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  backText: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  ticketCard: {
    backgroundColor: "#202B49",
    borderWidth: 1,
    borderColor: "#3A4868",
    borderRadius: 6,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketCopy: { flex: 1, minWidth: 0 },
  ticketDate: { color: "#B7C2D5", fontSize: 9, fontWeight: "700" },
  ticketTitle: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 3,
  },
  downloadButton: {
    backgroundColor: "#F2C14E",
    borderRadius: 5,
    minHeight: 34,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  downloadText: { color: "#111A35", fontSize: 9, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  resultCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    padding: 10,
    marginBottom: 8,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  resultCopy: { flex: 1 },
  resultExam: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  resultDate: { color: colors.muted, fontSize: 10, marginTop: 3 },
  percentage: { alignItems: "flex-end" },
  percentageValue: { color: colors.blue, fontSize: 18, fontWeight: "900" },
  percentageLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 8,
  },
  subjectNumber: {
    color: colors.muted,
    width: 16,
    fontSize: 11,
    fontWeight: "800",
  },
  subjectName: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" },
  marks: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  resultStatus: {
    width: 39,
    textAlign: "right",
    fontSize: 9,
    fontWeight: "900",
  },
  pass: { color: colors.green },
  fail: { color: colors.red },
  aggregate: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aggregateLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  aggregateValue: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  omrCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#CCD6EB",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 9,
  },
  omrHeader: {
    backgroundColor: "#111A35",
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  omrHeadingCopy: { flex: 1, minWidth: 0 },
  omrMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  omrType: {
    color: "#D8E4F5",
    backgroundColor: "#33446B",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  bookletCode: { color: "#B7C2D5", fontSize: 8, fontWeight: "800" },
  omrTitle: { color: colors.white, fontSize: 13, fontWeight: "900", marginTop: 5 },
  omrDate: { color: "#B7C2D5", fontSize: 9, marginTop: 3 },
  omrScoreBox: {
    minWidth: 86,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#263554",
    borderWidth: 1,
    borderColor: "#3C4B69",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  omrRank: { color: "#F2C14E", fontSize: 8, fontWeight: "900", marginBottom: 3 },
  omrScore: { color: "#66D6A5", fontSize: 16, fontWeight: "900" },
  omrMax: { color: "#B7C2D5", fontSize: 9, fontWeight: "600" },
  omrPercent: { color: "#F2C14E", fontSize: 8, fontWeight: "800", marginTop: 2 },
  omrStats: { flexDirection: "row", gap: 6, padding: 8, backgroundColor: "#F7F8FC" },
  omrStat: { flex: 1, minWidth: 0, alignItems: "center", borderWidth: 1, borderRadius: 6, padding: 7 },
  correctStat: { backgroundColor: "#E8F8F1", borderColor: "#C4EAD7" },
  wrongStat: { backgroundColor: "#FDECEC", borderColor: "#F4C4C4" },
  blankStat: { backgroundColor: "#F2F4F8", borderColor: "#DDE3EA" },
  omrStatLabel: { fontSize: 8, fontWeight: "800", textAlign: "center" },
  omrStatValue: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  correctText: { color: colors.green },
  wrongText: { color: colors.red },
  blankText: { color: colors.muted },
  omrSubjects: { padding: 9 },
  omrSubjectsTitle: { color: colors.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase", marginBottom: 5 },
  omrSubjectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 7,
  },
  omrSubjectCopy: { flex: 1, minWidth: 0 },
  omrSubjectName: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  omrSubjectStats: { color: colors.muted, fontSize: 8, marginTop: 2 },
  omrSubjectScore: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: colors.paleRed,
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
  emptyText: { color: colors.muted, fontSize: 12, marginTop: 12 },
  emptyState: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.white,
    padding: 16,
  },
  emptyTitle: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 6 },
});
