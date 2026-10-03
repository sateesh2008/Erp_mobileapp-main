import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { dateKey, gatePassApi } from "../services/gatePassApi";
import TeacherGatePassForm from "./TeacherGatePassForm";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  canvas: "#F7F8FF",
  white: "#FFFFFF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  teal: "#334BD6",
  orange: "#D9822B",
  red: "#C65353",
};
const statusLabels = {
  ISSUED: "ISSUED (PENDING EXIT)",
  OUT: "OUT (LEFT CAMPUS)",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED",
};
const statusOptions = [
  "All Passes",
  "Pending Exit",
  "Currently Out",
  "Returned",
  "Overdue",
  "Cancelled",
  "One-Way Exit",
];
const reasons = [
  "Emergency",
  "Medical / Sickness",
  "Family Function",
  "Personal Work",
  "Other",
];
const escorts = ["Parent", "Guardian", "Staff", "Other"];
const formatDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const formatTime = (value) => {
  if (!value) return "N/A";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const isPendingExit = (record) =>
  record.status === "ISSUED" && !record.exitTime;
const isCurrentlyOut = (record) =>
  Boolean(record.exitTime) &&
  !record.returnTime &&
  Boolean(record.returnRequired) &&
  record.status !== "RETURNED";
const isOverdue = (record) =>
  isCurrentlyOut(record) &&
  record.expectedReturnTime &&
  `${record.date}T${record.expectedReturnTime}` <
    new Date().toISOString().slice(0, 16);
const isReturned = (record) =>
  record.status === "RETURNED" || Boolean(record.returnTime);
const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const htmlEscape = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
let summaryCardHandler = () => {};
let clearSummaryCardHandler = () => {};
let activeSummaryCard = "";
const summaryFilterKey = {
  "Pending Exit": "Pending Exit",
  "Currently Out": "Currently Out",
  "Overdue Returns": "Overdue",
  "Returned Safely": "Returned",
};

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function SelectField({ label, value, placeholder, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View
            style={styles.optionSheet}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                key={option}
                style={styles.option}
                onPress={() => {
                  onChange(option);
                  if (label === "Status & Return Filter")
                    clearSummaryCardHandler();
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === option && styles.optionActive,
                  ]}
                >
                  {option}
                </Text>
                {value === option ? (
                  <Icon name="checkmark" size={18} color={colors.blue} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionButton({ title, icon, onPress, secondary }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        name={icon}
        size={16}
        color={secondary ? colors.blue : colors.white}
      />
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function SummaryCard({ label, value, icon, tint, accent }) {
  const filterKey = summaryFilterKey[label];
  const active = activeSummaryCard === filterKey;
  return (
    <Pressable
      onPress={() => summaryCardHandler(filterKey)}
      style={({ pressed }) => [
        styles.summaryCard,
        { backgroundColor: tint },
        active && {
          borderColor: colors.blue,
          borderWidth: 2,
          backgroundColor: colors.paleBlue,
          elevation: 3,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.summaryIcon,
          { backgroundColor: active ? colors.white : tint },
        ]}
      >
        <Icon name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      {active ? (
        <View
          style={{
            height: 3,
            backgroundColor: colors.blue,
            borderRadius: 3,
            marginTop: 6,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function GatePassCard({ record, index, onSlip, onExit, onReturn }) {
  const canExit = record.status === "ISSUED";
  const canReturn = isCurrentlyOut(record);
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={styles.recordIndex}>
          <Text style={styles.recordIndexText}>
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
        <View style={styles.recordIdentity}>
          <Text style={styles.passNumber}>{record.passNumber}</Text>
          <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            record.status === "OUT" && styles.outBadge,
            record.status === "RETURNED" && styles.returnedBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {statusLabels[record.status] || record.status}
          </Text>
        </View>
      </View>
      <View style={styles.studentRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {record.studentName?.charAt(0) || "?"}
          </Text>
        </View>
        <View style={styles.studentCopy}>
          <Text style={styles.studentName}>{record.studentName}</Text>
          <Text style={styles.studentMeta}>
            {record.className}-{record.section} | Roll:{" "}
            {record.rollNumber || "N/A"}
          </Text>
          <Text style={styles.studentMeta}>
            {formatTime(record.issueTime)} ({formatDate(record.date)})
          </Text>
        </View>
      </View>
      <View style={styles.detailGrid}>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>Reason: </Text>
          {record.reason}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>Escort: </Text>
          {record.escortType}: {record.escortName}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>Pass: </Text>
          {record.passType === "ONE_WAY" ? "One-Way Exit" : "Returnable"}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailKey}>Return: </Text>
          {record.returnRequired
            ? `By ${formatTime(record.expectedReturnTime)}`
            : "No return expected"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={styles.outlineAction} onPress={() => onSlip(record)}>
          <Icon name="document-text-outline" size={16} color={colors.blue} />
          <Text style={styles.outlineText}>Slip</Text>
        </Pressable>
        {canExit ? (
          <Pressable style={styles.primarySmall} onPress={() => onExit(record)}>
            <Icon name="log-out-outline" size={16} color={colors.white} />
            <Text style={styles.primarySmallText}>Exit</Text>
          </Pressable>
        ) : null}
        {canReturn ? (
          <Pressable
            style={styles.returnAction}
            onPress={() => onReturn(record)}
          >
            <Icon
              name="return-down-back-outline"
              size={16}
              color={colors.white}
            />
            <Text style={styles.primarySmallText}>Return</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function TeacherGatePassScreen({ session }) {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Passes");
  const [cardFilter, setCardFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState("10");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const selectedDateKey = dateKey(selectedDate);
  const selectedClass = classes.find((item) => item.name === classFilter);
  const selectedDivision = divisions.find(
    (item) => (item.name || item.label || item.division_name) === sectionFilter,
  );
  const load = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const activeStatus = cardFilter || statusFilter;
      const status = [
        "ISSUED",
        "CHECKED_OUT",
        "RETURNED",
        "CANCELLED",
      ].includes(activeStatus)
        ? activeStatus
        : undefined;
      const [nextRecords, nextStats, nextClasses] = await Promise.all([
        gatePassApi.list(session, {
          date: selectedDateKey,
          class_id: selectedClass?.id,
          division_id: selectedDivision?.id,
          status,
          search: query.trim(),
        }),
        gatePassApi.stats(session),
        classes.length
          ? Promise.resolve(classes)
          : gatePassApi.getClasses(session),
      ]);
      setRecords(nextRecords);
      setStats(nextStats || {});
      setClasses(nextClasses || []);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Unable to load gate passes. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => clearTimeout(timer);
  }, [
    session,
    selectedDateKey,
    classFilter,
    sectionFilter,
    statusFilter,
    cardFilter,
    query,
  ]);
  useEffect(() => {
    if (!selectedClass?.id) return undefined;
    let active = true;
    const loadClassData = async () => {
      try {
        const [nextDivisions, nextStudents] = await Promise.all([
          gatePassApi.getDivisions(selectedClass.id, session),
          gatePassApi.getStudents(selectedClass.id, session),
        ]);
        if (active) {
          setDivisions(nextDivisions);
          setStudents(nextStudents);
        }
      } catch (requestError) {
        if (active)
          setError(
            requestError?.message ||
              "Unable to load class divisions and students.",
          );
      }
    };
    void loadClassData();
    return () => {
      active = false;
    };
  }, [classFilter, session]);
  useEffect(() => {
    if (!showForm || students.length || !classes.length) return undefined;
    let active = true;
    const loadFormStudents = async () => {
      try {
        const result = await Promise.all(
          classes.map((item) => gatePassApi.getStudents(item.id, session)),
        );
        if (active) setStudents(result.flat());
      } catch (requestError) {
        if (active)
          setError(requestError?.message || "Unable to load active students.");
      }
    };
    void loadFormStudents();
    return () => {
      active = false;
    };
  }, [showForm, students.length, classes, session]);
  const classOptions = classes
    .map((item) => item.name || item.label)
    .filter(Boolean);
  const sectionOptions = divisions
    .map((item) => item.name || item.label || item.division_name)
    .filter(Boolean);
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const search = query.trim().toLowerCase();
        const matchesSearch =
          !search ||
          [
            record.studentName,
            record.passNumber,
            record.admissionNumber,
            record.className,
            record.section,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search),
          );
        const activeStatus = cardFilter || statusFilter;
        const statusMatch =
          activeStatus === "All Passes" ||
          (activeStatus === "Pending Exit" && isPendingExit(record)) ||
          (activeStatus === "Currently Out" && isCurrentlyOut(record)) ||
          (activeStatus === "Returned" && isReturned(record)) ||
          (activeStatus === "Overdue" && isOverdue(record)) ||
          (activeStatus === "Cancelled" && record.status === "CANCELLED") ||
          (activeStatus === "One-Way Exit" && record.passType === "ONE_WAY");
        return (
          record.date === selectedDateKey &&
          (!classFilter || record.className === classFilter) &&
          (!sectionFilter || record.section === sectionFilter) &&
          matchesSearch &&
          statusMatch
        );
      }),
    [
      records,
      selectedDateKey,
      classFilter,
      sectionFilter,
      query,
      statusFilter,
      cardFilter,
    ],
  );
  const pageSize = Number(perPage);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const todayRecords = records.filter((record) => record.date === dateKey());
  const counts = {
    today: Number(stats.today_total ?? todayRecords.length) || 0,
    pending:
      Number(stats.today_issued ?? todayRecords.filter(isPendingExit).length) ||
      0,
    out:
      Number(
        stats.today_checked_out ?? records.filter(isCurrentlyOut).length,
      ) || 0,
    overdue:
      Number(stats.overdue_count ?? records.filter(isOverdue).length) || 0,
    returned:
      Number(stats.today_returned ?? records.filter(isReturned).length) || 0,
  };
  const toggleCardFilter = (value) => {
    const nextValue = cardFilter === value ? "" : value;
    setCardFilter(nextValue);
    setStatusFilter("All Passes");
    setPage(1);
  };
  const clearCardFilter = () => {
    setCardFilter("");
    setStatusFilter("All Passes");
    setPage(1);
  };
  useEffect(() => {
    summaryCardHandler = toggleCardFilter;
    clearSummaryCardHandler = clearCardFilter;
    activeSummaryCard = cardFilter;
  }, [cardFilter]);
  const showError = (message) =>
    Alert.alert("Gate pass action unavailable", message || "Please try again.");
  const updateRecord = async (record, action) => {
    setActionLoading(true);
    try {
      await gatePassApi[action](record.id, session);
      await load(true);
      Alert.alert(
        action === "exit" ? "Exit recorded" : "Return recorded",
        `${record.studentName} status has been updated.`,
      );
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  const issuePass = async (newForm) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const classRecord = classes.find(
        (item) => (item.name || item.label) === newForm.className,
      );
      const student = students.find(
        (item) => String(item.id) === String(newForm.studentId),
      );
      await gatePassApi.create(
        {
          ...newForm,
          classId: classRecord?.id || student?.classId,
          divisionId: student?.divisionId,
          isOneWay: newForm.passType === "ONE_WAY",
          outTime: `${newForm.date}T${newForm.issueTime}`,
          expectedReturnTime: newForm.returnRequired
            ? `${newForm.date}T${newForm.expectedReturnTime || "17:00"}`
            : null,
        },
        session,
      );
      setShowForm(false);
      await load(true);
      Alert.alert("Gate pass issued", "The new gate pass is ready for exit.");
    } catch (err) {
      showError(err.message);
    } finally {
      setActionLoading(false);
    }
  };
  const exportCsv = async () => {
    if (!filteredRecords.length) {
      Alert.alert(
        "Nothing to export",
        "No gate passes match the current filters.",
      );
      return;
    }
    const headers = [
      "Pass Number",
      "Date",
      "Student Name",
      "Class",
      "Section",
      "Roll Number",
      "Time",
      "Reason",
      "Escort",
      "Pass Type",
      "Return Requirement",
      "Status",
    ];
    const rows = filteredRecords.map((record) => [
      record.passNumber,
      record.date,
      record.studentName,
      record.className,
      record.section,
      record.rollNumber || "N/A",
      record.issueTime,
      record.reason,
      `${record.escortType}: ${record.escortName}`,
      record.passType === "ONE_WAY" ? "One-Way Exit" : "Returnable",
      record.returnRequired ? record.expectedReturnTime : "No return expected",
      statusLabels[record.status] || record.status,
    ]);
    try {
      await Share.share({
        title: "Gate Pass CSV",
        message: [headers, ...rows]
          .map((row) => row.map(csvEscape).join(","))
          .join("\n"),
      });
    } catch {
      showError("Unable to open the share sheet.");
    }
  };
  const slipHtml = (items) =>
    `<html><head><style>body{font-family:Arial;color:#17175F;margin:24px}.slip{border:1px solid #D9DDF2;border-radius:10px;padding:18px;margin-bottom:18px;page-break-inside:avoid}.brand{font-size:12px;color:#1E32CC;font-weight:bold}.title{font-size:20px;font-weight:bold;margin:8px 0 16px}.row{margin:7px 0;font-size:12px}.key{font-weight:bold;color:#596080}.status{margin-top:14px;padding:9px;background:#EEF0FC;font-weight:bold}</style></head><body>${items.map((record) => `<section class="slip"><div class="brand">IDPS Madanapalle</div><div class="title">Student Gate Pass</div><div class="row"><span class="key">Pass Number:</span> ${htmlEscape(record.passNumber)}</div><div class="row"><span class="key">Student:</span> ${htmlEscape(record.studentName)}</div><div class="row"><span class="key">Class & Section:</span> ${htmlEscape(record.className)}-${htmlEscape(record.section)}</div><div class="row"><span class="key">Roll Number:</span> ${htmlEscape(record.rollNumber || "N/A")}</div><div class="row"><span class="key">Date / Issue Time:</span> ${htmlEscape(formatDate(record.date))} / ${htmlEscape(formatTime(record.issueTime))}</div><div class="row"><span class="key">Reason:</span> ${htmlEscape(record.reason)}</div><div class="row"><span class="key">Escort:</span> ${htmlEscape(record.escortType)}: ${htmlEscape(record.escortName)}</div><div class="row"><span class="key">Pass Type:</span> ${record.passType === "ONE_WAY" ? "One-Way Exit" : "Returnable"}</div><div class="row"><span class="key">Return:</span> ${record.returnRequired ? htmlEscape(formatTime(record.expectedReturnTime)) : "No return expected"}</div><div class="status">${htmlEscape(statusLabels[record.status] || record.status)}</div></section>`).join("")}</body></html>`;
  const printPdf = async (items, title) => {
    if (!items.length) {
      Alert.alert(
        "Nothing to print",
        "No gate passes match the current filters.",
      );
      return;
    }
    try {
      if (Platform.OS === "web") {
        await Print.printAsync({ html: slipHtml(items) });
        return;
      }
      const result = await Print.printToFileAsync({ html: slipHtml(items) });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: title,
        });
      else await Share.share({ title, message: result.uri });
    } catch {
      showError("Unable to generate the PDF.");
    }
  };
  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.blue}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.title}>Student Gate Pass & Out-Pass Console</Text>
          <Text style={styles.description}>
            Issue authorized campus exit slips, monitor real-time departures &
            student returns, and manage out-pass compliance.
          </Text>
        </View>
        <View style={styles.actionRow}>
          <ActionButton
            title="Export CSV"
            icon="download-outline"
            onPress={exportCsv}
            secondary
          />
          <ActionButton
            title="Bulk PDF (2/Page)"
            icon="document-outline"
            onPress={() => printPdf(filteredRecords, "Gate Passes")}
            secondary
          />
          <ActionButton
            title="Issue Gate Pass"
            icon="add"
            onPress={() => setShowForm(true)}
          />
        </View>
        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Today's Passes"
            value={counts.today}
            icon="calendar-outline"
            tint={colors.paleBlue}
            accent={colors.blue}
          />
          <SummaryCard
            label="Pending Exit"
            value={counts.pending}
            icon="time-outline"
            tint="#FFF1DF"
            accent={colors.orange}
          />
          <SummaryCard
            label="Currently Out"
            value={counts.out}
            icon="log-out-outline"
            tint="#FDECEC"
            accent={colors.red}
          />
          <SummaryCard
            label="Overdue Returns"
            value={counts.overdue}
            icon="alert-circle-outline"
            tint="#FDECEC"
            accent={colors.red}
          />
          <SummaryCard
            label="Returned Safely"
            value={counts.returned}
            icon="checkmark-circle-outline"
            tint={colors.paleTeal}
            accent={colors.teal}
          />
        </View>
        <View style={styles.filterCard}>
          <Text style={styles.sectionTitle}>Filter gate passes</Text>
          <View style={styles.filterGrid}>
            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <Pressable
                style={styles.select}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.selectText}>
                  {formatDate(selectedDateKey)}
                </Text>
                <Icon name="calendar-outline" size={16} color={colors.blue} />
              </Pressable>
            </View>
            <SelectField
              label="Class"
              value={classFilter}
              placeholder="Select an option"
              options={classOptions}
              onChange={(value) => {
                setClassFilter(value);
                setSectionFilter("");
              }}
            />
            <SelectField
              label="Section"
              value={sectionFilter}
              placeholder="Select an option"
              options={sectionOptions}
              onChange={setSectionFilter}
            />
            <SelectField
              label="Status & Return Filter"
              value={statusFilter}
              placeholder="All Passes"
              options={statusOptions}
              onChange={setStatusFilter}
            />
          </View>
          {showDatePicker ? (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              onChange={(_, value) => {
                setShowDatePicker(false);
                if (value) setSelectedDate(value);
              }}
            />
          ) : null}
          <View style={styles.searchWrap}>
            <Icon name="search-outline" size={17} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search student / pass #..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
        </View>
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.blue} />
            <Text style={styles.stateText}>Loading gate passes...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => load()}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : visibleRecords.length ? (
          <View>
            <Text style={styles.resultHeading}>Filtered Gate Passes</Text>
            {visibleRecords.map((record, index) => (
              <GatePassCard
                key={record.id || record.passNumber}
                record={record}
                index={(currentPage - 1) * pageSize + index}
                onSlip={(item) =>
                  printPdf([item], `Gate Pass ${item.passNumber}`)
                }
                onExit={(item) =>
                  Alert.alert(
                    "Confirm Student Exit",
                    `${item.studentName} is leaving the campus.\n\nDo you want to record the exit now?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm Exit",
                        onPress: () => updateRecord(item, "exit"),
                      },
                    ],
                  )
                }
                onReturn={(item) =>
                  Alert.alert(
                    "Confirm Student Return",
                    "Has this student safely returned to campus?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Confirm Return",
                        onPress: () => updateRecord(item, "returnPass"),
                      },
                    ],
                  )
                }
              />
            ))}
            <View style={styles.pagination}>
              <Text style={styles.paginationText}>
                Showing {(currentPage - 1) * pageSize + 1} -{" "}
                {Math.min(currentPage * pageSize, filteredRecords.length)} of{" "}
                {filteredRecords.length} entries
              </Text>
              <View style={styles.pageControls}>
                <Text style={styles.paginationText}>Per page</Text>
                <SelectField
                  label="Per page"
                  value={perPage}
                  placeholder="10"
                  options={["5", "10", "20"]}
                  onChange={setPerPage}
                />
                <Pressable
                  disabled={currentPage <= 1}
                  onPress={() => setPage((value) => value - 1)}
                  style={styles.pageButton}
                >
                  <Icon
                    name="chevron-back"
                    size={16}
                    color={currentPage <= 1 ? colors.line : colors.blue}
                  />
                </Pressable>
                <Text style={styles.paginationText}>
                  {currentPage}/{pageCount}
                </Text>
                <Pressable
                  disabled={currentPage >= pageCount}
                  onPress={() => setPage((value) => value + 1)}
                  style={styles.pageButton}
                >
                  <Icon
                    name="chevron-forward"
                    size={16}
                    color={currentPage >= pageCount ? colors.line : colors.blue}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.empty}>
            <Icon name="document-text-outline" size={30} color={colors.blue} />
            <Text style={styles.emptyTitle}>No gate passes found.</Text>
            <Text style={styles.emptyText}>
              Try changing the filters or issue a new gate pass.
            </Text>
            <ActionButton
              title="Issue Gate Pass"
              icon="add"
              onPress={() => setShowForm(true)}
            />
          </View>
        )}
      </ScrollView>
      <TeacherGatePassForm
        visible={showForm}
        students={students}
        classes={classOptions}
        loading={actionLoading}
        onClose={() => setShowForm(false)}
        onSubmit={issuePass}
      />
    </View>
  );
}

function GatePassForm({
  visible,
  form,
  students,
  onClose,
  onStudent,
  onChange,
  onSubmit,
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={styles.formScreen}
        contentContainerStyle={styles.formContent}
      >
        <View style={styles.formHeader}>
          <Text style={styles.modalTitle}>Issue Gate Pass</Text>
          <Pressable onPress={onClose}>
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <SelectField
          label="Student"
          value={
            students.find((student) => student.id === form.studentId)?.name
          }
          placeholder="Select a student"
          options={students.map((student) => student.name)}
          onChange={(name) =>
            onStudent(students.find((student) => student.name === name)?.id)
          }
        />
        <View style={styles.filterGrid}>
          <View style={styles.half}>
            <Text style={styles.label}>Class</Text>
            <Text style={styles.readonly}>
              {form.className || "Selected from student"}
            </Text>
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Section</Text>
            <Text style={styles.readonly}>
              {form.section || "Selected from student"}
            </Text>
          </View>
        </View>
        <SelectField
          label="Reason"
          value={form.reason}
          placeholder="Select reason"
          options={reasons}
          onChange={(value) => onChange("reason", value)}
        />
        <SelectField
          label="Escort Type"
          value={form.escortType}
          placeholder="Select escort type"
          options={escorts}
          onChange={(value) => onChange("escortType", value)}
        />
        <View style={styles.field}>
          <Text style={styles.label}>Escort Name</Text>
          <TextInput
            value={form.escortName}
            onChangeText={(value) => onChange("escortName", value)}
            placeholder="Enter escort name"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <SelectField
          label="Pass Type"
          value={form.passType === "ONE_WAY" ? "One-Way Exit" : "Returnable"}
          placeholder="Select pass type"
          options={["One-Way Exit", "Returnable"]}
          onChange={(value) =>
            onChange(
              "passType",
              value === "One-Way Exit" ? "ONE_WAY" : "RETURNABLE",
            )
          }
        />
        <Pressable
          style={styles.checkRow}
          onPress={() => onChange("returnRequired", !form.returnRequired)}
        >
          <Icon
            name={form.returnRequired ? "checkbox" : "square-outline"}
            size={21}
            color={colors.blue}
          />
          <Text style={styles.checkText}>Return required</Text>
        </Pressable>
        {form.returnRequired ? (
          <View style={styles.field}>
            <Text style={styles.label}>Expected Return Time</Text>
            <TextInput
              value={form.expectedReturnTime}
              onChangeText={(value) => onChange("expectedReturnTime", value)}
              placeholder="17:00"
              style={styles.input}
            />
          </View>
        ) : null}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={form.notes}
            onChangeText={(value) => onChange("notes", value)}
            placeholder="Optional notes"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.notes]}
            multiline
          />
        </View>
        <ActionButton
          title="Issue Gate Pass"
          icon="checkmark"
          onPress={onSubmit}
        />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 20, paddingBottom: 120 },
  heading: { marginBottom: 16 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 },
  description: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.blue,
    borderRadius: 9,
    paddingHorizontal: 12,
    minHeight: 42,
    flexGrow: 1,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  secondaryText: { color: colors.blue },
  pressed: { opacity: 0.72 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    width: "31.5%",
    minHeight: 110,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 10,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 12,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  field: { flex: 1, minWidth: "46%", marginBottom: 10 },
  half: { flex: 1, minWidth: "46%" },
  label: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
  select: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
  },
  selectText: { color: colors.ink, fontSize: 12, flex: 1 },
  placeholder: { color: colors.muted },
  searchWrap: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 5,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12, marginLeft: 8 },
  resultHeading: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  recordCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
  },
  recordTop: { flexDirection: "row", alignItems: "center" },
  recordIndex: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  recordIndexText: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  recordIdentity: { flex: 1, marginLeft: 9 },
  passNumber: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  recordDate: { color: colors.muted, fontSize: 10, marginTop: 3 },
  statusBadge: {
    backgroundColor: "#FFF1DF",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    maxWidth: 145,
  },
  outBadge: { backgroundColor: "#FDECEC" },
  returnedBadge: { backgroundColor: colors.paleTeal },
  statusText: {
    color: colors.ink,
    fontSize: 8,
    fontWeight: "900",
    textAlign: "center",
  },
  studentRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: "900" },
  studentCopy: { flex: 1, marginLeft: 10 },
  studentName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  studentMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  detailGrid: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 13,
    paddingTop: 10,
    gap: 6,
  },
  detail: { color: colors.muted, fontSize: 11 },
  detailKey: { color: colors.ink, fontWeight: "800" },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 13,
  },
  outlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  outlineText: { color: colors.blue, fontSize: 11, fontWeight: "900" },
  primarySmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.blue,
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  returnAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.teal,
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  primarySmallText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  pagination: { marginTop: 5, gap: 10 },
  pageControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  paginationText: { color: colors.muted, fontSize: 11 },
  pageButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    padding: 6,
  },
  state: { alignItems: "center", gap: 10, padding: 40 },
  stateText: { color: colors.muted, fontSize: 12 },
  errorBox: {
    backgroundColor: "#FDECEC",
    borderRadius: 10,
    padding: 18,
    alignItems: "center",
  },
  errorText: { color: colors.red, fontSize: 12, textAlign: "center" },
  retry: { color: colors.blue, fontSize: 12, fontWeight: "900", marginTop: 10 },
  empty: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 25,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    marginVertical: 8,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 31, 0.35)",
    justifyContent: "flex-end",
  },
  optionSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 17,
    maxHeight: "75%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 14,
  },
  optionText: { color: colors.ink, fontSize: 13 },
  optionActive: { color: colors.blue, fontWeight: "900" },
  formScreen: { flex: 1, backgroundColor: colors.canvas },
  formContent: { padding: 20, paddingBottom: 40 },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  readonly: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    color: colors.muted,
    fontSize: 12,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 11,
    color: colors.ink,
    fontSize: 12,
    backgroundColor: colors.white,
  },
  notes: { minHeight: 80, textAlignVertical: "top", paddingTop: 11 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  checkText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
});
