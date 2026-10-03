import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { resolveApiUrl } from "../services/api";
import { homeworkApi } from "../services/homeworkApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  paleRed: "#FDECEC",
  green: "#1E8056",
  paleGreen: "#E6F6EE",
  orange: "#9A6500",
  paleOrange: "#FFF5D9",
  red: "#B74755",
};

type HomeworkAssignment = {
  id?: number;
  subject?: string;
  topic?: string;
  assignedDate?: string;
  dueDate?: string;
  className?: string;
  schoolName?: string;
  instructor?: string;
  instructions?: string;
  status?: string;
  submissionStatus?: string;
  target_student_id?: number;
  student_id?: number;
  attachment_url?: string | null;
  material?: string | null;
  submission_attachment_url?: string | null;
  submission_status?: string;
  marks_obtained?: number | string;
  teacher_remarks?: string;
  homework_date?: string;
  submission_date?: string;
  subject_name?: string;
  class_name?: string;
  division_name?: string;
  school_name?: string;
  staff_first_name?: string;
  staff_last_name?: string;
  submission_text?: string;
  submissionText?: string;
  content?: string;
  description?: string;
  teacher?: string;
  title?: string;
};

const parseAssignment = (
  value: string | string[] | undefined,
): HomeworkAssignment | null => {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(String(value)));
  } catch {
    return null;
  }
};

const buildShareMessage = (item: HomeworkAssignment) =>
  `${item.subject} - ${item.topic}\nClass: ${item.className}\nAssigned: ${item.assignedDate}\nSubmission due: ${item.dueDate}`;

const dateFrom = (value: string | undefined) => {
  if (!value) return null;
  const text = String(value).split("T")[0];
  const dayFirst = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dayFirst) {
    return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  }
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const displayDate = (value: string | undefined) =>
  dateFrom(value)?.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) || "Not available";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function HomeworkDetailsRoute() {
  const router = useRouter();
  const { assignment } = useLocalSearchParams<{ assignment?: string }>();
  const item = parseAssignment(assignment);
  const hasAssignmentDetails = Boolean(
    item?.title ||
      item?.topic ||
      item?.description ||
      item?.instructions ||
      item?.attachment_url,
  );
  const [homework, setHomework] = useState<HomeworkAssignment | null>(item);
  const [loading, setLoading] = useState(
    Boolean(item?.id && !hasAssignmentDetails),
  );
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!item?.id || hasAssignmentDetails) return;
    let active = true;
    const loadHomework = async () => {
      const result = await homeworkApi.fetchPublicHomework(item.id);
      if (!active) return;
      if (result.success) setHomework(result.data as HomeworkAssignment);
      else setError(result.error || "Unable to load homework details.");
      setLoading(false);
    };
    void loadHomework();
    return () => {
      active = false;
    };
  }, [item?.id, hasAssignmentDetails]);

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Homework not found</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Return to Homework</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const source = { ...item, ...(homework || {}) };
  if (loading)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.body}>Loading homework details...</Text>
        </View>
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Return to Homework</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  const assignmentDetails = {
    ...source,
    subject: source.subject || source.subject_name || "Academic Subject",
    topic: source.topic || source.title || "Homework Assignment",
    className: source.className || source.class_name || "N/A",
    schoolName: source.schoolName || source.school_name || "N/A",
    assignedDate: displayDate(source.assignedDate || source.homework_date),
    dueDate: displayDate(source.dueDate || source.submission_date),
    instructor:
      source.instructor ||
      source.teacher ||
      [source.staff_first_name, source.staff_last_name].filter(Boolean).join(" ") ||
      "N/A",
    instructions:
      source.instructions ||
      source.description ||
      source.topic ||
      "No description provided.",
    submissionStatus:
      source.submissionStatus ||
      source.submission_status ||
      "Pending Submission",
  };
  const attachmentUrl = String(
    source.attachment_url || source.material || "",
  ).trim();
  const resolvedFileUrl = attachmentUrl
    ? resolveApiUrl(attachmentUrl)
    : "";
  const isImage = /\.(jpg|jpeg|png|webp|gif|bmp)(\?.*)?$/i.test(
    resolvedFileUrl,
  );
  const dueDate = dateFrom(source.submission_date || source.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = dueDate ? new Date(dueDate) : null;
  dueDay?.setHours(0, 0, 0, 0);
  const isOverdue = Boolean(dueDay && dueDay < today);
  const isDueToday = Boolean(dueDay && dueDay.getTime() === today.getTime());
  const submissionStatus = String(assignmentDetails.submissionStatus || "");
  const isEvaluated = submissionStatus.toLowerCase() === "evaluated";
  const submissionNotes =
    source.submission_text || source.submissionText || source.content || "";
  const message = buildShareMessage(assignmentDetails);
  const shareLink = `educampus360://share/homework/${assignmentDetails.id}`;

  const copyLink = async () => {
    setCopying(true);
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert("Link copied", "The homework link is ready to share.");
    } catch {
      Alert.alert("Unable to copy", "Please try sharing the assignment instead.");
    } finally {
      setCopying(false);
    }
  };

  const shareNative = async () => {
    await Share.share({ message, title: assignmentDetails.topic });
  };

  const shareWhatsApp = async () => {
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) await Linking.openURL(whatsappUrl);
    else await shareNative();
  };

  const previewAttachment = async () => {
    if (!resolvedFileUrl) return;
    if (isImage) {
      setPreviewOpen(true);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(resolvedFileUrl);
    } catch {
      await Linking.openURL(resolvedFileUrl);
    }
  };

  const downloadAttachment = async () => {
    if (!resolvedFileUrl || downloading) return;
    setDownloading(true);
    try {
      if (!FileSystem.cacheDirectory) {
        await WebBrowser.openBrowserAsync(resolvedFileUrl);
        return;
      }
      const safeName = `${assignmentDetails.subject}_${assignmentDetails.topic}`
        .replace(/[^a-z0-9_-]+/gi, "_")
        .slice(0, 80);
      const extension =
        resolvedFileUrl.split(/[?#]/)[0].match(/\.[a-z\d]{2,5}$/i)?.[0] ||
        ".file";
      const destination = `${FileSystem.cacheDirectory}${safeName}${extension}`;
      const result = await FileSystem.downloadAsync(
        resolvedFileUrl,
        destination,
      );
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`File download failed (${result.status}).`);
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          dialogTitle: "Save or share assignment file",
        });
      } else {
        await Linking.openURL(result.uri);
      }
    } catch (downloadError) {
      Alert.alert(
        "Unable to download file",
        downloadError instanceof Error
          ? downloadError.message
          : "Please try previewing the attachment.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const printAssignment = async () => {
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17175F;padding:24px"><h1>${escapeHtml(assignmentDetails.topic)}</h1><p>${escapeHtml(assignmentDetails.subject)} · Class ${escapeHtml(assignmentDetails.className)}</p><p>Assigned: ${escapeHtml(assignmentDetails.assignedDate)}<br/>Due: ${escapeHtml(assignmentDetails.dueDate)}<br/>Instructor: ${escapeHtml(assignmentDetails.instructor)}</p><h2>Instructions</h2><p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(assignmentDetails.instructions)}</p></body></html>`;
    try {
      await Print.printAsync({ html });
    } catch (printError) {
      Alert.alert(
        "Unable to print assignment",
        printError instanceof Error ? printError.message : "Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={17} color={colors.ink} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbText}>Homework</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.muted} />
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
              {assignmentDetails.subject}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Print assignment"
            style={styles.iconButton}
            onPress={printAssignment}
          >
            <Ionicons name="print-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroChips}>
            <Text style={styles.subjectChip}>{assignmentDetails.subject}</Text>
            <Text style={styles.classChip}>
              Class {assignmentDetails.className.replace(/^Class\s*/i, "")}
            </Text>
            <Text
              style={[
                styles.statusChip,
                isOverdue
                  ? styles.overdueChip
                  : isDueToday
                    ? styles.dueTodayChip
                    : styles.activeChip,
              ]}
            >
              {isOverdue ? "Overdue" : isDueToday ? "Due today" : "Active"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{assignmentDetails.topic}</Text>
          {assignmentDetails.schoolName !== "N/A" ? (
            <Text style={styles.schoolLine}>
              <Ionicons name="business-outline" size={13} color="#C8DBF2" />
              {" "}{assignmentDetails.schoolName}
            </Text>
          ) : null}
          <View style={styles.dateSummary}>
            <View style={styles.dateSummaryItem}>
              <Text style={styles.dateSummaryLabel}>Assigned</Text>
              <Text style={styles.dateSummaryValue}>
                {assignmentDetails.assignedDate}
              </Text>
            </View>
            <View style={styles.dateSummaryDivider} />
            <View style={styles.dateSummaryItem}>
              <Text style={styles.dateSummaryLabel}>Submission due</Text>
              <Text
                style={[
                  styles.dateSummaryValue,
                  isOverdue && styles.overdueDate,
                ]}
              >
                {assignmentDetails.dueDate}
              </Text>
            </View>
            {assignmentDetails.instructor !== "N/A" ? (
              <>
                <View style={styles.dateSummaryDivider} />
                <View style={styles.dateSummaryItem}>
                  <Text style={styles.dateSummaryLabel}>Instructor</Text>
                  <Text style={styles.dateSummaryValue} numberOfLines={1}>
                    {assignmentDetails.instructor}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Instructions & assignment details</Text>
          </View>
          <Text style={styles.instructions}>{assignmentDetails.instructions}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionAccent, styles.worksheetAccent]} />
            <Text style={styles.sectionTitle}>Worksheet & reference material</Text>
          </View>
          {resolvedFileUrl ? (
            <View style={styles.filePanel}>
              <View style={styles.fileInfo}>
                <View style={styles.fileIcon}>
                  <Ionicons
                    name={isImage ? "image-outline" : "document-text-outline"}
                    size={18}
                    color={colors.blue}
                  />
                </View>
                <View style={styles.fileCopy}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {assignmentDetails.subject}_Worksheet
                  </Text>
                  <Text style={styles.fileType}>
                    {isImage ? "Image attachment" : "Document attachment"}
                  </Text>
                </View>
              </View>
              <View style={styles.fileActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={previewAttachment}
                  style={styles.fileAction}
                >
                  <Ionicons name="eye-outline" size={15} color={colors.blue} />
                  <Text style={styles.fileActionText}>Preview</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={downloading}
                  onPress={downloadAttachment}
                  style={[styles.fileAction, downloading && styles.disabled]}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color={colors.green} />
                  ) : (
                    <Ionicons name="download-outline" size={15} color={colors.green} />
                  )}
                  <Text style={[styles.fileActionText, styles.downloadText]}>
                    {downloading ? "Preparing..." : "Download"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyAttachment}>
              <Ionicons name="document-outline" size={20} color={colors.muted} />
              <Text style={styles.emptyAttachmentTitle}>No attachment file</Text>
              <Text style={styles.emptyAttachmentText}>
                This assignment contains textual instructions only.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.submissionPanel}>
          <View style={styles.submissionCopy}>
            <Text style={styles.submissionEyebrow}>Your submission status</Text>
            <Text
              style={[
                styles.submissionStatus,
                isEvaluated ? styles.evaluatedText : styles.submissionPendingText,
              ]}
            >
              {submissionStatus}
            </Text>
            {isEvaluated ? (
              <Text style={styles.submissionDetail}>
                Marks: {source.marks_obtained ?? "Graded"} · Remarks: {source.teacher_remarks || "No remarks"}
              </Text>
            ) : submissionNotes ? (
              <Text style={styles.submissionDetail} numberOfLines={2}>
                Your notes have been submitted for evaluation.
              </Text>
            ) : (
              <Text style={styles.submissionDetail}>
                Complete and submit your work before the due date.
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.primaryButton}
            onPress={() =>
              router.push(
                `/homework-submission?assignment=${encodeURIComponent(
                  JSON.stringify({
                    ...source,
                    ...assignmentDetails,
                    target_student_id:
                      source.target_student_id || source.student_id || item.target_student_id,
                    submission_text: submissionNotes,
                    attachment_url:
                      source.attachment_url || source.material || null,
                  }),
                )}`,
              )
            }
          >
            <Ionicons
              name={submissionNotes ? "create-outline" : "arrow-up-circle-outline"}
              size={16}
              color={colors.white}
            />
            <Text style={styles.primaryButtonText}>
              {submissionNotes ? "Edit submission" : "Submit homework"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.shareSection}>
          <Text style={styles.shareTitle}>Share this assignment</Text>
          <View style={styles.shareActions}>
            <Pressable style={styles.shareButton} onPress={shareWhatsApp}>
              <Ionicons name="logo-whatsapp" size={15} color={colors.green} />
              <Text style={styles.shareButtonText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.shareButton} onPress={copyLink}>
              <Ionicons name="copy-outline" size={15} color={colors.blue} />
              <Text style={styles.shareButtonText}>
                {copying ? "Copying..." : "Copy Link"}
              </Text>
            </Pressable>
            <Pressable style={styles.shareButton} onPress={shareNative}>
              <Ionicons name="share-social-outline" size={15} color={colors.blue} />
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {assignmentDetails.subject} worksheet
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={() => setPreviewOpen(false)}
              style={styles.previewClose}
            >
              <Ionicons name="close" size={22} color={colors.white} />
            </Pressable>
          </View>
          <Image
            source={{ uri: resolvedFileUrl }}
            resizeMode="contain"
            style={styles.previewImage}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { color: colors.muted, fontSize: 12 },
  content: { padding: 14, paddingBottom: 24 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  backButton: {
    minWidth: 62,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  backText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  breadcrumb: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  breadcrumbText: { color: colors.muted, fontSize: 10 },
  breadcrumbCurrent: { flex: 1, color: colors.blue, fontSize: 10, fontWeight: "800" },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  heroChips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  subjectChip: {
    color: colors.navy,
    backgroundColor: "#DCEBFB",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  classChip: {
    color: colors.white,
    backgroundColor: "#2E5D91",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "800",
  },
  statusChip: {
    overflow: "hidden",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activeChip: { color: colors.green, backgroundColor: colors.paleGreen },
  overdueChip: { color: colors.red, backgroundColor: colors.paleRed },
  dueTodayChip: { color: colors.orange, backgroundColor: colors.paleOrange },
  heroTitle: {
    color: colors.white,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 11,
  },
  schoolLine: { color: "#C8DBF2", fontSize: 10, fontWeight: "700", marginTop: 5 },
  dateSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
    padding: 9,
    borderRadius: 6,
    backgroundColor: "#1D3566",
  },
  dateSummaryItem: { flex: 1, minWidth: 88, gap: 3 },
  dateSummaryDivider: { width: 1, height: 28, backgroundColor: "#52688B" },
  dateSummaryLabel: { color: "#AFC3DE", fontSize: 9, fontWeight: "700" },
  dateSummaryValue: { color: colors.white, fontSize: 10, fontWeight: "900" },
  overdueDate: { color: "#FFB5B5" },
  section: { marginBottom: 14 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 7 },
  sectionAccent: { width: 3, height: 15, borderRadius: 2, backgroundColor: colors.blue },
  worksheetAccent: { backgroundColor: colors.green },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  instructions: {
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    padding: 11,
    fontSize: 12,
    lineHeight: 18,
  },
  filePanel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    padding: 10,
    gap: 9,
  },
  fileInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paleBlue,
  },
  fileCopy: { flex: 1, minWidth: 0, gap: 2 },
  fileName: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  fileType: { color: colors.muted, fontSize: 9 },
  fileActions: { flexDirection: "row", gap: 7 },
  fileAction: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
  },
  fileActionText: { color: colors.blue, fontSize: 10, fontWeight: "800" },
  downloadText: { color: colors.green },
  disabled: { opacity: 0.6 },
  emptyAttachment: {
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 7,
    backgroundColor: colors.white,
    padding: 12,
  },
  emptyAttachmentTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  emptyAttachmentText: { color: colors.muted, fontSize: 10, textAlign: "center" },
  submissionPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.paleOrange,
    borderWidth: 1,
    borderColor: "#F5D98B",
    borderRadius: 7,
    padding: 11,
    marginBottom: 14,
  },
  submissionCopy: { flex: 1, minWidth: 170, gap: 3 },
  submissionEyebrow: { color: colors.orange, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  submissionStatus: { fontSize: 13, fontWeight: "900" },
  submissionPendingText: { color: colors.orange },
  evaluatedText: { color: colors.green },
  submissionDetail: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  primaryButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.orange,
    borderRadius: 6,
    paddingHorizontal: 11,
  },
  primaryButtonText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  shareSection: { marginBottom: 8 },
  shareTitle: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  shareActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 7 },
  shareButton: {
    flex: 1,
    minWidth: 95,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  shareButtonText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "#0B1020",
    paddingTop: 48,
    paddingBottom: 18,
  },
  previewHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  previewTitle: { flex: 1, color: colors.white, fontSize: 12, fontWeight: "800" },
  previewClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  previewImage: { flex: 1, width: "100%" },
  notFound: { flex: 1, padding: 20, justifyContent: "center", gap: 14 },
  notFoundTitle: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: "900", textAlign: "center" },
});
