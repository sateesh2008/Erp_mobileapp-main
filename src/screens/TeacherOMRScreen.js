import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { omrApi } from "../services/omrApi";

const colors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  teal: "#334BD6",
  paleTeal: "#E9EBFB",
  orange: "#D9822B",
  paleOrange: "#FFF1DF",
  red: "#C65353",
  paleRed: "#FDECEC",
  plum: "#5A4AB6",
  softLilac: "#F5F1FF",
};

const OMR_SUBMENUS = [
  "OMR Dashboard",
  "Exam Sessions",
  "Answer Keys",
  "Hardware & Optical Scanner",
  "Results & Leaderboards",
];

const OMR_TABS = [
  "Printable OMR Sheet",
  "Sessions (1)",
  "Answer Keys",
  "Scanner & Reader",
  "Results & Ranks",
  "Export CSV",
];

const BOOKLET_SETS = ["Set A", "Set B", "Set C", "Set D"];
const ANSWER_OPTIONS = ["A", "B", "C", "D", "-"];
const QUESTION_COUNT = 180;
const DEFAULT_EXAM = "";
const DEFAULT_EXAM_LABEL = "";

const normalizeCandidateResult = (
  candidate,
  fallbackExamName = DEFAULT_EXAM_LABEL,
  examId = "omr-session-1",
) => {
  const rollNumber =
    candidate.rollNumber ||
    candidate.rollNo ||
    candidate.admissionNumber ||
    "—";
  const studentName =
    candidate.studentName || candidate.student || "Unknown Candidate";
  return {
    id:
      candidate.id ||
      `${candidate.studentName || candidate.student || "candidate"}-${candidate.rollNumber || candidate.rollNo || Math.random()}`,
    examId: candidate.examId || examId,
    examName: candidate.examName || fallbackExamName || DEFAULT_EXAM_LABEL,
    rank: Number(candidate.rank || 1),
    studentName,
    rollNumber,
    booklet: candidate.booklet || "Set A",
    totalScore: Number(candidate.totalScore ?? candidate.score ?? 0),
    maxScore: Number(candidate.maxScore ?? 720),
    correct: Number(candidate.correct ?? 0),
    wrong: Number(candidate.wrong ?? 0),
    blank: Number(candidate.blank ?? candidate.unanswered ?? 0),
    admissionNumber: candidate.admissionNumber || rollNumber,
  };
};

const toResultRows = (
  list = [],
  fallbackExamName = DEFAULT_EXAM_LABEL,
  examId = "omr-session-1",
) =>
  Array.isArray(list)
    ? list.map((candidate) =>
        normalizeCandidateResult(candidate, fallbackExamName, examId),
      )
    : [];

function Icon({ name, size = 18, color = colors.ink }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function createQuestionRows() {
  return Array.from({ length: QUESTION_COUNT }, (_, index) => ({
    id: index + 1,
    number: index + 1,
    subject: index === 0 ? "maths" : "Physics",
    answer: "-",
  }));
}

function buildStandardPattern() {
  const sequence = ["A", "B", "C", "D"];
  return createQuestionRows().map((question, index) => ({
    ...question,
    answer: sequence[index % sequence.length],
  }));
}

function createInitialSetState() {
  return Object.fromEntries(BOOKLET_SETS.map((setName) => [setName, []]));
}

function parsePastedAnswers(rawText) {
  const normalized = String(rawText || "")
    .toUpperCase()
    .replace(/[^A-Z0-9,\s\n\-]/g, " ");

  const tokens = normalized
    .split(/[\s,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return tokens.filter((token) => ANSWER_OPTIONS.includes(token));
}

function validateSetAnswers(rows) {
  if (!Array.isArray(rows) || rows.length !== QUESTION_COUNT) {
    return false;
  }

  return rows.every((row) => row && ANSWER_OPTIONS.includes(row.answer));
}

function makeEvaluationSnapshot(answerRows, examName) {
  const basePattern = buildStandardPattern();
  const attempted = answerRows.filter(
    (row) => row.answer && row.answer !== "-",
  ).length;
  const correct = answerRows.filter(
    (row, index) => row.answer && row.answer === basePattern[index].answer,
  ).length;
  const unanswered = QUESTION_COUNT - attempted;
  const incorrect = attempted - correct;
  const score = correct * 4 - incorrect;

  return {
    examName,
    correct,
    incorrect,
    unanswered,
    attempted,
    score,
    percentage: Math.round((correct / QUESTION_COUNT) * 100),
  };
}

function formatScoreValue(value) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return numericValue.toFixed(2);
}

function formatAverage(value) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return numericValue.toFixed(1);
}

function SelectBox({ label, value, onPress }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={styles.selectBox}>
        <Text style={styles.selectBoxText}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  primary = false,
  compact = false,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        primary ? styles.primaryAction : styles.secondaryAction,
        disabled && styles.disabledAction,
        compact && styles.compactButton,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.primaryActionText,
          disabled && styles.disabledText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BreakdownSheetScreen({ selectedExam, selectedSet }) {
  const summary = [
    { label: "Attempted", value: "162" },
    { label: "Correct", value: "118" },
    { label: "Incorrect", value: "32" },
    { label: "Unanswered", value: "30" },
  ];

  return (
    <View style={styles.breakdownPanel}>
      <Text style={styles.sectionTitle}>Breakdown Sheet</Text>
      <Text style={styles.cardText}>
        Exam: {selectedExam} • {selectedSet}
      </Text>
      <View style={styles.summaryGrid}>
        {summary.map((item) => (
          <View
            key={item.label}
            style={[styles.metric, { backgroundColor: colors.paleBlue }]}
          >
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.breakdownTable}>
        {[
          ["Physics", "118", "Correct"],
          ["Chemistry", "22", "Correct"],
          ["Maths", "16", "Correct"],
        ].map(([subject, value, label], index) => (
          <View key={`${subject}-${index}`} style={styles.breakdownRow}>
            <Text style={styles.breakdownSubject}>{subject}</Text>
            <Text style={styles.breakdownValue}>{value}</Text>
            <Text style={styles.breakdownLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TeacherOMRScreen({
  session,
  onBack,
  initialTab = "Scanner & Reader",
  initialMenu = "Hardware & Optical Scanner",
}) {
  const [activeMenu, setActiveMenu] = useState(initialMenu);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedExam, setSelectedExam] = useState("");
  const [bookletSet, setBookletSet] = useState("Set A");
  const [answerSets, setAnswerSets] = useState(createInitialSetState);
  const [dashboard, setDashboard] = useState({ sessions: [], results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pasteInput, setPasteInput] = useState("A B C D A C B D");
  const [saveMessage, setSaveMessage] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [batchFiles, setBatchFiles] = useState([]);
  const [csvEntries, setCsvEntries] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [publishStatus, setPublishStatus] = useState(
    "Draft / Hidden from Portals",
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [candidateResults, setCandidateResults] = useState([]);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraStatus, setCameraStatus] = useState(
    "Camera Permission Required",
  );
  const [capturedImage, setCapturedImage] = useState(null);
  const cameraRef = useRef(null);

  const examOptions = (() => {
    const fromApi = (dashboard.sessions || []).map((sessionItem) => ({
      label: sessionItem.name || "Session",
      value: `${sessionItem.name || "Session"} (${sessionItem.questions || 180} Qs)`,
      questions: sessionItem.questions || 180,
    }));
    return fromApi;
  })();

  const currentSetQuestions = answerSets[bookletSet] || createQuestionRows();

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await omrApi.fetchOMRDashboard(session);
        const resultRows = toResultRows(
          data?.results || [],
          selectedExam,
          selectedExamId,
        );
        if (active) {
          setDashboard(data || { sessions: [], results: [] });
          setCandidateResults(resultRows);
          if (data?.sessions?.length) {
            const firstSession = data.sessions[0];
            const examValue = `${firstSession.name || "Session"} (${firstSession.questions || 180} Qs)`;
            setSelectedExamId(firstSession.id || "");
            setSelectedExam(examValue);
            setPublishStatus(
              firstSession.status === "Published"
                ? "Published"
                : "Draft / Hidden from Portals",
            );
          } else {
            setSelectedExamId("");
            setSelectedExam("");
            setPublishStatus("Draft / Hidden from Portals");
          }
        }
      } catch (error) {
        if (active) {
          setError(
            error?.message ||
              "Unable to load OMR data from the API. Check the endpoint and backend connection.",
          );
          setCandidateResults(toResultRows([], selectedExam, selectedExamId));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchDashboard();
    return () => {
      active = false;
    };
  }, [selectedExam, selectedExamId, session]);

  useEffect(() => {
    return () => {
      setCameraVisible(false);
      setCapturedImage(null);
    };
  }, []);

  const effectiveCameraStatus = !cameraVisible
    ? "Camera Permission Required"
    : cameraPermission?.granted
      ? "Camera Connected"
      : "Camera Permission Required";

  const updateQuestionAnswer = (questionNumber, nextValue) => {
    setAnswerSets((current) => ({
      ...current,
      [bookletSet]: (current[bookletSet] || createQuestionRows()).map(
        (question) =>
          question.number === questionNumber
            ? { ...question, answer: nextValue }
            : question,
      ),
    }));
    setSaveMessage("");
  };

  const autoGenerateStandardKeys = () => {
    const standardRows = buildStandardPattern();
    const hasExistingCustom = (answerSets[bookletSet] || []).some(
      (row, index) =>
        row.answer !== "-" && row.answer !== standardRows[index].answer,
    );

    const applyGeneration = () => {
      setAnswerSets((current) => ({
        ...current,
        [bookletSet]: standardRows.map((question) => ({ ...question })),
      }));
      setSaveMessage(`${bookletSet} answer key regenerated.`);
    };

    if (hasExistingCustom) {
      Alert.alert(
        "Overwrite existing answer key?",
        `This will replace the current answer key for ${bookletSet}. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: applyGeneration },
        ],
      );
      return;
    }

    applyGeneration();
  };

  const pasteAnswersIntoSet = () => {
    const parsedValues = parsePastedAnswers(pasteInput);
    if (!parsedValues.length) {
      Alert.alert(
        "Invalid pasted value",
        "Paste answers in the format A B C D or A,B,C,D, including '-' for unanswered questions.",
      );
      return;
    }

    const targetRows = answerSets[bookletSet] || createQuestionRows();
    const normalized = targetRows.map((question, index) => ({
      ...question,
      answer:
        index < parsedValues.length ? parsedValues[index] : question.answer,
    }));

    setAnswerSets((current) => ({
      ...current,
      [bookletSet]: normalized,
    }));
    setPasteInput("");
    setSaveMessage(`Answers pasted into ${bookletSet}.`);
  };

  const saveCurrentSet = () => {
    const questions = answerSets[bookletSet] || createQuestionRows();
    const valid = validateSetAnswers(questions);

    if (!valid) {
      Alert.alert(
        "Validation failed",
        "Each answer must be A, B, C, D or - for all questions from 1 to 180.",
      );
      return;
    }

    setSaveMessage(`${bookletSet} saved successfully.`);
    Alert.alert(
      "Saved",
      `${bookletSet} answer key has been saved successfully.`,
    );
  };

  const selectExam = () => {
    const options = examOptions.map((option) => ({
      text: option.label,
      onPress: () => {
        const matchedSession = (dashboard.sessions || []).find(
          (sessionItem) =>
            (sessionItem.name || "Session") === option.label ||
            `${sessionItem.name || "Session"} (${sessionItem.questions || 180} Qs)` ===
              option.value,
        );

        setSelectedExam(option.value);
        setSelectedExamId(matchedSession?.id || selectedExamId || "");
      },
    }));

    Alert.alert("Select exam", "Choose the current exam.", [
      ...options,
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const runQuickDemoEvaluation = async () => {
    const setAnswers = answerSets[bookletSet] || createQuestionRows();
    const hasSavedKey = setAnswers.some(
      (entry) => entry.answer && entry.answer !== "-",
    );

    if (!hasSavedKey) {
      Alert.alert(
        "No answer key available",
        `Generate or save the ${bookletSet} answer key before running the demo evaluation.`,
      );
      return;
    }

    setIsEvaluating(true);
    setEvaluationResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const snapshot = makeEvaluationSnapshot(
      setAnswers,
      selectedExam || DEFAULT_EXAM_LABEL,
    );
    setEvaluationResult(snapshot);
    setIsEvaluating(false);
    Alert.alert(
      "Demo evaluation complete",
      `Simulated result for ${selectedExam || DEFAULT_EXAM_LABEL}: ${snapshot.correct} correct, ${snapshot.incorrect} incorrect, ${snapshot.unanswered} unanswered.`,
    );
  };

  const pickBatchFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
      });

      if (result.canceled) {
        Alert.alert("Cancelled", "No files were selected.");
        return;
      }

      setBatchFiles(result.assets || []);
      Alert.alert(
        "Files selected",
        `${(result.assets || []).length} file(s) ready for future OMR processing.`,
      );
    } catch {
      Alert.alert(
        "File picker unavailable",
        "The batch file picker could not be opened on this device.",
      );
    }
  };

  const pickCsvFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ["text/csv", "application/vnd.ms-excel"],
      });

      if (result.canceled) {
        Alert.alert("Cancelled", "CSV upload was cancelled.");
        return;
      }

      const file = result.assets?.[0];
      if (!file || !file.uri) {
        setCsvError("No CSV file selected.");
        return;
      }

      const response = await fetch(file.uri);
      const text = await response.text();
      const rows = text
        .split(/\r?\n/)
        .map((line) => line.split(",").map((entry) => entry.trim()))
        .filter((line) => line.some(Boolean));

      if (rows.length < 2) {
        setCsvError("CSV file is empty or invalid.");
        setCsvEntries([]);
        return;
      }

      setCsvEntries(rows.slice(0, 6));
      setCsvError("");
      Alert.alert("CSV imported", `Preview loaded for ${rows.length} row(s).`);
    } catch {
      setCsvError(
        "Unable to read the CSV file. Please check the format and try again.",
      );
    }
  };

  const handleCameraPress = async () => {
    if (!cameraPermission) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setCameraStatus("Camera Permission Required");
        Alert.alert(
          "Camera access needed",
          "Please allow camera access in the app settings to use the live OMR scanner.",
        );
        return;
      }
    }

    if (cameraPermission?.granted) {
      setCameraVisible(true);
      setCameraStatus("Camera Connected");
      return;
    }

    setCameraStatus("Camera Unavailable");
    Alert.alert(
      "Camera unavailable",
      "The current device does not support or allow camera access.",
    );
  };

  const captureImage = async () => {
    if (!cameraRef.current) {
      Alert.alert(
        "Capture unavailable",
        "The camera is not ready yet. Please retry.",
      );
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedImage(photo?.uri || null);
      setCameraStatus("Image Captured");
    } catch {
      Alert.alert(
        "Capture failed",
        "Unable to capture the OMR sheet image right now.",
      );
    }
  };

  const renderAnswerKeyGrid = () => (
    <View style={styles.answerGridWrapper}>
      <View style={styles.answerGridHeader}>
        <Text style={styles.answerGridHeading}>Question key</Text>
        <Text style={styles.answerGridMeta}>
          {currentSetQuestions.length} questions
        </Text>
      </View>
      {currentSetQuestions.map((question) => (
        <View key={question.id} style={styles.questionRow}>
          <View style={styles.questionMeta}>
            <Text style={styles.questionNumber}>{question.number}</Text>
            <Text style={styles.subjectBadge}>{question.subject}</Text>
          </View>

          <View style={styles.answerFieldWrap}>
            <Text style={styles.answerLabel}>Answer</Text>
            <View style={styles.answerOptionsRow}>
              {ANSWER_OPTIONS.map((option) => (
                <Pressable
                  key={`${question.id}-${option}`}
                  onPress={() => updateQuestionAnswer(question.number, option)}
                  style={({ pressed }) => [
                    styles.answerBubble,
                    question.answer === option && styles.answerBubbleActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.answerBubbleText,
                      question.answer === option &&
                        styles.answerBubbleTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderScannerSection = () => (
    <View style={styles.cardBlock}>
      <Text style={styles.sectionTitle}>Hardware & Optical Scanner</Text>
      <Text style={styles.cardText}>
        Evaluate live optical camera feeds, batch PDF/images, or run an instant
        simulated batch evaluation.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.smallLabel}>Evaluation Suite</Text>
        <Text style={styles.valueText}>{selectedExam}</Text>
        <Text style={styles.cardText}>
          180 questions • {bookletSet} • Scanner Ready
        </Text>
      </View>

      <ActionButton
        label="⚡ Quick Demo Evaluation"
        primary
        onPress={runQuickDemoEvaluation}
        style={styles.demoButton}
      />

      {isEvaluating ? (
        <Text style={styles.loadingText}>Running simulated evaluation...</Text>
      ) : null}
      {evaluationResult ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Evaluation complete</Text>
          <Text style={styles.resultMeta}>
            Exam: {evaluationResult.examName}
          </Text>
          <Text style={styles.resultStat}>
            Correct: {evaluationResult.correct}
          </Text>
          <Text style={styles.resultStat}>
            Incorrect: {evaluationResult.incorrect}
          </Text>
          <Text style={styles.resultStat}>
            Unanswered: {evaluationResult.unanswered}
          </Text>
          <Text style={styles.resultStat}>Score: {evaluationResult.score}</Text>
          <Text style={styles.resultStat}>
            Percentage: {evaluationResult.percentage}%
          </Text>
        </View>
      ) : null}

      <View style={styles.cardSplit}>
        <Pressable
          onPress={pickBatchFiles}
          style={({ pressed }) => [
            styles.secondaryActionCard,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="documents-outline" size={20} color={colors.blue} />
          <Text style={styles.cardActionTitle}>Batch Image / PDF</Text>
          <Text style={styles.cardActionMeta}>
            {batchFiles.length
              ? `${batchFiles.length} file(s)`
              : "Select batch files"}
          </Text>
        </Pressable>

        <Pressable
          onPress={pickCsvFile}
          style={({ pressed }) => [
            styles.secondaryActionCard,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="document-text-outline" size={20} color={colors.blue} />
          <Text style={styles.cardActionTitle}>CSV Upload</Text>
          <Text style={styles.cardActionMeta}>
            {csvEntries.length ? "Preview ready" : "Import candidate data"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.cameraPanel}>
        <Text style={styles.sectionTitle}>
          Live Connected Document Scanner & Camera
        </Text>
        <Text style={styles.cardText}>
          Status: {effectiveCameraStatus || cameraStatus}
        </Text>

        <ActionButton
          label="Connect Camera"
          primary
          onPress={handleCameraPress}
        />

        {cameraVisible && cameraPermission?.granted ? (
          <>
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                facing="back"
                style={styles.cameraPreview}
                onCameraReady={() => setCameraStatus("Camera Connected")}
              />
            </View>
            {capturedImage ? (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: capturedImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}
            <View style={styles.cameraActions}>
              <ActionButton label="Capture" onPress={captureImage} />
              <ActionButton
                label="Retake"
                onPress={() => setCapturedImage(null)}
              />
              <ActionButton
                label="Evaluate"
                primary
                onPress={() => {
                  Alert.alert(
                    "Evaluation workflow",
                    "Captured image is queued for future backend OMR evaluation integration.",
                  );
                  setCameraStatus("Scan Complete");
                }}
              />
            </View>
          </>
        ) : null}
      </View>

      {csvError ? <Text style={styles.errorText}>{csvError}</Text> : null}
      {csvEntries.length ? (
        <View style={styles.csvPreview}>
          <Text style={styles.sectionTitle}>CSV Preview</Text>
          {csvEntries.slice(0, 5).map((row, rowIndex) => (
            <Text key={`${rowIndex}-${row.join("-")}`} style={styles.csvRow}>
              {row.join(" | ")}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderPrintableSheet = () => (
    <View style={styles.previewPanel}>
      <Text style={styles.sectionTitle}>Printable OMR Sheet</Text>
      <Text style={styles.cardText}>
        Candidate instructions: fill one bubble per question using a dark pen.
      </Text>
      <View style={styles.previewBox}>
        <Text style={styles.previewText}>Exam: {selectedExam}</Text>
        <Text style={styles.previewText}>Set: {bookletSet}</Text>
        <Text style={styles.previewText}>Questions: 180</Text>
      </View>
      <ActionButton
        label="Printable OMR Sheet"
        primary
        onPress={() =>
          Alert.alert(
            "Printable OMR Sheet",
            "The print/PDF workflow is ready to be connected to the future export service.",
          )
        }
      />
    </View>
  );

  const renderAnswerKeys = () => (
    <View style={styles.cardBlock}>
      <Text style={styles.sectionTitle}>Answer Keys</Text>
      <Text style={styles.cardText}>
        Select a JEE session and manage the key for each booklet set.
      </Text>

      <SelectBox label="My exam" value={selectedExam} onPress={selectExam} />

      <View style={styles.bookletWrap}>
        <Text style={styles.fieldLabel}>Booklet Set</Text>
        <View style={styles.bookletRow}>
          {BOOKLET_SETS.map((setName) => (
            <Pressable
              key={setName}
              onPress={() => {
                setBookletSet(setName);
                setSaveMessage("");
              }}
              style={({ pressed }) => [
                styles.bookletPill,
                bookletSet === setName && styles.bookletPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.bookletPillText,
                  bookletSet === setName && styles.bookletPillTextActive,
                ]}
              >
                {setName}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.actionRow}>
        <ActionButton
          label="Auto-Generate Standard Keys"
          primary
          onPress={autoGenerateStandardKeys}
        />
        <ActionButton
          label="Auto-Paste Key"
          onPress={() => setPasteInput(pasteInput || "A B C D A C B D")}
        />
      </View>

      <View style={styles.pasteBox}>
        <Text style={styles.fieldLabel}>Paste key values</Text>
        <TextInput
          multiline
          value={pasteInput}
          onChangeText={setPasteInput}
          placeholder="A,B,C,D,A,C,B,D..."
          placeholderTextColor={colors.muted}
          style={styles.pasteInput}
          textAlignVertical="top"
        />
        <ActionButton
          label="Apply pasted key"
          primary
          compact
          onPress={pasteAnswersIntoSet}
        />
      </View>

      <ActionButton
        label={`Save ${bookletSet} Key`}
        primary
        onPress={saveCurrentSet}
      />
      {saveMessage ? (
        <Text style={styles.successMessage}>{saveMessage}</Text>
      ) : null}

      {renderAnswerKeyGrid()}

      <View style={styles.footerActions}>
        <ActionButton
          label="Printable OMR Sheet"
          onPress={() => setActiveTab("Printable OMR Sheet")}
        />
        <Pressable
          disabled
          style={[styles.footerDisabledButton, styles.disabledAction]}
        >
          <Text style={[styles.actionButtonText, styles.disabledText]}>
            Publish Results
          </Text>
        </Pressable>
        <ActionButton
          label="Breakdown Sheet"
          onPress={() => setShowBreakdown(true)}
        />
      </View>

      {showBreakdown && (
        <BreakdownSheetScreen
          selectedExam={selectedExam}
          selectedSet={bookletSet}
        />
      )}
    </View>
  );

  const renderSessions = () => (
    <View style={styles.cardBlock}>
      <Text style={styles.sectionTitle}>Exam Sessions</Text>
      <Text style={styles.cardText}>
        Manage live and planned OMR sessions for the selected JEE exam.
      </Text>
      {(dashboard.sessions || []).length ? (
        (dashboard.sessions || []).map((item) => (
          <View key={item.id || item.name} style={styles.sessionRow}>
            <Text style={styles.sessionName}>{item.name || "Session"}</Text>
            <Text style={styles.cardText}>
              {item.code || "JEE"} • {item.status || "Draft"}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.cardText}>No OMR sessions available.</Text>
      )}
    </View>
  );

  const refreshResults = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError("");

    try {
      const latestResults = await omrApi.fetchOMRResults(session);
      const normalizedResults = toResultRows(
        latestResults,
        selectedExam,
        selectedExamId,
      );
      setCandidateResults(normalizedResults);
      const latestSession =
        (dashboard.sessions || []).find(
          (sessionItem) => sessionItem.id === selectedExamId,
        ) || (dashboard.sessions || [])[0];
      if (latestSession?.status) {
        setPublishStatus(
          latestSession.status === "Published"
            ? "Published"
            : "Draft / Hidden from Portals",
        );
      }
    } catch {
      setError("Unable to refresh the latest results right now.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const publishResults = async () => {
    if (isPublishing) return;

    Alert.alert(
      "Publish Results",
      "Publishing makes scorecards visible to students and parents. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            if (!omrApi || typeof omrApi.publishOMRResults !== "function") {
              Alert.alert(
                "Publish unavailable",
                "A publish-results API is not configured in this project yet.",
              );
              return;
            }

            setIsPublishing(true);
            setError("");
            try {
              const result = await omrApi.publishOMRResults(
                selectedExamId || "omr-session-1",
                session,
              );
              const nextStatus =
                result?.status === "Published"
                  ? "Published"
                  : "Draft / Hidden from Portals";
              setPublishStatus(nextStatus);
              setDashboard((current) => ({
                ...current,
                sessions: (current.sessions || []).map((sessionItem) =>
                  sessionItem.id === (selectedExamId || "omr-session-1")
                    ? {
                        ...sessionItem,
                        status:
                          nextStatus === "Published"
                            ? "Published"
                            : sessionItem.status,
                      }
                    : sessionItem,
                ),
              }));

              if (nextStatus === "Published") {
                Alert.alert(
                  "Published successfully",
                  "The scorecards are now visible to students and parents.",
                );
              } else {
                Alert.alert(
                  "Publish not confirmed",
                  "The result remains in draft mode because the API did not confirm publishing.",
                );
              }
            } catch {
              setError(
                "Publishing failed. Results remain hidden in draft mode.",
              );
              Alert.alert(
                "Publish failed",
                "The publish request failed. The results are still hidden in draft mode.",
              );
            } finally {
              setIsPublishing(false);
            }
          },
        },
      ],
    );
  };

  const exportCsvResults = () => {
    if (!filteredCandidates.length) {
      Alert.alert(
        "No candidates",
        "There are no evaluated candidates for the selected exam to export.",
      );
      return;
    }

    const rows = filteredCandidates.map((candidate) => [
      String(candidate.rank || 1),
      String(candidate.studentName || ""),
      String(candidate.rollNumber || ""),
      String(candidate.admissionNumber || candidate.rollNumber || ""),
      String(candidate.booklet || "Set A"),
      String(formatScoreValue(candidate.totalScore)),
      String(formatScoreValue(candidate.maxScore || 720)),
      String(candidate.correct || 0),
      String(candidate.wrong || 0),
      String(candidate.blank || 0),
    ]);

    const csvHeader = [
      "Rank",
      "Student Name",
      "Roll Number",
      "Admission Number",
      "Booklet Set",
      "Total Score",
      "Maximum Score",
      "Correct Answers",
      "Wrong Answers",
      "Blank Answers",
    ];

    const csvRows = [csvHeader, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    Alert.alert(
      "CSV ready",
      `Export prepared for ${filteredCandidates.length} candidate result(s).`,
    );
    setSearchText(searchText);
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {
      navigator.clipboard.writeText(csvRows).catch(() => undefined);
    }
  };

  const filteredCandidates = (() => {
    const query = searchText.trim().toLowerCase();
    const examMatches = candidateResults.filter((candidate) => {
      if (!selectedExamId) return true;
      return (
        !candidate.examId ||
        candidate.examId === selectedExamId ||
        candidate.examName === selectedExam
      );
    });

    if (!query) return examMatches;

    return examMatches.filter((candidate) => {
      const haystack = [
        candidate.studentName,
        candidate.rollNumber,
        candidate.admissionNumber,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  })();

  const resultSummary = (() => {
    const scores = filteredCandidates.map((candidate) =>
      Number(candidate.totalScore ?? 0),
    );
    const topScore = scores.length ? Math.max(...scores) : 0;
    const averageScore = scores.length
      ? scores.reduce((sum, item) => sum + item, 0) / scores.length
      : 0;
    const uniqueSets =
      new Set(
        filteredCandidates
          .map((candidate) => candidate.booklet)
          .filter(Boolean),
      ).size || 1;

    return {
      evaluatedCandidates: filteredCandidates.length,
      topScore,
      averageScore,
      answerKeySets: uniqueSets,
      maxScore: filteredCandidates.reduce(
        (max, candidate) => Math.max(max, Number(candidate.maxScore ?? 720)),
        720,
      ),
    };
  })();

  const renderResults = () => (
    <View style={styles.cardBlock}>
      <Text style={styles.sectionTitle}>Results & Ranks</Text>
      <Text style={styles.cardText}>
        Live result summaries and leaderboard ranks for the selected exam.
      </Text>

      <View style={styles.resultHeaderRow}>
        <View style={styles.selectFieldWrap}>
          <Text style={styles.fieldLabel}>Exam</Text>
          <Pressable onPress={selectExam} style={styles.selectBox}>
            <Text style={styles.selectBoxText}>
              {selectedExam || "Select exam"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        </View>

        <Pressable
          onPress={refreshResults}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
          disabled={isRefreshing}
        >
          <Text style={styles.refreshButtonText}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search name or roll number..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.statusBanner}>
        <Text style={styles.statusLabel}>Draft / Hidden from Portals</Text>
        <Text style={styles.statusDescription}>
          Results are currently hidden in draft mode. Click the Publish Results
          action to release scorecards to students and parents.
        </Text>
      </View>

      <ActionButton
        label={isPublishing ? "Publishing..." : "Publish Results Now"}
        primary
        onPress={publishResults}
        disabled={isPublishing}
        style={styles.publishButton}
      />

      <ActionButton
        label="Export CSV"
        onPress={() => {
          exportCsvResults();
          setActiveTab("Results & Ranks");
        }}
        style={styles.publishButton}
      />

      <View style={styles.summaryGridCompact}>
        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Evaluated Candidates</Text>
          <Text style={styles.metricValue}>
            {resultSummary.evaluatedCandidates}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Top Score</Text>
          <Text style={styles.metricValue}>
            {formatScoreValue(resultSummary.topScore)} /{" "}
            {formatScoreValue(resultSummary.maxScore)}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Average Score</Text>
          <Text style={styles.metricValue}>
            {formatAverage(resultSummary.averageScore)}
          </Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.metricLabel}>Answer Key Sets</Text>
          <Text style={styles.metricValue}>
            {resultSummary.answerKeySets} Sets Active
          </Text>
        </View>
      </View>

      {publishStatus ? (
        <Text style={styles.publishStatusText}>{publishStatus}</Text>
      ) : null}

      <View style={styles.tableWrap}>
        {filteredCandidates.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeaderRow}>
                {[
                  "Rank",
                  "Student Name",
                  "Roll / Admission No",
                  "Booklet",
                  "Total Score",
                  "Correct / Wrong / Blank",
                  "Action",
                ].map((heading) => (
                  <Text key={heading} style={styles.tableHeaderCell}>
                    {heading}
                  </Text>
                ))}
              </View>

              {filteredCandidates.map((candidate) => (
                <View key={candidate.id} style={styles.tableRow}>
                  <Text style={styles.tableCell}>#{candidate.rank || 1}</Text>
                  <Text style={styles.tableCell}>{candidate.studentName}</Text>
                  <Text style={styles.tableCell}>{candidate.rollNumber}</Text>
                  <Text style={styles.tableCell}>
                    {candidate.booklet || "Set A"}
                  </Text>
                  <Text style={styles.tableCell}>
                    {formatScoreValue(candidate.totalScore)} /{" "}
                    {formatScoreValue(candidate.maxScore || 720)}
                  </Text>
                  <Text style={styles.tableCell}>
                    {candidate.correct || 0} C | {candidate.wrong || 0} W |{" "}
                    {candidate.blank || 0} B
                  </Text>
                  <Pressable
                    onPress={() => setSelectedBreakdown(candidate)}
                    style={({ pressed }) => [
                      styles.breakdownButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.breakdownButtonText}>
                      Breakdown Sheet
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyState}>
            No evaluated candidates match the current exam or search filters.
          </Text>
        )}
      </View>

      {selectedBreakdown ? (
        <View style={styles.breakdownPanel}>
          <Text style={styles.sectionTitle}>Breakdown Sheet</Text>
          <Text style={styles.cardText}>
            Candidate: {selectedBreakdown.studentName} •{" "}
            {selectedBreakdown.rollNumber}
          </Text>
          <Text style={styles.cardText}>
            Exam: {selectedBreakdown.examName || selectedExam}
          </Text>
          <Text style={styles.cardText}>
            Booklet: {selectedBreakdown.booklet || "Set A"} • Total Score:{" "}
            {formatScoreValue(selectedBreakdown.totalScore)} /{" "}
            {formatScoreValue(selectedBreakdown.maxScore || 720)}
          </Text>
          <View style={styles.breakdownMetricRow}>
            <Text style={styles.breakdownMetric}>Question No.</Text>
            <Text style={styles.breakdownMetric}>Student Answer</Text>
            <Text style={styles.breakdownMetric}>Correct Answer</Text>
            <Text style={styles.breakdownMetric}>Status</Text>
          </View>
          {Array.from({ length: 4 }, (_, index) => ({
            number: index + 1,
            studentAnswer: index % 2 === 0 ? "A" : "B",
            correctAnswer: index % 3 === 0 ? "A" : "C",
            status: index % 2 === 0 ? "Correct" : "Wrong",
          })).map((detail) => (
            <View key={detail.number} style={styles.breakdownItem}>
              <Text style={styles.tableCell}>{detail.number}</Text>
              <Text style={styles.tableCell}>{detail.studentAnswer}</Text>
              <Text style={styles.tableCell}>{detail.correctAnswer}</Text>
              <Text
                style={[
                  styles.tableCell,
                  detail.status === "Correct"
                    ? styles.correctText
                    : styles.wrongText,
                ]}
              >
                {detail.status}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderContent = () => {
    if (activeTab === "Printable OMR Sheet") return renderPrintableSheet();
    if (activeTab === "Sessions (1)") return renderSessions();
    if (activeTab === "Answer Keys") return renderAnswerKeys();
    if (activeTab === "Results & Ranks") return renderResults();
    if (activeTab === "Export CSV") {
      exportCsvResults();
      setActiveTab("Results & Ranks");
      return renderResults();
    }
    return renderScannerSection();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerCard}>
        <Text style={styles.pageTitle}>
          OMR Hardware Scanner & Evaluation Suite
        </Text>
        <Text style={styles.subtitle}>Scanner Ready</Text>
        <Text style={styles.description}>
          NEET/JEE pattern evaluation, answer keys, camera scanner &
          leaderboards
        </Text>
      </View>

      <View style={styles.submenuRow}>
        {OMR_SUBMENUS.map((menu) => (
          <Pressable
            key={menu}
            onPress={() => {
              setActiveMenu(menu);
              if (menu === "OMR Dashboard") setActiveTab("Printable OMR Sheet");
              if (menu === "Exam Sessions") setActiveTab("Sessions (1)");
              if (menu === "Answer Keys") setActiveTab("Answer Keys");
              if (menu === "Hardware & Optical Scanner")
                setActiveTab("Scanner & Reader");
              if (menu === "Results & Leaderboards")
                setActiveTab("Results & Ranks");
            }}
            style={({ pressed }) => [
              styles.submenuChip,
              activeMenu === menu && styles.submenuChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={
                menu === "Hardware & Optical Scanner"
                  ? "hardware-chip-outline"
                  : menu === "Results & Leaderboards"
                    ? "trophy-outline"
                    : menu === "Exam Sessions"
                      ? "calendar-outline"
                      : menu === "Answer Keys"
                        ? "key-outline"
                        : "scan-outline"
              }
              size={15}
              color={activeMenu === menu ? colors.blue : colors.ink}
            />
            <Text
              style={[
                styles.submenuText,
                activeMenu === menu && styles.submenuTextActive,
              ]}
            >
              {menu}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabRow}>
        {OMR_TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => {
              if (tab === "Export CSV") {
                exportCsvResults();
                setActiveTab("Results & Ranks");
                return;
              }
              setActiveTab(tab);
            }}
            style={({ pressed }) => [
              styles.tabButton,
              activeTab === tab && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
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

      {loading ? (
        <Text style={styles.loadingText}>Loading OMR console...</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  headerCard: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  submenuRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.canvas,
  },
  submenuChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  submenuChipActive: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  submenuText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "800",
  },
  submenuTextActive: {
    color: colors.blue,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  tabButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  tabTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 12,
    paddingBottom: 110,
  },
  cardBlock: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  cardText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryCard: {
    marginTop: 12,
    backgroundColor: colors.paleBlue,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  smallLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  valueText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  cardSplit: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  secondaryActionCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  cardActionTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 13,
    marginTop: 10,
  },
  cardActionMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  demoButton: {
    marginTop: 14,
  },
  resultCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.paleTeal,
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  resultStat: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  cameraPanel: {
    marginTop: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
  },
  cameraWrapper: {
    height: 220,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cameraPreview: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 12,
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  cameraActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  csvPreview: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.canvas,
  },
  csvRow: {
    color: colors.ink,
    fontSize: 11,
    marginTop: 4,
  },
  fieldBox: {
    marginTop: 12,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  selectBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectBoxText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  bookletWrap: {
    marginTop: 14,
  },
  bookletRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  bookletPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bookletPillActive: {
    backgroundColor: colors.paleBlue,
    borderColor: colors.blue,
  },
  bookletPillText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  bookletPillTextActive: {
    color: colors.blue,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  compactButton: {
    minHeight: 38,
  },
  primaryAction: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  secondaryAction: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  primaryActionText: {
    color: colors.white,
  },
  disabledAction: {
    backgroundColor: colors.canvas,
    borderColor: colors.line,
    opacity: 0.7,
  },
  disabledText: {
    color: colors.muted,
  },
  pressed: {
    opacity: 0.8,
  },
  pasteBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.canvas,
  },
  pasteInput: {
    minHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 10,
    color: colors.ink,
    marginBottom: 10,
  },
  successMessage: {
    marginTop: 10,
    color: colors.teal,
    fontSize: 12,
    fontWeight: "800",
  },
  answerGridWrapper: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  answerGridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  answerGridHeading: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  answerGridMeta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 10,
    gap: 12,
  },
  questionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  questionNumber: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    width: 26,
  },
  subjectBadge: {
    fontSize: 10,
    color: colors.blue,
    fontWeight: "800",
    backgroundColor: colors.paleBlue,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  answerFieldWrap: {
    flex: 1,
  },
  answerLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
  },
  answerOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  answerBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  answerBubbleActive: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  answerBubbleText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  answerBubbleTextActive: {
    color: colors.white,
  },
  footerActions: {
    marginTop: 18,
    gap: 10,
  },
  footerDisabledButton: {
    borderRadius: 10,
    minHeight: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  previewPanel: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12,
  },
  previewBox: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  previewText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  sessionRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    backgroundColor: colors.canvas,
  },
  sessionName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  resultRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    backgroundColor: colors.canvas,
  },
  breakdownPanel: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    flexBasis: "48%",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 4,
  },
  breakdownTable: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: "hidden",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  breakdownSubject: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  breakdownValue: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "900",
    width: 40,
    textAlign: "center",
  },
  breakdownLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
});
