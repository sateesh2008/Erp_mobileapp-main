import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import TeacherBiometricSuite from "../components/TeacherBiometricSuite";
import { ApiError } from "../services/api";
import { teacherAttendanceApi } from "../services/teacherApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  green: "#1E8E5E",
  paleGreen: "#E8F8F1",
  red: "#B94E4E",
  paleRed: "#FDECEC",
  orange: "#A76E00",
  paleOrange: "#FFF7DF",
};

const tabs = [
  "Attendance Control",
  "Daily Log / Marking",
  "History Log",
  "Biometric",
  "Export",
  "Submit Attendance",
];
const statuses = ["Present", "Absent", "Late", "Half Day", "Unmarked"];
const emptyData = { records: [], classes: [], sections: [], subjects: [] };
const formatDate = (date) =>
  `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
const isWorkingDay = (date) => ![0, 6].includes(date.getDay());

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function StatusBadge({ status }) {
  const tone =
    status === "Present"
      ? [styles.presentBadge, styles.presentText]
      : status === "Absent"
        ? [styles.absentBadge, styles.absentText]
        : status === "Late"
          ? [styles.lateBadge, styles.lateText]
          : [styles.unmarkedBadge, styles.unmarkedText];
  return (
    <View style={[styles.statusBadge, tone[0]]}>
      <Text style={[styles.statusText, tone[1]]}>{status}</Text>
    </View>
  );
}

function Metric({ title, value, label, backgroundColor }) {
  return (
    <View style={[styles.metric, { backgroundColor }]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricMeta}>{label}</Text>
    </View>
  );
}

function SelectModal({ visible, value, options, onSelect, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>Select option</Text>
          {options.map((option) => (
            <Pressable
              key={option.id || option}
              style={[
                styles.modalOption,
                option.id === value?.id && styles.modalOptionActive,
              ]}
              onPress={() => {
                onSelect(option);
                onClose();
              }}
            >
              <Text style={styles.modalOptionText}>
                {option.label || option}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

function EmptyState({
  title = "No data available",
  message = "No records found matching your criteria",
}) {
  return (
    <View style={styles.empty}>
      <Icon name="file-tray-outline" size={28} color={colors.blue} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

function normalizeData(result) {
  const next = result || emptyData;
  return {
    ...next,
    records: (next.records || []).map((record) => ({
      ...record,
      status: record.status || "Unmarked",
    })),
    classes: next.classes || [],
    sections: next.sections || [],
    subjects: next.subjects || [],
  };
}

function historySummary(records) {
  return {
    total: records.length,
    present: records.filter((record) => record.status === "Present").length,
    absent: records.filter((record) => record.status === "Absent").length,
    late: records.filter((record) => record.status === "Late").length,
  };
}

export default function TeacherAttendanceScreen({ session, onBack }) {
  const [activeTab, setActiveTab] = useState("Attendance Control");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selecting, setSelecting] = useState(null);
  const [classSelection, setClassSelection] = useState(null);
  const [sectionSelection, setSectionSelection] = useState(null);
  const [subject] = useState("Select an option");
  const [filter] = useState("Select an option");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(emptyData);
  const [history, setHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedKeys, setSubmittedKeys] = useState([]);
  const [cutoffTime, setCutoffTime] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasNext, setHistoryHasNext] = useState(false);

  const className = classSelection?.label || "Select an option";
  const section = sectionSelection?.label || "Select an option";
  const classId = classSelection?.id;
  const divisionId = sectionSelection?.id;
  const academicYearId =
    data?.academic_year_id ||
    data?.academicYearId ||
    session?.academicYearId ||
    session?.academic_year_id ||
    session?.user?.tenant?.current_academic_year_id ||
    session?.tenant?.current_academic_year_id;

  const context = {
    date: formatDate(date),
    className,
    section,
    classId,
    divisionId,
    subject,
  };
  const submissionKey = `${context.date}|${className}|${section}|${subject}`;

  const loadAttendance = useCallback(async () => {
    if (!classSelection || !sectionSelection) {
      setLoading(false);
      setData(emptyData);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(
        normalizeData(
          await teacherAttendanceApi.getAttendance(
            { date: formatDate(date), classId, divisionId, subject },
            session,
          ),
        ),
      );
    } catch (requestError) {
      setData(emptyData);
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load attendance. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    date,
    classId,
    divisionId,
    classSelection,
    sectionSelection,
    subject,
    session,
  ]);

  useEffect(() => {
    let active = true;
    const loadFilters = async () => {
      setFiltersLoading(true);
      try {
        const assigned =
          await teacherAttendanceApi.getAssignedClassesDivisions(session);
        const [academicClasses] = await Promise.all([
          assigned.classes.length
            ? Promise.resolve([])
            : teacherAttendanceApi.getAcademicClasses(session),
        ]);
        if (active) {
          const nextClasses = assigned.classes.length
            ? assigned.classes
            : academicClasses;
          const nextSections = assigned.sections;
          setData((current) => ({
            ...current,
            classes: nextClasses,
            sections: nextSections,
          }));
          setClassSelection((current) => current || nextClasses[0] || null);
          setSectionSelection((current) => current || nextSections[0] || null);
        }
      } catch (requestError) {
        if (active)
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to load assigned classes and divisions.",
          );
      } finally {
        if (active) setFiltersLoading(false);
      }
    };
    void loadFilters();
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!classId) return undefined;
    let active = true;
    const loadClassDivisions = async () => {
      try {
        const divisions = await teacherAttendanceApi.getAcademicDivisions(
          session,
          classId,
        );
        if (active && divisions.length) {
          setData((current) => ({ ...current, sections: divisions }));
          setSectionSelection((current) =>
            divisions.some(
              (division) => String(division.id) === String(current?.id),
            )
              ? current
              : divisions[0],
          );
        }
      } catch (requestError) {
        if (active)
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : "Unable to load divisions for the selected class.",
          );
      }
    };
    void loadClassDivisions();
    return () => {
      active = false;
    };
  }, [classId, session]);

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => clearTimeout(loadTimer);
  }, [loadAttendance]);

  const summary = useMemo(
    () => ({
      totalEnrolled: data.records.length,
      markedEntries: data.records.filter((record) =>
        ["Present", "Absent", "Late"].includes(record.status),
      ).length,
      presentToday: data.records.filter((record) => record.status === "Present")
        .length,
      absentCount: data.records.filter((record) => record.status === "Absent")
        .length,
      lateArrivals: data.records.filter((record) => record.status === "Late")
        .length,
    }),
    [data.records],
  );

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.records.filter((record) => {
      const matchesSearch =
        !query ||
        [record.name, record.roll, record.admissionNumber, record.studentId]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesFilter =
        filter === "Select an option" ||
        (filter === "All Present" && record.status === "Present") ||
        (filter === "All Absent" && record.status === "Absent") ||
        record.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [data.records, filter, search]);

  const updateStatus = (id, status) =>
    setData((current) => ({
      ...current,
      records: current.records.map((record) =>
        record.id === id ? { ...record, status } : record,
      ),
    }));

  const applyBulk = (status) =>
    Alert.alert(
      `Mark all ${status.toLowerCase()}?`,
      "This updates the displayed students.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            const ids = new Set(visibleRecords.map((record) => record.id));
            setData((current) => ({
              ...current,
              records: current.records.map((record) =>
                ids.has(record.id) ? { ...record, status } : record,
              ),
            }));
          },
        },
      ],
    );

  const runCutoff = async () => {
    if (!isWorkingDay(date)) {
      Alert.alert(
        "Working day required",
        "The 10:30 AM cutoff applies on working days only.",
      );
      return;
    }
    const unmarked = data.records.filter(
      (record) => record.status === "Unmarked",
    );
    setActionLoading(true);
    try {
      await teacherAttendanceApi.triggerAutoCutoff(
        { date: context.date, class_id: classId, division_id: divisionId },
        session,
      );
      setData((current) => ({
        ...current,
        records: current.records.map((record) =>
          record.status === "Unmarked"
            ? { ...record, status: "Absent" }
            : record,
        ),
      }));
      await teacherAttendanceApi.sendAbsentWhatsAppAlert(unmarked, context);
      setCutoffTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      Alert.alert(
        "Cutoff completed",
        `${unmarked.length} unmarked student(s) were recorded as Absent. WhatsApp alerts are simulated until an API is connected.`,
      );
    } catch {
      Alert.alert(
        "Cutoff error",
        "Unable to run attendance cutoff. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const addHistoryEntry = () => {
    const entry = {
      ...context,
      records: data.records,
      summary: historySummary(data.records),
      submittedAt: new Date().toISOString(),
    };
    setHistory((current) => [
      entry,
      ...current.filter(
        (item) =>
          `${item.date}|${item.className}|${item.section}|${item.subject}` !==
          submissionKey,
      ),
    ]);
    setHistoryDate(entry.date);
  };

  const completeSubmit = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await teacherAttendanceApi.submitAttendance(
        {
          academic_year_id: academicYearId,
          date: context.date,
          class_id: classId,
          division_id: divisionId,
          attendanceData: data.records.map((record) => ({
            student_id: record.studentId || record.id,
            status: record.status,
          })),
        },
        session,
      );
      setSubmittedKeys((current) =>
        current.includes(submissionKey) ? current : [...current, submissionKey],
      );
      addHistoryEntry();
      Alert.alert("Success", "Attendance submitted successfully!");
      await loadAttendance();
      await loadHistory();
    } catch (requestError) {
      Alert.alert(
        "Submission error",
        requestError instanceof ApiError
          ? requestError.message
          : "Failed to submit attendance. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const submit = () => {
    if (actionLoading) return;
    if (!academicYearId || !classId || !divisionId) {
      Alert.alert(
        "Missing attendance details",
        "Select an academic year, class, and division before submitting attendance.",
      );
      return;
    }
    if (!data.records.length) {
      Alert.alert(
        "No students",
        "There are no students to submit attendance for.",
      );
      return;
    }
    if (submittedKeys.includes(submissionKey)) {
      Alert.alert(
        "Already submitted",
        "Attendance for this date and selection has already been submitted.",
      );
      return;
    }
    const unmarked = data.records.filter(
      (record) => record.status === "Unmarked",
    );
    if (unmarked.length) {
      Alert.alert(
        "Some students are still unmarked.",
        `${unmarked.length} student(s) are unmarked. Submit anyway?`,
        [
          { text: "Continue marking", style: "cancel" },
          { text: "Submit anyway", onPress: completeSubmit },
        ],
      );
      return;
    }
    completeSubmit();
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError("");
    if (!classId || !divisionId) {
      setHistory([]);
      setHistoryHasNext(false);
      setHistoryLoading(false);
      return;
    }
    try {
      const historyDateValue = formatDate(date);
      const result = await teacherAttendanceApi.getAttendanceHistory(
        {
          classId,
          divisionId,
          startDate: historyDateValue,
          endDate: historyDateValue,
          page: historyPage,
          limit: 20,
        },
        session,
      );
      const records = result.records || [];
      if (records.length) {
        const entry = {
          date: formatDate(date),
          className,
          section,
          subject,
          records,
          summary: historySummary(records),
          submittedAt: new Date().toISOString(),
        };
        setHistory((current) =>
          historyPage === 1 ? [entry] : [...current, entry],
        );
      }
      const meta = result.pagination || {};
      setHistoryHasNext(
        Boolean(
          meta.next_page ||
          meta.nextPage ||
          meta.has_next ||
          records.length >= 20,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load submitted attendance history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [
    classId,
    divisionId,
    className,
    section,
    subject,
    session,
    historyPage,
    date,
  ]);

  useEffect(() => {
    if (activeTab === "History Log") void loadHistory();
  }, [activeTab, loadHistory]);

  const exportCsv = async () => {
    setActionLoading(true);
    try {
      const result = await teacherAttendanceApi.exportAttendance(
        {
          date: context.date,
          classId,
          divisionId,
          format: "CSV",
        },
        session,
      );
      const exportData = result?.data || result;
      const downloadUrl =
        exportData?.download_url || exportData?.file_url || exportData?.url;
      const csv =
        typeof exportData === "string"
          ? exportData
          : exportData?.csv || exportData?.content;
      if (!downloadUrl && !csv) {
        throw new Error("The server returned an empty attendance export.");
      }
      await Share.share({
        title: `Attendance ${context.date}`,
        message: downloadUrl || csv,
      });
    } catch (requestError) {
      Alert.alert(
        "Export unavailable",
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to export attendance from the server. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderRecord = (record) => (
    <View key={record.id} style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordName}>
            {record.name || "Unnamed student"}
          </Text>
          <Text style={styles.recordMeta}>
            Roll/Admin:{" "}
            {record.roll || record.admissionNumber || record.studentId || "N/A"}
          </Text>
        </View>
        <StatusBadge status={record.status || "Unmarked"} />
      </View>
      <View style={styles.recordDetails}>
        <Text style={styles.detailText}>
          Entry: {record.entrySource || "Manual"}
        </Text>
        <Text style={styles.detailText}>
          Punch in: {record.punchIn || "--"}
        </Text>
        <Text style={styles.detailText}>
          Punch out: {record.punchOut || "--"}
        </Text>
      </View>
      <View style={styles.statusActions}>
        {statuses.map((status) => (
          <Pressable
            key={status}
            style={[
              styles.statusButton,
              record.status === status && styles.statusButtonActive,
            ]}
            onPress={() => updateStatus(record.id, status)}
          >
            <Text
              style={[
                styles.statusButtonText,
                record.status === status && styles.statusButtonTextActive,
              ]}
            >
              {status}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderDailyLog = () => (
    <>
      <View style={styles.filterCard}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Date:</Text>
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={17} color={colors.blue} />
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </Pressable>
        </View>
        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            onChange={(_, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
          />
        ) : null}
        <Pressable
          style={styles.selectButtonFull}
          disabled={filtersLoading}
          onPress={() => setSelecting("class")}
        >
          <Text style={styles.selectText}>
            {filtersLoading
              ? "Loading assigned classes..."
              : `${className} (Class)`}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Pressable
          style={styles.selectButtonFull}
          disabled={filtersLoading}
          onPress={() => setSelecting("section")}
        >
          <Text style={styles.selectText}>
            {filtersLoading
              ? "Loading assigned divisions..."
              : `${section} (Division)`}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderText}>Roll / Admin No</Text>
        <Text style={styles.tableHeaderText}>Student Identity</Text>
        <Text style={styles.tableHeaderText}>Live Status</Text>
        <Text style={styles.tableHeaderText}>Punch In / Out</Text>
        <Text style={styles.tableHeaderText}>Precision Controls</Text>
      </View>
      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={17} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name/roll..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.filterRow}>
        <Pressable
          style={styles.bulkButton}
          onPress={() => applyBulk("Present")}
        >
          <Text style={styles.bulkText}>All Present</Text>
        </Pressable>
        <Pressable
          style={styles.bulkButton}
          onPress={() => applyBulk("Absent")}
        >
          <Text style={styles.bulkText}>All Absent</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.blue} style={styles.loader} />
      ) : null}
      {!loading && !visibleRecords.length ? (
        <EmptyState />
      ) : (
        visibleRecords.map(renderRecord)
      )}
      <Pressable
        style={styles.submitButton}
        disabled={actionLoading}
        onPress={submit}
      >
        {actionLoading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Icon
              name="checkmark-circle-outline"
              size={17}
              color={colors.white}
            />
            <Text style={styles.primaryText}>Submit Attendance</Text>
          </>
        )}
      </Pressable>
    </>
  );

  const selectedHistory =
    history.find((entry) => entry.date === historyDate) || history[0];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Attendance</Text>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() =>
                tab === "Submit Attendance" ? submit() : setActiveTab(tab)
              }
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {activeTab === "Attendance Control" ? (
          <View>
            <View style={styles.cutoff}>
              <Text style={styles.cutoffTitle}>
                10:30 AM Daily Attendance Cutoff Active
              </Text>
              <Text style={styles.cutoffLabel}>WhatsApp Absent Alert</Text>
              <Text style={styles.cutoffText}>
                Any students left unmarked by 10:30 AM on working days are
                automatically recorded as Absent and WhatsApp alerts are
                dispatched to parents.
              </Text>
              <Pressable
                style={styles.primaryButton}
                disabled={actionLoading}
                onPress={runCutoff}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryText}>Run Cutoff Now</Text>
                )}
              </Pressable>
              {cutoffTime ? (
                <Text style={styles.successText}>
                  Cutoff executed at {cutoffTime}. WhatsApp alert simulation
                  completed.
                </Text>
              ) : null}
            </View>
            <View style={styles.metricGrid}>
              <Metric
                title="Total Enrolled"
                value={summary.totalEnrolled}
                label="MATRIX VOLUME"
                backgroundColor={colors.paleBlue}
              />
              <Metric
                title="Marked Entries"
                value={summary.markedEntries}
                label="SYNCED"
                backgroundColor={colors.paleRed}
              />
              <Metric
                title="Present Today"
                value={summary.presentToday}
                label="ACTIVE STATUS"
                backgroundColor={colors.paleGreen}
              />
              <Metric
                title="Absent Count"
                value={summary.absentCount}
                label="MISSING"
                backgroundColor={colors.paleRed}
              />
              <Metric
                title="Late Arrivals"
                value={summary.lateArrivals}
                label="AUDIT LAG"
                backgroundColor={colors.paleOrange}
              />
            </View>
            {renderDailyLog()}
          </View>
        ) : null}
        {activeTab === "Daily Log / Marking" ? (
          <>
            <View style={styles.metricGrid}>
              <Metric
                title="Total Enrolled"
                value={summary.totalEnrolled}
                label="MATRIX VOLUME"
                backgroundColor={colors.paleBlue}
              />
              <Metric
                title="Marked Entries"
                value={summary.markedEntries}
                label="SYNCED"
                backgroundColor={colors.paleRed}
              />
              <Metric
                title="Present Today"
                value={summary.presentToday}
                label="ACTIVE STATUS"
                backgroundColor={colors.paleGreen}
              />
              <Metric
                title="Absent Count"
                value={summary.absentCount}
                label="MISSING"
                backgroundColor={colors.paleRed}
              />
              <Metric
                title="Late Arrivals"
                value={summary.lateArrivals}
                label="AUDIT LAG"
                backgroundColor={colors.paleOrange}
              />
            </View>
            {renderDailyLog()}
          </>
        ) : null}
        {activeTab === "Biometric" ? (
          <TeacherBiometricSuite session={session} />
        ) : null}
        {activeTab === "History Log" ? (
          <View>
            <Text style={styles.sectionTitle}>Attendance History</Text>
            {historyLoading ? (
              <ActivityIndicator color={colors.blue} style={styles.loader} />
            ) : null}
            {history.length ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.historyDates}
                >
                  {history.map((entry) => (
                    <Pressable
                      key={`${entry.date}-${entry.className}-${entry.subject}`}
                      style={[
                        styles.historyDate,
                        entry.date === historyDate && styles.historyDateActive,
                      ]}
                      onPress={() => setHistoryDate(entry.date)}
                    >
                      <Text style={styles.historyDateText}>{entry.date}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.historyCard}>
                  <Text style={styles.historyTitle}>
                    {selectedHistory?.date || "No selected record"}
                  </Text>
                  {selectedHistory ? (
                    <Text style={styles.historyText}>
                      Class: {selectedHistory.className} Subject:{" "}
                      {selectedHistory.subject}
                      {"\n"}Total students:{" "}
                      {selectedHistory.summary?.total ??
                        selectedHistory.records?.length ??
                        0}{" "}
                      Present: {selectedHistory.summary?.present ?? 0} Absent:{" "}
                      {selectedHistory.summary?.absent ?? 0} Late:{" "}
                      {selectedHistory.summary?.late ?? 0}
                      {"\n"}Submission status: Submitted
                    </Text>
                  ) : null}
                </View>
                <View style={styles.pagination}>
                  <Pressable
                    style={styles.bulkButton}
                    disabled={historyPage === 1 || historyLoading}
                    onPress={() =>
                      setHistoryPage((page) => Math.max(1, page - 1))
                    }
                  >
                    <Text style={styles.bulkText}>Previous</Text>
                  </Pressable>
                  <Text style={styles.historyText}>Page {historyPage}</Text>
                  <Pressable
                    style={styles.bulkButton}
                    disabled={!historyHasNext || historyLoading}
                    onPress={() => setHistoryPage((page) => page + 1)}
                  >
                    <Text style={styles.bulkText}>Next</Text>
                  </Pressable>
                </View>
              </>
            ) : !historyLoading ? (
              <EmptyState
                title="No data available"
                message="No submitted attendance history available."
              />
            ) : null}
          </View>
        ) : null}
        {activeTab === "Export" ? (
          <View>
            <Text style={styles.sectionTitle}>Export Attendance</Text>
            <View style={styles.exportCard}>
              <Text style={styles.exportText}>
                Export the selected date, class, subject, and current attendance
                statuses from the server.
              </Text>
              <Pressable
                style={styles.primaryButton}
                disabled={actionLoading}
                onPress={exportCsv}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Icon
                      name="download-outline"
                      size={17}
                      color={colors.white}
                    />
                    <Text style={styles.primaryText}>Export CSV</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <SelectModal
        visible={selecting === "class"}
        value={classSelection}
        options={data.classes}
        onSelect={(option) => {
          setClassSelection(option);
          setHistoryPage(1);
        }}
        onClose={() => setSelecting(null)}
      />
      <SelectModal
        visible={selecting === "section"}
        value={sectionSelection}
        options={data.sections}
        onSelect={(option) => {
          setSectionSelection(option);
          setHistoryPage(1);
        }}
        onClose={() => setSelecting(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  selectButtonFull: {
    backgroundColor: colors.white,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    backgroundColor: colors.navy,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: "#A9C6E8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  portal: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  year: { color: "#B8D0EC", fontSize: 10, marginTop: 4 },
  teacherName: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  teacherRole: { color: "#B8D0EC", fontSize: 10, marginTop: 2 },
  headerActions: { alignItems: "flex-end", gap: 9 },
  initials: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2E5D91",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  backText: { color: "#C8DBF2", fontSize: 10 },
  content: { padding: 16, paddingBottom: 30 },
  pageTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  tabActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  tabTextActive: { color: colors.white },
  controlCard: {
    backgroundColor: "#EAF4FF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  controlRow: {
    backgroundColor: "#EAF4FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
  },
  dateText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  selectRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  selectButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionSelect: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  selectText: { color: colors.ink, fontSize: 11, flex: 1 },
  cutoff: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
  },
  cutoffTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  cutoffLabel: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 10,
  },
  cutoffText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  errorText: {
    color: colors.red,
    backgroundColor: colors.paleRed,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 11,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  metric: {
    width: "31.5%",
    minHeight: 84,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    padding: 8,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  metricTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  metricMeta: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    paddingHorizontal: 11,
    marginBottom: 9,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    paddingVertical: 11,
    marginLeft: 7,
  },
  filterRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  filterButton: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterText: { color: colors.muted, fontSize: 10, flex: 1 },
  bulkButton: {
    backgroundColor: colors.paleBlue,
    borderRadius: 8,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  bulkText: { color: colors.blue, fontSize: 9, fontWeight: "900" },
  tableHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 3,
  },
  tableHeaderText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "900",
    flex: 1,
    minWidth: 54,
  },
  loader: { marginVertical: 24 },
  recordCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    marginBottom: 8,
  },
  recordHeader: { flexDirection: "row", alignItems: "center" },
  recordName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  recordMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  recordDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  detailText: { color: colors.muted, fontSize: 9 },
  statusActions: { flexDirection: "row", gap: 5, marginTop: 11 },
  statusButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 7,
    alignItems: "center",
    paddingVertical: 7,
  },
  statusButtonActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  statusButtonText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  statusButtonTextActive: { color: colors.white },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 9, fontWeight: "900" },
  presentBadge: { backgroundColor: colors.paleGreen },
  presentText: { color: colors.green },
  absentBadge: { backgroundColor: colors.paleRed },
  absentText: { color: colors.red },
  lateBadge: { backgroundColor: colors.paleOrange },
  lateText: { color: colors.orange },
  unmarkedBadge: { backgroundColor: colors.canvas },
  unmarkedText: { color: colors.muted },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: "center",
    padding: 24,
    marginTop: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 9,
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: colors.blue,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: colors.blue,
    minHeight: 42,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 11,
    paddingHorizontal: 12,
  },
  primaryText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  successText: {
    color: colors.green,
    backgroundColor: colors.paleGreen,
    padding: 8,
    borderRadius: 8,
    marginTop: 9,
    fontSize: 11,
  },
  historyDates: { marginBottom: 10 },
  historyDate: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 9,
    marginRight: 7,
    backgroundColor: colors.white,
  },
  historyDateActive: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  historyDateText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  historyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 13,
  },
  historyTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  historyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 8,
  },
  exportCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 14,
  },
  exportText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 31, 0.35)",
    justifyContent: "center",
    padding: 22,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 15,
    maxHeight: "80%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  modalOption: { padding: 12, borderRadius: 8, marginTop: 4 },
  modalOptionActive: { backgroundColor: colors.paleBlue },
  modalOptionText: { color: colors.ink, fontSize: 13 },
});
