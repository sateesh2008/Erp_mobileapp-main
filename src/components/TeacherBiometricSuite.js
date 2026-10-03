import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { ApiError, getApiBaseUrl } from "../services/api";
import { biometricApi } from "../services/biometricApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  blue: "#1E32CC",
  navy: "#13137F",
  paleBlue: "#EEF0FC",
  green: "#1E8056",
  paleGreen: "#E6F6EE",
  red: "#B74755",
  paleRed: "#FDECEF",
  orange: "#9A6500",
  paleOrange: "#FFF5D9",
};
const tabs = [
  "Registered Devices",
  "User Enrollments",
  "Live Punch Feeds",
  "Webhook & Test Simulator",
];
const deviceTypes = ["Hikvision", "ZKTeco", "Dahua"];
const blankDevice = {
  name: "",
  type: "Hikvision",
  deviceId: "",
  location: "",
  host: "",
  port: "80",
  username: "",
  password: "",
  protocol: "HTTP",
};
const blankEnrollment = {
  user: "",
  category: "Student",
  erpId: "",
  biometricUid: "",
  device: "",
  className: "",
  section: "",
};
const enrollmentCategories = ["Student", "Teacher", "Parent", "Staff"];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Button({
  title,
  onPress,
  secondary = false,
  icon = "arrow-forward-outline",
}) {
  return (
    <Pressable
      style={[styles.button, secondary && styles.secondaryButton]}
      onPress={onPress}
    >
      <Icon
        name={icon}
        size={16}
        color={secondary ? colors.blue : colors.white}
      />
      <Text
        style={[styles.buttonText, secondary && styles.secondaryButtonText]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}
function Empty({ title, message, action, onAction }) {
  return (
    <View style={styles.empty}>
      <Icon name="hardware-chip-outline" size={30} color={colors.blue} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {action ? (
        <Button title={action} onPress={onAction} icon="add-outline" />
      ) : null}
    </View>
  );
}
function SummaryCard({ value, label, icon, backgroundColor }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor }]}>
      <View style={styles.summaryIcon}>
        <Icon name={icon} size={17} color={colors.blue} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function validateDevice(device, devices) {
  if (!device.name.trim()) return "Device Name is required.";
  if (!deviceTypes.includes(device.type))
    return "Choose a supported device type.";
  if (
    device.deviceId.trim() &&
    devices.some(
      (item) =>
        (item.deviceId || "").toLowerCase() ===
        device.deviceId.trim().toLowerCase(),
    )
  )
    return "Serial Number already exists.";
  return "";
}

export default function TeacherBiometricSuite({ session }) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [snapshot, setSnapshot] = useState({
    devices: [],
    enrollments: [],
    punches: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const showDeviceForm = false;
  const setShowDeviceForm = (visible) => setShowDeviceModal(visible);
  const [device, setDevice] = useState(blankDevice);
  const [deviceError, setDeviceError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [enrollment, setEnrollment] = useState(blankEnrollment);
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(
    `All Categories (${enrollmentCategories.length})`,
  );
  const [classFilter, setClassFilter] = useState("All Classes");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [filterSelector, setFilterSelector] = useState(null);
  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [enrollmentSaving, setEnrollmentSaving] = useState(false);
  const [enrollmentCandidates, setEnrollmentCandidates] = useState([]);
  const [candidateCategory, setCandidateCategory] = useState("Student");
  const [candidateClass, setCandidateClass] = useState("All Classes");
  const [candidateSection, setCandidateSection] = useState("All Sections");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSelector, setCandidateSelector] = useState(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("Students");
  const [bulkCandidates, setBulkCandidates] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [punchSearch, setPunchSearch] = useState("");
  const [punches, setPunches] = useState([]);
  const [punchLoading, setPunchLoading] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [autoRefreshPunches, setAutoRefreshPunches] = useState(false);
  const punchRefreshRef = React.useRef(false);
  const [simulator, setSimulator] = useState({
    biometricUid: "10004",
    punchType: "IN",
    timestamp: new Date().toISOString().slice(0, 16),
  });
  const [webhookApiKey, setWebhookApiKey] = useState("");
  const [webhookUid, setWebhookUid] = useState("");
  const [webhookTimestamp, setWebhookTimestamp] = useState(new Date());
  const [webhookSending, setWebhookSending] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState("");
  const [showWebhookDatePicker, setShowWebhookDatePicker] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await biometricApi.getSnapshot(session);
      setSnapshot(next);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load biometric data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [session]);

  const punchKey = (punch) =>
    String(
      punch.id ||
        `${punch.timestamp || punch.time}|${punch.biometricUid || punch.uid}|${punch.device || punch.assignedDevice || ""}`,
    );
  const loadPunches = async (background = false) => {
    if (punchRefreshRef.current) return;
    punchRefreshRef.current = true;
    if (!background) setPunchLoading(true);
    setPunchError("");
    try {
      const latest = await biometricApi.getPunches(session);
      const sorted = [...(latest || [])].sort(
        (a, b) =>
          new Date(b.timestamp || b.time || 0) -
          new Date(a.timestamp || a.time || 0),
      );
      setPunches((current) => {
        const merged = new Map(
          current.map((punch) => [punchKey(punch), punch]),
        );
        sorted.forEach((punch) => merged.set(punchKey(punch), punch));
        return [...merged.values()].sort(
          (a, b) =>
            new Date(b.timestamp || b.time || 0) -
            new Date(a.timestamp || a.time || 0),
        );
      });
    } catch {
      setPunchError("Unable to load live punch feeds. Please try again.");
    } finally {
      punchRefreshRef.current = false;
      if (!background) setPunchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "Live Punch Feeds") return undefined;
    loadPunches();
    if (!autoRefreshPunches) return undefined;
    const interval = setInterval(() => loadPunches(true), 5000);
    return () => clearInterval(interval);
  }, [activeTab, autoRefreshPunches, session]);

  const visiblePunches = useMemo(() => {
    const query = punchSearch.trim().toLowerCase();
    return punches.filter(
      (punch) =>
        !query ||
        [
          punch.student,
          punch.personName,
          punch.name,
          punch.admissionOrStaffCode,
          punch.erpId,
          punch.employeeCode,
          punch.biometricUid,
          punch.uid,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        ),
    );
  }, [punches, punchSearch]);

  const loadBulkCandidates = async (category = bulkCategory) => {
    setBulkLoading(true);
    try {
      const candidates = await biometricApi.getAutoMapCandidates(
        category,
        session,
      );
      const existing = new Set(
        snapshot.enrollments.map((item) => String(item.biometricUid)),
      );
      setBulkCandidates(
        (candidates || []).filter(
          (candidate) =>
            candidate.personName &&
            candidate.admissionOrEmployeeCode &&
            !candidate.biometricUid &&
            !existing.has(String(candidate.admissionOrEmployeeCode)),
        ),
      );
    } catch {
      setEnrollmentError("Unable to load auto-mapping candidates.");
    } finally {
      setBulkLoading(false);
    }
  };

  const openBulkModal = () => {
    setBulkResult(null);
    setBulkProgress(null);
    setEnrollmentError("");
    setShowBulkModal(true);
    loadBulkCandidates();
  };

  const autoMap = () => {
    if (!bulkCandidates.length) return;
    Alert.alert(
      "Bulk Auto-Mapping",
      `${bulkCandidates.length} ${bulkCategory.toLowerCase()} are eligible for automatic biometric mapping. Existing biometric mappings will not be overwritten. Do you want to continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Auto-Map",
          onPress: async () => {
            setBulkLoading(true);
            setBulkProgress({ completed: 0, total: bulkCandidates.length });
            try {
              const result = await biometricApi.autoMapEnrollments(
                bulkCategory,
                bulkCandidates,
                session,
              );
              setBulkResult(result);
              await refresh();
            } catch {
              setEnrollmentError("Bulk auto-mapping failed. Please try again.");
            } finally {
              setBulkLoading(false);
              setBulkProgress(null);
            }
          },
        },
      ],
    );
  };

  const unmapped = useMemo(
    () =>
      snapshot.punches.filter((punch) => punch.status === "Unmapped").length,
    [snapshot.punches],
  );
  const online = snapshot.devices.filter(
    (deviceItem) => deviceItem.status === "Online",
  ).length;

  const candidateClasses = useMemo(
    () => [
      ...new Set(
        enrollmentCandidates.map((item) => item.className).filter(Boolean),
      ),
    ],
    [enrollmentCandidates],
  );
  const candidateSections = useMemo(
    () => [
      ...new Set(
        enrollmentCandidates
          .filter(
            (item) =>
              candidateClass === "All Classes" ||
              item.className === candidateClass,
          )
          .map((item) => item.section)
          .filter(Boolean),
      ),
    ],
    [enrollmentCandidates, candidateClass],
  );
  const eligibleCandidates = useMemo(
    () =>
      enrollmentCandidates.filter(
        (item) =>
          !snapshot.enrollments.some(
            (enrolled) =>
              String(enrolled.erpId || enrolled.admission_or_staff_code) ===
              String(item.erpId || item.admission_or_staff_code),
          ),
      ),
    [enrollmentCandidates, snapshot.enrollments],
  );
  const visibleCandidates = useMemo(
    () =>
      eligibleCandidates.filter(
        (item) =>
          !candidateSearch.trim() ||
          [
            item.name,
            item.personName,
            item.erpId,
            item.admissionOrStaffCode,
            item.employeeCode,
            item.id,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(candidateSearch.trim().toLowerCase()),
          ),
      ),
    [eligibleCandidates, candidateSearch],
  );

  const loadEnrollmentCandidates = async (
    category = candidateCategory,
    className = candidateClass,
    section = candidateSection,
  ) => {
    setCandidateLoading(true);
    try {
      setEnrollmentCandidates(
        await biometricApi.getEnrollmentCandidates(
          {
            category,
            className: className === "All Classes" ? "" : className,
            section: section === "All Sections" ? "" : section,
          },
          session,
        ),
      );
    } catch {
      setEnrollmentError("Unable to load enrollment candidates.");
    } finally {
      setCandidateLoading(false);
    }
  };

  const registerDevice = async () => {
    const validationError = validateDevice(device, snapshot.devices);
    if (validationError) {
      setDeviceError(validationError);
      return;
    }
    setRegistering(true);
    setDeviceError("");
    try {
      await biometricApi.registerDevice(device, session);
      setDevice(blankDevice);
      setShowDeviceForm(false);
      await refresh();
      Alert.alert(
        "Device registered",
        "The device was added with an Unknown status until the backend tests its connection.",
      );
    } catch {
      setDeviceError("The biometric backend could not register this device.");
    } finally {
      setRegistering(false);
    }
  };

  const testConnection = async (deviceItem) => {
    const result = await biometricApi.testConnection(deviceItem, session);
    Alert.alert(
      result.simulated ? "Connection test unavailable" : "Connection tested",
      result.message || `Device status: ${result.status || "Unknown"}.`,
    );
  };

  const deleteDevice = (deviceItem) =>
    Alert.alert("Delete device?", deviceItem.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await biometricApi.deleteDevice(deviceItem.id, session);
          refresh();
        },
      },
    ]);

  const filteredEnrollments = useMemo(() => {
    const query = enrollmentSearch.trim().toLowerCase();
    return snapshot.enrollments.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.user,
          item.person_name,
          item.erpId,
          item.admission_or_staff_code,
          item.biometricUid,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );
      const selectedCategory = categoryFilter.toLowerCase().replace(/s$/, "");
      const matchesCategory =
        categoryFilter.startsWith("All Categories") ||
        String(item.category || "")
          .toLowerCase()
          .replace(/s$/, "") === selectedCategory;
      const matchesClass =
        classFilter === "All Classes" || item.className === classFilter;
      const matchesSection =
        sectionFilter === "All Sections" || item.section === sectionFilter;
      return matchesSearch && matchesCategory && matchesClass && matchesSection;
    });
  }, [
    snapshot.enrollments,
    enrollmentSearch,
    categoryFilter,
    classFilter,
    sectionFilter,
  ]);

  const enrollmentClasses = useMemo(
    () => [
      ...new Set(
        snapshot.enrollments.map((item) => item.className).filter(Boolean),
      ),
    ],
    [snapshot.enrollments],
  );
  const enrollmentSections = useMemo(
    () => [
      ...new Set(
        snapshot.enrollments
          .filter(
            (item) =>
              classFilter === "All Classes" || item.className === classFilter,
          )
          .map((item) => item.section)
          .filter(Boolean),
      ),
    ],
    [snapshot.enrollments, classFilter],
  );
  const enrollmentCategoryValues = useMemo(
    () => [
      ...new Set(
        snapshot.enrollments
          .map((item) => String(item.category || "").trim())
          .filter(Boolean),
      ),
    ],
    [snapshot.enrollments],
  );
  const categoryLabel = (category) =>
    category
      ? `${category.charAt(0).toUpperCase()}${category.slice(1).toLowerCase()}${category.toLowerCase().endsWith("s") ? "" : "s"}`
      : category;
  const filterOptions =
    filterSelector === "category"
      ? [
          `All Categories (${enrollmentCategoryValues.length || 4})`,
          ...(enrollmentCategoryValues.length
            ? enrollmentCategoryValues.map(categoryLabel)
            : ["Students", "Teachers", "Staff", "Parents"]),
        ]
      : filterSelector === "class"
        ? ["All Classes", ...enrollmentClasses]
        : ["All Sections", ...enrollmentSections];

  const saveEnrollment = async () => {
    if (
      !enrollment.user.trim() ||
      !enrollment.category.trim() ||
      !enrollment.erpId.trim() ||
      !enrollment.biometricUid.trim()
    ) {
      setEnrollmentError(
        "Candidate, category, code, and biometric UID are required.",
      );
      return;
    }
    const duplicate = snapshot.enrollments.some(
      (item) =>
        String(item.biometricUid) === enrollment.biometricUid.trim() &&
        item.id !== editingEnrollment?.id,
    );
    const duplicatePerson = snapshot.enrollments.some(
      (item) =>
        String(item.erpId) === enrollment.erpId.trim() &&
        item.id !== editingEnrollment?.id,
    );
    if (duplicate) {
      setEnrollmentError(
        "This biometric UID is already assigned to another user.",
      );
      return;
    }
    if (duplicatePerson) {
      setEnrollmentError(
        "This person already has an active biometric mapping.",
      );
      return;
    }
    setEnrollmentSaving(true);
    setEnrollmentError("");
    try {
      if (editingEnrollment)
        await biometricApi.updateEnrollment(
          editingEnrollment.id,
          enrollment,
          session,
        );
      else
        await biometricApi.saveEnrollment(
          { ...enrollment, enrolledDate: new Date().toISOString() },
          session,
        );
      setEnrollment(blankEnrollment);
      setEditingEnrollment(null);
      setShowEnrollmentModal(false);
      await refresh();
      Alert.alert(
        editingEnrollment ? "Enrollment updated" : "UID enrolled",
        "The enrollment list has been refreshed.",
      );
    } catch {
      setEnrollmentError("Unable to save this enrollment. Please try again.");
    } finally {
      setEnrollmentSaving(false);
    }
  };

  const openEnrollment = (item = null) => {
    setEditingEnrollment(item);
    setEnrollment(item ? { ...blankEnrollment, ...item } : blankEnrollment);
    setCandidateCategory(item?.category || "Student");
    setCandidateClass(item?.className || "All Classes");
    setCandidateSection(item?.section || "All Sections");
    setCandidateSearch("");
    setEnrollmentError("");
    setShowEnrollmentModal(true);
    loadEnrollmentCandidates(
      item?.category || "Student",
      item?.className || "All Classes",
      item?.section || "All Sections",
    );
  };
  const removeEnrollment = (item) =>
    Alert.alert(
      "Remove biometric mapping?",
      `${item.user || item.person_name} · UID ${item.biometricUid}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await biometricApi.deleteEnrollment(item.id, session);
            refresh();
          },
        },
      ],
    );

  const importCsv = async () => {
    const rows = csvText.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) {
      setEnrollmentError("Paste a CSV header and at least one enrollment row.");
      return;
    }
    const headers = rows[0]
      .split(",")
      .map((value) => value.trim().toLowerCase());
    const indexOf = (...names) =>
      names.map((name) => headers.indexOf(name)).find((index) => index >= 0);
    const personIndex = indexOf("person name", "person", "user", "person_name");
    const codeIndex = indexOf(
      "admission / staff code",
      "admission code",
      "staff code",
      "erp id",
      "erpid",
    );
    const uidIndex = indexOf("biometric machine uid", "biometric uid", "uid");
    const categoryIndex = indexOf("category");
    const deviceIndex = indexOf("assigned machine", "device");
    if (
      [personIndex, codeIndex, uidIndex].some((index) => index === undefined)
    ) {
      setEnrollmentError(
        "CSV must include Person, Admission/Staff Code, and Biometric UID columns.",
      );
      return;
    }
    const seen = new Set(
      snapshot.enrollments.map((item) => String(item.biometricUid)),
    );
    const imported = [];
    for (const row of rows.slice(1)) {
      const values = row.split(",").map((value) => value.trim());
      const item = {
        user: values[personIndex],
        category: values[categoryIndex] || "Student",
        erpId: values[codeIndex],
        biometricUid: values[uidIndex],
        device: values[deviceIndex] || "All Machines",
      };
      if (
        !item.user ||
        !item.erpId ||
        !item.biometricUid ||
        seen.has(item.biometricUid)
      )
        continue;
      seen.add(item.biometricUid);
      imported.push(item);
    }
    if (!imported.length) {
      setEnrollmentError(
        "No valid new enrollment rows were found. Existing mappings were not overwritten.",
      );
      return;
    }
    await biometricApi.bulkImportEnrollments(imported, session);
    setShowCsvModal(false);
    setCsvText("");
    setEnrollmentError("");
    await refresh();
    Alert.alert(
      "CSV imported",
      `${imported.length} enrollment mapping(s) imported.`,
    );
  };

  const exportEnrollments = async () => {
    const rows = [
      [
        "Person Name",
        "Category",
        "Class & Section",
        "Admission / Staff Code",
        "Biometric Machine UID",
        "Assigned Machine",
        "Enrolled Date",
      ],
      ...filteredEnrollments.map((item) => [
        item.user || item.person_name,
        item.category,
        `${item.className || ""} - ${item.section || ""}`,
        item.erpId || item.admission_or_staff_code,
        item.biometricUid,
        item.device || item.assigned_machine,
        item.enrolledDate || item.enrolled_date || "",
      ]),
    ];
    if (!filteredEnrollments.length) {
      Alert.alert(
        "Nothing to export",
        "No enrollment records match the current filters.",
      );
      return;
    }
    await Share.share({
      title: "User Enrollments CSV",
      message: rows
        .map((row) =>
          row
            .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n"),
    });
  };

  const simulatePunch = async () => {
    if (!simulator.biometricUid.trim()) {
      Alert.alert("UID required", "Enter a biometric UID.");
      return;
    }
    const event = await biometricApi.simulatePunch(simulator, session);
    await refresh();
    Alert.alert(
      "TEST / SIMULATED punch created",
      event.status === "Mapped"
        ? `Mapped to ${event.student}.`
        : "The UID is currently unmapped.",
    );
  };

  const simulateWebhookEvent = async () => {
    if (webhookSending) return;
    if (!webhookApiKey.trim()) {
      setWebhookMessage("Invalid Device API Key.");
      return;
    }
    if (!webhookUid.trim()) {
      setWebhookMessage("Please enter a valid Biometric UID.");
      return;
    }
    setWebhookSending(true);
    setWebhookMessage("");
    try {
      const response = await biometricApi.simulateWebhookEvent(
        {
          apiKey: webhookApiKey.trim(),
          biometricUid: webhookUid.trim(),
          timestamp: webhookTimestamp.toISOString(),
        },
        session,
      );
      setWebhookMessage(
        response?.available === false
          ? "Punch event simulated successfully. Backend webhook is not configured; no event was sent."
          : `Punch event simulated successfully. Status: ${response?.status || "Processed"}.`,
      );
      setWebhookApiKey("");
    } catch (requestError) {
      setWebhookMessage(
        requestError?.status === 401
          ? "Device authentication failed."
          : requestError?.status === 403
            ? "Invalid Device API Key."
            : "Unable to connect to the webhook endpoint. Please try again.",
      );
    } finally {
      setWebhookSending(false);
    }
  };

  const closeDeviceModal = () => {
    if (registering) return;
    setDevice(blankDevice);
    setDeviceError("");
    setShowDeviceModal(false);
  };

  const renderDeviceModal = () => (
    <Modal
      visible={showDeviceModal}
      transparent
      animationType="slide"
      onRequestClose={closeDeviceModal}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.registrationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Register Biometric Device</Text>
            <Pressable
              accessibilityLabel="Close registration form"
              disabled={registering}
              onPress={closeDeviceModal}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {deviceError ? (
            <Text style={styles.formError}>{deviceError}</Text>
          ) : null}
          <Field
            label="Device Name *"
            value={device.name}
            onChangeText={(value) => {
              setDevice({ ...device, name: value });
              setDeviceError("");
            }}
            placeholder="e.g. Main Gate Scanner"
          />
          <Field
            label="Serial Number"
            value={device.deviceId}
            onChangeText={(value) => {
              setDevice({ ...device, deviceId: value });
              setDeviceError("");
            }}
            placeholder="e.g. HIK-99201"
          />
          <Field
            label="Location"
            value={device.location}
            onChangeText={(value) => {
              setDevice({ ...device, location: value });
              setDeviceError("");
            }}
            placeholder="e.g. Main Entrance"
          />
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              secondary
              onPress={closeDeviceModal}
              icon="close-outline"
            />
            <Button
              title="Register Device"
              onPress={registerDevice}
              icon="checkmark-outline"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEnrollmentModal = () => (
    <Modal
      visible={showEnrollmentModal}
      transparent
      animationType="slide"
      onRequestClose={() => !enrollmentSaving && setShowEnrollmentModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.registrationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingEnrollment ? "Edit Enrollment" : "Enroll UID"}
            </Text>
            <Pressable
              disabled={enrollmentSaving}
              onPress={() => setShowEnrollmentModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {enrollmentError ? (
            <Text style={styles.formError}>{enrollmentError}</Text>
          ) : null}
          <Field
            label="Person / User"
            value={enrollment.user}
            onChangeText={(value) =>
              setEnrollment({ ...enrollment, user: value })
            }
            placeholder="Existing ERP person"
          />
          <Field
            label="Category"
            value={enrollment.category}
            onChangeText={(value) =>
              setEnrollment({ ...enrollment, category: value })
            }
            placeholder="Student / Teacher / Parent / Staff"
          />
          <Field
            label="Admission / Staff Code"
            value={enrollment.erpId}
            onChangeText={(value) =>
              setEnrollment({ ...enrollment, erpId: value })
            }
            placeholder="Existing ERP code"
          />
          <Field
            label="Biometric Machine UID"
            value={enrollment.biometricUid}
            onChangeText={(value) =>
              setEnrollment({ ...enrollment, biometricUid: value })
            }
            placeholder="Scanner UID"
          />
          <Field
            label="Assigned Machine"
            value={enrollment.device}
            onChangeText={(value) =>
              setEnrollment({ ...enrollment, device: value })
            }
            placeholder="All Machines or device ID"
          />
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              secondary
              onPress={() => setShowEnrollmentModal(false)}
              icon="close-outline"
            />
            <Button
              title="Enroll UID"
              onPress={saveEnrollment}
              icon="checkmark-outline"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEnrollmentModalV2 = () => {
    const pickerOptions =
      candidateSelector === "category"
        ? ["Student", "Teacher", "Staff"]
        : candidateSelector === "class"
          ? ["All Classes", ...candidateClasses]
          : candidateSelector === "section"
            ? ["All Sections", ...candidateSections]
            : [
                "All Devices / Gate Scanners",
                ...snapshot.devices.map((item) => item.id),
              ];
    return (
      <Modal
        visible={showEnrollmentModal}
        transparent
        animationType="slide"
        onRequestClose={() =>
          !enrollmentSaving && setShowEnrollmentModal(false)
        }
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.registrationModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Enroll Biometric Machine UID
              </Text>
              <Pressable
                disabled={enrollmentSaving}
                onPress={() => setShowEnrollmentModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            {enrollmentError ? (
              <Text style={styles.formError}>{enrollmentError}</Text>
            ) : null}
            <Text style={styles.fieldLabel}>Person Category</Text>
            <Pressable
              style={styles.enrollmentSelect}
              onPress={() => setCandidateSelector("category")}
            >
              <Text style={styles.filterSelectText}>{candidateCategory}</Text>
              <Icon name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
            <Text style={styles.fieldLabel}>Filter Class</Text>
            <Pressable
              style={styles.enrollmentSelect}
              onPress={() => setCandidateSelector("class")}
            >
              <Text style={styles.filterSelectText}>{candidateClass}</Text>
              <Icon name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
            <Text style={styles.fieldLabel}>Filter Section</Text>
            <Pressable
              style={styles.enrollmentSelect}
              onPress={() => setCandidateSelector("section")}
            >
              <Text style={styles.filterSelectText}>{candidateSection}</Text>
              <Icon name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
            <Text style={styles.fieldLabel}>
              Select Candidate * ({visibleCandidates.length} available)
            </Text>
            <Pressable
              style={styles.enrollmentSelect}
              onPress={() => setCandidateSelector("candidate")}
            >
              <Text style={styles.filterSelectText}>
                {enrollment.user || "Select Candidate..."}
              </Text>
              <Icon name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
            {candidateSelector === "candidate" ? (
              <View style={styles.candidatePicker}>
                <TextInput
                  value={candidateSearch}
                  onChangeText={setCandidateSearch}
                  placeholder="Search candidate..."
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                {candidateLoading ? (
                  <ActivityIndicator color={colors.blue} />
                ) : visibleCandidates.length ? (
                  visibleCandidates.map((item) => (
                    <Pressable
                      key={item.id || item.erpId}
                      style={styles.candidateOption}
                      onPress={() => {
                        setEnrollment({
                          ...enrollment,
                          user: item.name || item.personName,
                          category: candidateCategory,
                          erpId:
                            item.erpId ||
                            item.admissionOrStaffCode ||
                            item.employeeCode,
                          className: item.className,
                          section: item.section,
                        });
                        setCandidateSelector(null);
                      }}
                    >
                      <Text style={styles.listTitle}>
                        {item.name || item.personName}
                      </Text>
                      <Text style={styles.meta}>
                        {item.erpId ||
                          item.admissionOrStaffCode ||
                          item.employeeCode}{" "}
                        · {item.className || "-"} - {item.section || "-"}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.meta}>No Candidates Available</Text>
                )}
              </View>
            ) : null}
            <Field
              label="Biometric Machine UID *"
              value={enrollment.biometricUid}
              onChangeText={(value) =>
                setEnrollment({ ...enrollment, biometricUid: value })
              }
              placeholder="e.g. S001 or 1001"
            />
            <Text style={styles.fieldLabel}>Assigned Device (Optional)</Text>
            <Pressable
              style={styles.enrollmentSelect}
              onPress={() => setCandidateSelector("device")}
            >
              <Text style={styles.filterSelectText}>
                {enrollment.device || "All Devices / Gate Scanners"}
              </Text>
              <Icon name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                secondary
                onPress={() => setShowEnrollmentModal(false)}
                icon="close-outline"
              />
              <Button
                title="Save Mapping"
                onPress={saveEnrollment}
                icon="checkmark-outline"
              />
            </View>
            {candidateSelector && candidateSelector !== "candidate" ? (
              <View style={styles.inlinePicker}>
                {pickerOptions.map((option) => (
                  <Pressable
                    key={option}
                    style={styles.filterOption}
                    onPress={() => {
                      if (candidateSelector === "category") {
                        setCandidateCategory(option);
                        setCandidateClass("All Classes");
                        setCandidateSection("All Sections");
                        loadEnrollmentCandidates(
                          option,
                          "All Classes",
                          "All Sections",
                        );
                      }
                      if (candidateSelector === "class") {
                        setCandidateClass(option);
                        setCandidateSection("All Sections");
                        loadEnrollmentCandidates(
                          candidateCategory,
                          option,
                          "All Sections",
                        );
                      }
                      if (candidateSelector === "section") {
                        setCandidateSection(option);
                        loadEnrollmentCandidates(
                          candidateCategory,
                          candidateClass,
                          option,
                        );
                      }
                      if (candidateSelector === "device")
                        setEnrollment({
                          ...enrollment,
                          device:
                            option === "All Devices / Gate Scanners"
                              ? ""
                              : option,
                        });
                      setCandidateSelector(null);
                    }}
                  >
                    {option}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const renderCsvModal = () => (
    <Modal
      visible={showCsvModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCsvModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.registrationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Auto-Map / CSV</Text>
            <Pressable
              onPress={() => setShowCsvModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.modalHint}>
            Paste CSV rows with Person Name, Admission / Staff Code, and
            Biometric Machine UID columns.
          </Text>
          <TextInput
            multiline
            value={csvText}
            onChangeText={setCsvText}
            placeholder="Person Name,Admission Code,Biometric UID,Category,Assigned Machine"
            placeholderTextColor={colors.muted}
            style={styles.csvInput}
          />
          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              secondary
              onPress={() => setShowCsvModal(false)}
              icon="close-outline"
            />
            <Button
              title="Import CSV"
              onPress={importCsv}
              icon="cloud-upload-outline"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderFilterModal = () => (
    <Modal
      visible={Boolean(filterSelector)}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterSelector(null)}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => setFilterSelector(null)}
      >
        <View style={styles.filterModal} onStartShouldSetResponder={() => true}>
          <Text style={styles.modalTitle}>
            Select{" "}
            {filterSelector === "category"
              ? "Category"
              : filterSelector === "class"
                ? "Class"
                : "Section"}
          </Text>
          {filterOptions.map((option) => (
            <Pressable
              key={option}
              style={styles.filterOption}
              onPress={() => {
                if (filterSelector === "category") setCategoryFilter(option);
                if (filterSelector === "class") {
                  setClassFilter(option);
                  if (option === "All Classes")
                    setSectionFilter("All Sections");
                }
                if (filterSelector === "section") setSectionFilter(option);
                setFilterSelector(null);
              }}
            >
              <Text style={styles.filterOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );

  const renderBulkModal = () => (
    <Modal
      visible={showBulkModal}
      transparent
      animationType="slide"
      onRequestClose={() => !bulkLoading && setShowBulkModal(false)}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.registrationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bulk Biometric Auto-Mapping</Text>
            <Pressable
              disabled={bulkLoading}
              onPress={() => setShowBulkModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {enrollmentError ? (
            <Text style={styles.formError}>{enrollmentError}</Text>
          ) : null}
          {bulkResult ? (
            <View>
              <Text style={styles.resultTitle}>
                Bulk Auto-Mapping Completed
              </Text>
              <Text style={styles.resultText}>
                Successfully Mapped: {bulkResult.mapped || 0}
                {"\n"}Skipped: {bulkResult.skipped || 0}
                {"\n"}Already Mapped: {bulkResult.alreadyMapped || 0}
                {"\n"}Failed: {bulkResult.failed || 0}
              </Text>
              <Button
                title="Done"
                onPress={() => setShowBulkModal(false)}
                icon="checkmark-outline"
              />
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.choiceRow}>
                {["Students", "Teachers", "Staff"].map((category) => (
                  <Pressable
                    key={category}
                    style={[
                      styles.choice,
                      bulkCategory === category && styles.choiceActive,
                    ]}
                    onPress={() => {
                      setBulkCategory(category);
                      loadBulkCandidates(category);
                    }}
                  >
                    <Text style={styles.choiceText}>{category}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.bulkSectionTitle}>1-Click Auto Mapping</Text>
              <Text style={styles.modalHint}>
                Assigns each candidate's Admission No or Employee Code as their
                Biometric UID.
              </Text>
              {bulkLoading ? (
                <View style={styles.bulkLoading}>
                  <ActivityIndicator color={colors.blue} />
                  <Text style={styles.meta}>
                    {bulkProgress
                      ? `Mapping biometric UIDs... ${bulkProgress.completed} / ${bulkProgress.total} completed`
                      : "Loading candidates..."}
                  </Text>
                </View>
              ) : null}
              {!bulkLoading && !bulkCandidates.length ? (
                <Empty
                  title="No Candidates Available"
                  message="All users in this category are already mapped or required Admission/Employee Codes are missing."
                />
              ) : (
                <Button
                  title={`Auto-Map ${bulkCandidates.length} ${bulkCategory.toLowerCase()}`}
                  onPress={autoMap}
                  icon="flash-outline"
                />
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderEnrollments = () => (
    <View>
      <View style={styles.enrollmentActions}>
        <Button
          title="Bulk Auto-Map / CSV"
          secondary
          onPress={openBulkModal}
          icon="cloud-upload-outline"
        />
        <Button
          title="Enroll UID"
          onPress={() => openEnrollment()}
          icon="add-outline"
        />
      </View>
      <View style={styles.searchWrap}>
        <Icon name="search-outline" size={17} color={colors.muted} />
        <TextInput
          value={enrollmentSearch}
          onChangeText={setEnrollmentSearch}
          placeholder="Search name, code, or UID..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.enrollmentFilters}>
        <Pressable
          style={styles.filterSelect}
          onPress={() => setFilterSelector("category")}
        >
          <Text style={styles.filterSelectText}>{categoryFilter}</Text>
          <Icon name="chevron-down" size={15} color={colors.muted} />
        </Pressable>
        <Pressable
          style={styles.filterSelect}
          onPress={() => setFilterSelector("class")}
        >
          <Text style={styles.filterSelectText}>{classFilter}</Text>
          <Icon name="chevron-down" size={15} color={colors.muted} />
        </Pressable>
        <Pressable
          style={styles.filterSelect}
          onPress={() => setFilterSelector("section")}
        >
          <Text style={styles.filterSelectText}>{sectionFilter}</Text>
          <Icon name="chevron-down" size={15} color={colors.muted} />
        </Pressable>
      </View>
      <Button
        title="Export CSV"
        secondary
        onPress={exportEnrollments}
        icon="download-outline"
      />
      <Text style={styles.tableLabels}>
        Person Name | Category | Class & Section | Admission / Staff Code |
        Biometric Machine UID | Assigned Machine | Enrolled Date | Actions
      </Text>
      {filteredEnrollments.length ? (
        filteredEnrollments.map((item) => (
          <View key={item.id} style={styles.listCard}>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>
                {item.user || item.person_name}
              </Text>
              <Text style={styles.meta}>
                Category: {item.category || "Student"} · Class & Section:{" "}
                {item.className || "-"} - {item.section || "-"}
              </Text>
              <Text style={styles.meta}>
                Admission / Staff Code:{" "}
                {item.erpId || item.admission_or_staff_code} · Biometric Machine
                UID: {item.biometricUid}
              </Text>
              <Text style={styles.meta}>
                Assigned Machine:{" "}
                {item.device || item.assigned_machine || "All Machines"} ·
                Enrolled Date:{" "}
                {item.enrolledDate || item.enrolled_date || "Not recorded"}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => openEnrollment(item)}>
                <Icon name="create-outline" size={20} color={colors.blue} />
              </Pressable>
              <Pressable onPress={() => removeEnrollment(item)}>
                <Icon name="trash-outline" size={20} color={colors.red} />
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty
          title={
            enrollmentSearch ||
            !categoryFilter.startsWith("All Categories") ||
            classFilter !== "All Classes" ||
            sectionFilter !== "All Sections"
              ? "No records found matching your criteria"
              : "No User Enrollments"
          }
          message="No biometric UID mappings are available."
          action="Enroll UID"
          onAction={() => openEnrollment()}
        />
      )}
    </View>
  );

  const renderEnrollmentScreen = () => (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Biometric Device & Hardware Suite</Text>
        <Text style={styles.status}>Push API / ISAPI Active</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {tabs.map((tab) => {
            const label =
              tab === "Registered Devices"
                ? `${tab} (${snapshot.devices.length})`
                : tab === "User Enrollments"
                  ? `${tab} (${snapshot.enrollments.length})`
                  : tab;
            return (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.sectionTitle}>
          User Enrollments ({snapshot.enrollments.length})
        </Text>
        {renderEnrollments()}
      </ScrollView>
      {renderEnrollmentModalV2()}
      {renderBulkModal()}
      {renderFilterModal()}
    </>
  );

  if (activeTab === "User Enrollments") return renderEnrollmentScreen();

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Biometric Device & Hardware Suite</Text>
            <Text style={styles.status}>Push API / ISAPI Active</Text>
            <Text style={styles.subtitle}>
              Manage scanners (Hikvision, ZKTeco, Dahua), user UID mappings &
              live attendance streams
            </Text>
          </View>
          <Icon name="hardware-chip-outline" size={30} color={colors.blue} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.summaryGrid}>
          <SummaryCard
            value={snapshot.devices.length}
            label="Machines"
            icon="hardware-chip-outline"
            backgroundColor={colors.paleBlue}
          />
          <SummaryCard
            value={online}
            label="Online"
            icon="wifi-outline"
            backgroundColor={colors.paleGreen}
          />
          <SummaryCard
            value={snapshot.enrollments.length}
            label="Enrolled"
            icon="people-outline"
            backgroundColor={colors.paleOrange}
          />
          <SummaryCard
            value={unmapped}
            label="Unmapped"
            icon="help-circle-outline"
            backgroundColor={colors.paleRed}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {tabs.map((tab) => {
            const label =
              tab === "Registered Devices"
                ? `${tab} (${snapshot.devices.length})`
                : tab === "User Enrollments"
                  ? `${tab} (${snapshot.enrollments.length})`
                  : tab;
            return (
              <Pressable
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {loading ? (
          <ActivityIndicator color={colors.blue} style={styles.loader} />
        ) : null}
        {activeTab === "Registered Devices" ? (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Registered Devices ({snapshot.devices.length})
              </Text>
              <Button
                title="Register Device"
                onPress={() => setShowDeviceForm(true)}
                icon="add-outline"
              />
            </View>
            {showDeviceForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Register biometric device</Text>
                <Field
                  label="Device Name"
                  value={device.name}
                  onChangeText={(value) =>
                    setDevice({ ...device, name: value })
                  }
                  placeholder="Main entrance scanner"
                />
                <Text style={styles.fieldLabel}>Device Type</Text>
                <View style={styles.choiceRow}>
                  {deviceTypes.map((type) => (
                    <Pressable
                      key={type}
                      style={[
                        styles.choice,
                        device.type === type && styles.choiceActive,
                      ]}
                      onPress={() => setDevice({ ...device, type })}
                    >
                      <Text style={styles.choiceText}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  label="Device ID / Serial Number"
                  value={device.deviceId}
                  onChangeText={(value) =>
                    setDevice({ ...device, deviceId: value })
                  }
                  placeholder="Device serial"
                />
                <Field
                  label="IP Address / Host"
                  value={device.host}
                  onChangeText={(value) =>
                    setDevice({ ...device, host: value })
                  }
                  placeholder="192.168.1.20"
                />
                <Field
                  label="Port"
                  value={device.port}
                  onChangeText={(value) =>
                    setDevice({ ...device, port: value })
                  }
                  placeholder="80"
                  keyboardType="number-pad"
                />
                <Field
                  label="Username"
                  value={device.username}
                  onChangeText={(value) =>
                    setDevice({ ...device, username: value })
                  }
                  placeholder="Backend-managed username"
                />
                <Field
                  label="Password"
                  value={device.password}
                  onChangeText={(value) =>
                    setDevice({ ...device, password: value })
                  }
                  placeholder="Not stored in mock"
                  secureTextEntry
                />
                <Field
                  label="Protocol"
                  value={device.protocol}
                  onChangeText={(value) =>
                    setDevice({ ...device, protocol: value })
                  }
                  placeholder="HTTP / HTTPS / ISAPI"
                />
                <View style={styles.actions}>
                  <Button
                    title="Cancel"
                    secondary
                    onPress={() => setShowDeviceForm(false)}
                    icon="close-outline"
                  />
                  <Button
                    title="Register"
                    onPress={registerDevice}
                    icon="checkmark-outline"
                  />
                </View>
              </View>
            ) : null}
            {snapshot.devices.length === 0 && !showDeviceForm ? (
              <Empty
                title="No Devices Registered"
                message="Connect a supported scanner through the backend integration."
                action="Register First Device"
                onAction={() => setShowDeviceForm(true)}
              />
            ) : (
              snapshot.devices.map((deviceItem) => (
                <View key={deviceItem.id} style={styles.listCard}>
                  <View style={styles.listIcon}>
                    <Icon
                      name="hardware-chip-outline"
                      size={21}
                      color={colors.blue}
                    />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{deviceItem.name}</Text>
                    <Text style={styles.meta}>
                      {deviceItem.type} · {deviceItem.deviceId}
                    </Text>
                    <Text style={styles.meta}>
                      {deviceItem.host}:{deviceItem.port} ·{" "}
                      {deviceItem.status || "Unknown"}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <Button
                      title="Test"
                      secondary
                      onPress={() => testConnection(deviceItem)}
                      icon="wifi-outline"
                    />
                    <Pressable onPress={() => deleteDevice(deviceItem)}>
                      <Icon name="trash-outline" size={19} color={colors.red} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}
        {activeTab === "User Enrollments" ? (
          <View>
            <Text style={styles.sectionTitle}>
              User Enrollments ({snapshot.enrollments.length})
            </Text>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                Map ERP user to biometric UID
              </Text>
              <Field
                label="ERP Student/User"
                value={enrollment.user}
                onChangeText={(value) =>
                  setEnrollment({ ...enrollment, user: value })
                }
                placeholder="Existing ERP user"
              />
              <Field
                label="ERP ID"
                value={enrollment.erpId}
                onChangeText={(value) =>
                  setEnrollment({ ...enrollment, erpId: value })
                }
                placeholder="Existing student/user ID"
              />
              <Field
                label="Biometric UID"
                value={enrollment.biometricUid}
                onChangeText={(value) =>
                  setEnrollment({ ...enrollment, biometricUid: value })
                }
                placeholder="Scanner UID"
              />
              <Field
                label="Device"
                value={enrollment.device}
                onChangeText={(value) =>
                  setEnrollment({ ...enrollment, device: value })
                }
                placeholder="Registered device ID"
              />
              <Button
                title="Save UID Mapping"
                onPress={saveEnrollment}
                icon="link-outline"
              />
            </View>
            {snapshot.enrollments.length ? (
              snapshot.enrollments.map((item) => (
                <View key={item.id} style={styles.listCard}>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>
                      {item.user} · {item.erpId}
                    </Text>
                    <Text style={styles.meta}>
                      UID {item.biometricUid} · Device {item.device}
                    </Text>
                    <Text style={styles.meta}>
                      {item.status || "Mapped"} · Last sync{" "}
                      {item.lastSync || "Not synced"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      await biometricApi.deleteEnrollment(item.id, session);
                      refresh();
                    }}
                  >
                    <Icon name="trash-outline" size={19} color={colors.red} />
                  </Pressable>
                </View>
              ))
            ) : (
              <Empty
                title="No User Enrollments"
                message="Map an existing ERP student or user to a device UID."
              />
            )}
          </View>
        ) : null}
        {activeTab === "Live Punch Feeds" ? (
          <View>
            <Text style={styles.sectionTitle}>Live Punch Feeds</Text>
            <View style={styles.punchControls}>
              <View style={styles.searchWrap}>
                <Icon name="search-outline" size={17} color={colors.muted} />
                <TextInput
                  value={punchSearch}
                  onChangeText={setPunchSearch}
                  placeholder="Filter by name, code, UID..."
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.punchActions}>
                <Pressable
                  style={styles.refreshButton}
                  onPress={() => loadPunches(false)}
                  disabled={punchLoading}
                >
                  <Icon name="refresh-outline" size={16} color={colors.blue} />
                  <Text style={styles.refreshText}>
                    {punchLoading ? "Refreshing..." : "Refresh"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setAutoRefreshPunches((value) => !value)}
                >
                  <View
                    style={[
                      styles.toggle,
                      autoRefreshPunches && styles.toggleOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleKnob,
                        autoRefreshPunches && styles.toggleKnobOn,
                      ]}
                    />
                  </View>
                  <Text style={styles.toggleText}>Auto-Refresh (5s)</Text>
                </Pressable>
              </View>
            </View>
            {punchError ? <Text style={styles.error}>{punchError}</Text> : null}
            {punchLoading && !punches.length ? (
              <View style={styles.feedLoading}>
                <ActivityIndicator color={colors.blue} />
                <Text style={styles.meta}>Loading live punch feeds...</Text>
              </View>
            ) : null}
            {punches.length && visiblePunches.length ? (
              visiblePunches.map((punch) => (
                <View key={punchKey(punch)} style={styles.listCard}>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>
                      {punch.personName ||
                        punch.student ||
                        punch.name ||
                        "Unknown User"}
                    </Text>
                    <Text style={styles.meta}>
                      {punch.category || "Unknown"} ·{" "}
                      {punch.admissionOrStaffCode ||
                        punch.erpId ||
                        punch.employeeCode ||
                        "Code unavailable"}
                    </Text>
                    <Text style={styles.meta}>
                      UID: {punch.biometricUid || punch.uid || "Unknown"} ·
                      Device:{" "}
                      {punch.device || punch.assignedDevice || "Unknown"}
                    </Text>
                    <Text style={styles.meta}>
                      {punch.timestamp || punch.time || "Unknown time"} · Punch:{" "}
                      {punch.punchType || punch.type || "Unknown"} · Status:{" "}
                      {punch.status || "Unmapped"}
                      {punch.simulated ? " · TEST / SIMULATED" : ""}
                    </Text>
                  </View>
                </View>
              ))
            ) : punches.length ? (
              <Empty
                title="No records found matching your search."
                message="Try a different name, code, or UID."
              />
            ) : (
              <Empty
                title={`No attendance punches logged for date ${new Date().toISOString().slice(0, 10)}.`}
                message="Refresh or enable Auto-Refresh to check for new punches."
              />
            )}
          </View>
        ) : null}
        {activeTab === "Webhook & Test Simulator" ? (
          <View>
            <Text style={styles.sectionTitle}>
              ISAPI / Push API Webhook Configuration
            </Text>
            <View style={styles.formCard}>
              <Text style={styles.modalHint}>
                Configure hardware scanners (Hikvision ISAPI / ZKteco Push API)
                to POST attendance events to:
              </Text>
              <Text style={styles.endpoint}>
                POST {getApiBaseUrl() ? `${getApiBaseUrl()}/biometric/event` : "/api/biometric/event"}
              </Text>
              <Text style={styles.meta}>
                Content-Type: application/json{`\n`}x-api-key:
                [YOUR_DEVICE_API_KEY]
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Live Webhook Simulator</Text>
            <View style={styles.formCard}>
              <Text style={styles.simulatedLabel}>TEST / SIMULATED</Text>
              <Field
                label="Target Device API Key *"
                value={webhookApiKey}
                onChangeText={setWebhookApiKey}
                placeholder="Enter Device API Key"
                secureTextEntry
              />
              <Field
                label="Biometric UID *"
                value={webhookUid}
                onChangeText={setWebhookUid}
                placeholder="e.g. S001 or 101"
              />
              <Text style={styles.fieldLabel}>Timestamp</Text>
              <Pressable
                style={styles.enrollmentSelect}
                onPress={() => setShowWebhookDatePicker(true)}
              >
                <Text style={styles.filterSelectText}>
                  {webhookTimestamp.toLocaleString()}
                </Text>
                <Icon name="calendar-outline" size={16} color={colors.muted} />
              </Pressable>
              {showWebhookDatePicker ? (
                <DateTimePicker
                  value={webhookTimestamp}
                  mode="datetime"
                  onChange={(_, selectedDate) => {
                    setShowWebhookDatePicker(false);
                    if (selectedDate) setWebhookTimestamp(selectedDate);
                  }}
                />
              ) : null}
              <Button
                title={
                  webhookSending
                    ? "Sending Punch Event..."
                    : "Simulate Punch Event"
                }
                onPress={simulateWebhookEvent}
                icon="flash-outline"
              />
              {webhookMessage ? (
                <Text style={styles.webhookMessage}>{webhookMessage}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
      {renderDeviceModal()}
    </>
  );
}

const styles = StyleSheet.create({
  enrollmentActions: { flexDirection: "row", gap: 7, marginBottom: 10 },
  enrollmentFilters: { flexDirection: "row", gap: 6, marginVertical: 9 },
  filterSelect: {
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
  filterSelectText: { color: colors.ink, fontSize: 10, flex: 1 },
  filterModal: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 15,
    maxHeight: "75%",
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  filterOptionText: { color: colors.ink, fontSize: 13 },
  enrollmentSelect: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  candidatePicker: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 8,
    marginBottom: 9,
    maxHeight: 180,
    gap: 5,
  },
  candidateOption: {
    padding: 8,
    borderRadius: 7,
    backgroundColor: colors.paleBlue,
  },
  inlinePicker: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    maxHeight: 170,
  },
  punchControls: { marginBottom: 10 },
  punchActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  refreshButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  refreshText: { color: colors.blue, fontSize: 10, fontWeight: "900" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggle: {
    width: 34,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.line,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: colors.blue },
  toggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  toggleKnobOn: { alignSelf: "flex-end" },
  toggleText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  feedLoading: { alignItems: "center", gap: 8, paddingVertical: 18 },
  tableLabels: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 15,
    marginVertical: 10,
  },
  modalHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
  },
  csvInput: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    color: colors.ink,
    fontSize: 11,
    textAlignVertical: "top",
  },
  bulkSectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 5,
  },
  bulkLoading: { alignItems: "center", gap: 8, paddingVertical: 14 },
  resultTitle: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  resultText: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 23,
    marginBottom: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 31, 0.4)",
    justifyContent: "flex-end",
  },
  registrationModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", flex: 1 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paleBlue,
  },
  closeText: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  formError: {
    color: colors.red,
    backgroundColor: colors.paleRed,
    borderRadius: 8,
    padding: 9,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  content: { padding: 16, paddingBottom: 35 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  status: {
    color: colors.green,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 7,
  },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  error: {
    color: colors.red,
    backgroundColor: colors.paleRed,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 14,
  },
  summaryCard: {
    width: "48%",
    minHeight: 88,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 7,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  tabs: { marginBottom: 14 },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginRight: 7,
  },
  activeTab: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  activeTabText: { color: colors.white },
  loader: { marginVertical: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  button: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  buttonText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  secondaryButton: { backgroundColor: colors.paleBlue },
  secondaryButtonText: { color: colors.blue },
  formCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 13,
    marginBottom: 10,
  },
  formTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  field: { marginBottom: 9 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 5,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colors.ink,
    fontSize: 12,
  },
  choiceRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  choiceActive: { borderColor: colors.blue, backgroundColor: colors.paleBlue },
  choiceText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  listCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  listCopy: { flex: 1 },
  listTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  empty: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
    marginBottom: 13,
  },
  simulatedLabel: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 6,
  },
});
