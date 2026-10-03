import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { teacherApi } from "../services/teacherApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  canvas: "#F7F8FF",
  white: "#FFFFFF",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  green: "#334BD6",
  orange: "#D9822B",
  red: "#C65353",
};

const types = [
  "All",
  "Medical Leave",
  "Emergency",
  "Sick Leave",
  "Casual Leave",
];
const statuses = ["All", "Approved", "Pending", "Rejected", "Cancelled"];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function Select({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={[
          styles.select,
          label === "Absence category" && styles.categorySelect,
        ]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.selectText}>{value || "Select an option"}</Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.options} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option}
                style={styles.option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Summary({ title, value, label, icon, tint, accent }) {
  return (
    <View
      style={[styles.summary, { backgroundColor: tint, borderColor: accent }]}
    >
      <View style={[styles.summaryIcon, { backgroundColor: tint }]}>
        <Icon name={icon} color={accent} />
      </View>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function normalizeLeaveStatus(value) {
  const normalized = String(value || "Pending")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function calculateLeaveDays(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  return Math.max(1, Math.ceil((end - start) / 86400000) + 1);
}

function LeaveCard({ item, onView }) {
  return (
    <View
      style={[
        styles.card,
        item.status === "Approved"
          ? styles.approvedCard
          : item.status === "Rejected"
            ? styles.rejectedCard
            : styles.pendingCard,
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.serial}>
          {item.id.replace("leave-", "").padStart(2, "0")}
        </Text>

        <View style={styles.cardIdentity}>
          <Text style={styles.parent}>
            {item.parentName} <Text style={styles.role}>{item.role}</Text>
          </Text>
          <Text style={styles.reason}>{item.reason}</Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text
            style={[
              styles.status,
              item.status === "Approved" && styles.approved,
              item.status === "Rejected" && styles.rejected,
            ]}
          >
            {item.status}
          </Text>

          <Pressable
            accessibilityLabel={`View leave request for ${item.studentName}`}
            onPress={() => onView(item)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#E9F7F3",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#BFE3DB",
            }}
          >
            <Icon name="eye-outline" size={18} color={colors.blue} />
          </Pressable>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detail}>
          <Text style={styles.key}>Student: </Text>
          {item.studentName}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.key}>Type: </Text>
          {item.leaveType}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.key}>From: </Text>
          {item.from} <Text style={styles.key}>To: </Text>
          {item.to}
        </Text>
        {item.numberOfDays ? (
          <Text style={styles.detail}>
            <Text style={styles.key}>Number of days: </Text>
            {item.numberOfDays}
          </Text>
        ) : null}
        {item.appliedDate ? (
          <Text style={styles.detail}>
            <Text style={styles.key}>Applied date: </Text>
            {item.appliedDate}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DateField({ label, value, onPress }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.select} onPress={onPress}>
        <Text style={styles.selectText}>
          {value.toLocaleDateString("en-GB")}
        </Text>
        <Icon name="calendar-outline" color={colors.blue} />
      </Pressable>
    </View>
  );
}

export default function TeacherLeaveManagementScreen({ session }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("Request absence");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState("10");
  const [request, setRequest] = useState({
    category: "Medical Leave",
    from: new Date(),
    to: new Date(),
    reason: "",
    notes: "",
  });
  const [dateField, setDateField] = useState("");
  const [selectedLeave, setSelectedLeave] = useState(null);

  useEffect(() => {
    let active = true;

    const loadLeaves = async () => {
      setLoading(true);
      try {
        const payload = await teacherApi.getLeaves(session);
        if (active) {
          setRecords(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (active) {
          setRecords([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadLeaves();

    return () => {
      active = false;
    };
  }, [session]);

  const normalizedRecords = useMemo(
    () =>
      records.map((item, index) => ({
        ...item,
        id: String(
          item.id ||
            item.leave_id ||
            item.leaveId ||
            `${item.studentName || "leave"}-${index + 1}`,
        ),
        parentName: item.parentName || item.parent_name || "Parent",
        role: item.role || "Parent",
        reason: item.reason || item.comment || "No reason provided",
        studentName:
          item.studentName || item.student_name || item.student || "Student",
        leaveType:
          item.leaveType || item.leave_type || item.category || "Medical Leave",
        from: item.from || item.start_date || item.startDate || "",
        to: item.to || item.end_date || item.endDate || "",
        numberOfDays:
          item.numberOfDays ||
          item.number_of_days ||
          item.days ||
          calculateLeaveDays(
            item.from || item.start_date || item.startDate,
            item.to || item.end_date || item.endDate,
          ),
        appliedDate:
          item.appliedDate ||
          item.applied_date ||
          item.created_at ||
          item.createdAt ||
          "",
        status: normalizeLeaveStatus(item.status),
      })),
    [records],
  );

  const filtered = useMemo(
    () =>
      normalizedRecords.filter((item) => {
        const search = query.toLowerCase().trim();

        return (
          (!search ||
            [item.studentName, item.parentName, item.reason].some((value) =>
              value.toLowerCase().includes(search),
            )) &&
          (status === "All" || item.status === status) &&
          (type === "All" || item.leaveType === type)
        );
      }),
    [normalizedRecords, query, status, type],
  );

  const pending = normalizedRecords.filter(
    (item) => item.status === "Pending",
  ).length;
  const approved = normalizedRecords.filter(
    (item) => item.status === "Approved",
  ).length;
  const rejected = normalizedRecords.filter(
    (item) => item.status === "Rejected",
  ).length;
  const size = Number(perPage || 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * size, currentPage * size);

  const submitRequest = async () => {
    if (!request.reason.trim()) {
      Alert.alert("Reason required", "Please enter a reason for the absence.");
      return;
    }

    const formatRequestDate = (value) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    try {
      const created = await teacherApi.createLeaveRequest(
        {
          leave_type: request.category,
          start_date: formatRequestDate(request.from),
          end_date: formatRequestDate(request.to),
          reason: request.reason.trim(),
          notes: request.notes.trim(),
        },
        session,
      );

      const createdRecord = {
        ...(created && typeof created === "object" ? created : {}),
        parentName: created?.parentName || "You",
        role: created?.role || "Teacher",
        studentName: created?.studentName || "Faculty",
        leaveType: created?.leaveType || created?.category || request.category,
        from:
          created?.from ||
          created?.start_date ||
          formatRequestDate(request.from),
        to: created?.to || created?.end_date || formatRequestDate(request.to),
        reason: created?.reason || request.reason.trim(),
        status: normalizeLeaveStatus(created?.status),
        appliedDate:
          created?.appliedDate ||
          created?.applied_date ||
          created?.created_at ||
          new Date().toISOString(),
      };
      setRecords((current) => [
        {
          ...createdRecord,
          id:
            createdRecord.id ||
            createdRecord.leave_id ||
            createdRecord.leaveId ||
            `leave-${current.length + 1}`,
        },
        ...current,
      ]);

      setRequest({
        category: "Medical Leave",
        from: new Date(),
        to: new Date(),
        reason: "",
        notes: "",
      });
      setStatus("All");
      setPage(1);
      setSection("Pending Queue");
      Alert.alert("Request submitted", "Your absence request is now pending.");
    } catch {
      Alert.alert("Unable to submit request", "Please try again.");
    }
  };

  const openLeaveDetails = (item) => setSelectedLeave(item);
  const closeLeaveDetails = () => setSelectedLeave(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Leave Management</Text>
        <Text style={styles.subtitle}>Faculty & Student Absence Protocol</Text>
      </View>

      <View style={styles.topTabs}>
        <Pressable
          style={[
            styles.topTab,
            section === "Request absence" && styles.activeTab,
          ]}
          onPress={() => setSection("Request absence")}
        >
          <Text style={styles.tabText}>Request absence</Text>
        </Pressable>
        <Pressable
          style={[
            styles.topTab,
            section === "Pending Queue" && styles.activeTab,
          ]}
          onPress={() => setSection("Pending Queue")}
        >
          <Text style={styles.tabText}>Pending Queue</Text>
        </Pressable>
      </View>

      <View style={styles.summaryGrid}>
        <Summary
          title="Pending Queue"
          value={pending}
          label="REQUIRES ACTION"
          icon="time-outline"
          tint="#FFF1DF"
          accent={colors.orange}
        />
        <Summary
          title="Approved Today"
          value={approved}
          label="SYNCED SUCCESS"
          icon="checkmark-circle-outline"
          tint={colors.paleBlue}
          accent={colors.green}
        />
        <Summary
          title="Rejection Rate"
          value={rejected}
          label="AUDIT DENIED"
          icon="close-circle-outline"
          tint="#FDECEC"
          accent={colors.red}
        />
        <Summary
          title="Total Volume"
          value={records.length}
          label="SYSTEM HISTORY"
          icon="list-outline"
          tint={colors.paleBlue}
          accent={colors.blue}
        />
      </View>

      {section === "Request absence" ? (
        <View style={styles.requestBox}>
          <Text style={styles.sectionTitle}>Request absence</Text>

          <Select
            label="Absence category"
            value={request.category}
            options={types.slice(1)}
            onChange={(value) =>
              setRequest((current) => ({ ...current, category: value }))
            }
          />

          <DateField
            label="Start date"
            value={request.from}
            onPress={() => setDateField("from")}
          />
          {dateField === "from" ? (
            <DateTimePicker
              value={request.from}
              mode="date"
              onChange={(_, value) => {
                setDateField("");
                if (value) {
                  setRequest((current) => ({ ...current, from: value }));
                }
              }}
            />
          ) : null}

          <DateField
            label="End date"
            value={request.to}
            onPress={() => setDateField("to")}
          />
          {dateField === "to" ? (
            <DateTimePicker
              value={request.to}
              mode="date"
              onChange={(_, value) => {
                setDateField("");
                if (value) {
                  setRequest((current) => ({ ...current, to: value }));
                }
              }}
            />
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput
              value={request.reason}
              onChangeText={(value) =>
                setRequest((current) => ({ ...current, reason: value }))
              }
              multiline
              style={styles.textarea}
              placeholder="Explain the leave reason"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              value={request.notes}
              onChangeText={(value) =>
                setRequest((current) => ({ ...current, notes: value }))
              }
              multiline
              style={styles.textarea}
              placeholder="Optional notes"
              placeholderTextColor={colors.muted}
            />
          </View>

          <Pressable style={styles.submitButton} onPress={submitRequest}>
            <Text style={styles.submitText}>Submit leave request</Text>
          </Pressable>
        </View>
      ) : null}

      {section === "Pending Queue" ? (
        <View style={styles.listWrap}>
          <View style={styles.filterGrid}>
            <Select
              label="Status"
              value={status}
              options={statuses}
              onChange={setStatus}
            />
            <Select
              label="Leave type"
              value={type}
              options={types}
              onChange={setType}
            />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholder="Search by student or reason"
              placeholderTextColor={colors.muted}
            />
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Loading leave requests...</Text>
          ) : visible.length ? (
            visible.map((item) => (
              <LeaveCard key={item.id} item={item} onView={openLeaveDetails} />
            ))
          ) : (
            <Text style={styles.emptyText}>
              No leave requests match the selected filters.
            </Text>
          )}

          <View style={styles.pagination}>
            <Pressable
              disabled={currentPage <= 1}
              onPress={() => setPage((value) => Math.max(1, value - 1))}
            >
              <Text
                style={[
                  styles.pageButton,
                  currentPage <= 1 && styles.pageDisabled,
                ]}
              >
                Prev
              </Text>
            </Pressable>
            <Text style={styles.pageMeta}>
              Page {currentPage} / {totalPages}
            </Text>
            <Pressable
              disabled={currentPage >= totalPages}
              onPress={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              <Text
                style={[
                  styles.pageButton,
                  currentPage >= totalPages && styles.pageDisabled,
                ]}
              >
                Next
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {selectedLeave ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={closeLeaveDetails}
        >
          <Pressable style={styles.backdrop} onPress={closeLeaveDetails}>
            <View style={styles.modal} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Leave Details</Text>
              <Text style={styles.modalText}>
                Student: {selectedLeave.studentName}
              </Text>
              <Text style={styles.modalText}>
                Parent: {selectedLeave.parentName}
              </Text>
              <Text style={styles.modalText}>
                Type: {selectedLeave.leaveType}
              </Text>
              <Text style={styles.modalText}>From: {selectedLeave.from}</Text>
              <Text style={styles.modalText}>To: {selectedLeave.to}</Text>
              <Text style={styles.modalText}>
                Reason: {selectedLeave.reason}
              </Text>
              <Text style={styles.modalText}>
                Status: {selectedLeave.status}
              </Text>

              <Pressable style={styles.closeButton} onPress={closeLeaveDetails}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 120 },
  header: { marginBottom: 16 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 5 },
  topTabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  topTab: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: { backgroundColor: colors.paleBlue, borderColor: colors.blue },
  tabText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  summary: {
    width: "48%",
    minHeight: 120,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 11,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
  summaryLabel: { color: colors.muted, fontSize: 9, marginTop: 4 },
  requestBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 12,
  },
  field: { marginBottom: 11 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  select: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  categorySelect: { backgroundColor: "#FFF3D9", borderColor: "#D9A441" },
  selectText: { color: colors.ink, fontSize: 12, flex: 1 },
  textarea: {
    minHeight: 86,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: "top",
    color: colors.ink,
  },
  submitButton: {
    backgroundColor: colors.blue,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: colors.white, fontWeight: "800" },
  listWrap: { paddingBottom: 20 },
  filterGrid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 42,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 12,
  },
  pendingCard: { backgroundColor: "#FFF8EA", borderColor: "#EBCB92" },
  approvedCard: { backgroundColor: "#EAF8F2", borderColor: "#A9D6C9" },
  rejectedCard: { backgroundColor: "#FFF0F0", borderColor: "#E5B2B2" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  serial: { color: colors.blue, fontWeight: "900", minWidth: 24 },
  cardIdentity: { flex: 1 },
  parent: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  role: { fontSize: 11, fontWeight: "700", color: colors.muted },
  reason: { color: colors.muted, fontSize: 11, marginTop: 4 },
  status: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#F4F7F7",
    color: colors.ink,
  },
  approved: { backgroundColor: colors.paleBlue, color: colors.green },
  rejected: { backgroundColor: "#FDECEC", color: colors.red },
  details: { marginTop: 10, gap: 4 },
  detail: { color: colors.ink, fontSize: 12 },
  key: { color: colors.muted, fontWeight: "700" },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pageButton: { color: colors.blue, fontWeight: "800" },
  pageDisabled: { color: colors.muted },
  pageMeta: { color: colors.ink, fontWeight: "700", fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 20, 22, 0.35)",
    justifyContent: "flex-end",
  },
  options: {
    backgroundColor: colors.white,
    padding: 17,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "75%",
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionText: { color: colors.ink, fontSize: 13 },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  modalText: { color: colors.ink, fontSize: 13, marginBottom: 6 },
  closeButton: {
    marginTop: 14,
    backgroundColor: colors.blue,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeText: { color: colors.white, fontWeight: "800" },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
