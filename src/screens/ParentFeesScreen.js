import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Colors } from "../constants/theme";
import { ApiError } from "../services/api";
import { feesApi } from "../services/feesApi";

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
  orange: "#A76E00",
  paleOrange: "#FFF7DF",
  red: "#B94E4E",
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

const formatMoney = (value) =>
  `₹${Math.abs(Number(value) || 0).toLocaleString("en-IN")}`;
const formatBalance = (value) =>
  Number(value) < 0
    ? `-₹${Math.abs(Number(value)).toLocaleString("en-IN")}`
    : formatMoney(value);

const firstValue = (value, ...fallbacks) =>
  [value, ...fallbacks].find(
    (candidate) =>
      candidate !== undefined && candidate !== null && candidate !== "",
  );

const escapeHtml = (value) =>
  String(value ?? "Not provided")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatReceiptDate = (value) => {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
};

const transactionDetails = (transaction) => ({
  receiptNo: firstValue(
    transaction?.receiptNo,
    transaction?.receipt_no,
    transaction?.receipt_number,
    transaction?.receiptNumber,
  ),
  paymentDate: firstValue(
    transaction?.date,
    transaction?.payment_date,
    transaction?.paymentDate,
    transaction?.created_at,
  ),
  status: firstValue(
    transaction?.status,
    transaction?.payment_status,
    transaction?.paymentStatus,
    "PAID",
  ),
  method: firstValue(
    transaction?.mode,
    transaction?.payment_method,
    transaction?.paymentMethod,
    "Not provided",
  ),
  transactionId: firstValue(
    transaction?.transaction_id,
    transaction?.transactionId,
    transaction?.txn_id,
    transaction?.txnId,
  ),
  receiptUrl: firstValue(
    transaction?.receiptUrl,
    transaction?.receipt_url,
    transaction?.download_url,
    transaction?.downloadUrl,
    transaction?.file_url,
    transaction?.fileUrl,
    transaction?.url,
  ),
  mimeType: firstValue(
    transaction?.mime_type,
    transaction?.mimeType,
    transaction?.content_type,
    transaction?.contentType,
  ),
  amount: firstValue(
    transaction?.amount,
    transaction?.paid_amount,
    transaction?.payment_amount,
    transaction?.transaction_amount,
    transaction?.amountPaid,
    0,
  ),
});

const isRemoteUri = (uri) => /^https?:\/\//i.test(String(uri || ""));
const isLocalUri = (uri) => /^(file|content):\/\//i.test(String(uri || ""));

const downloadBlobOnWeb = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};

const mimeTypeFrom = (uri, providedMimeType) => {
  if (providedMimeType) return providedMimeType;
  const path = String(uri || "")
    .split("?")[0]
    .toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  return "application/pdf";
};

const extensionFrom = (uri, mimeType) => {
  const path = String(uri || "")
    .split("?")[0]
    .toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return ".jpg";
  if (path.endsWith(".png")) return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".pdf";
};

const receiptFileName = (receipt, uri, mimeType) => {
  const identifier = String(
    firstValue(
      receipt?.id,
      receipt?.receiptNo,
      receipt?.receipt_no,
      receipt?.transaction_id,
      Date.now(),
    ),
  ).replace(/[^a-z0-9_-]/gi, "_");
  return `fee_receipt_${identifier}${extensionFrom(uri, mimeType)}`;
};

const buildReceiptHtml = ({
  logoUri,
  session,
  selectedStudent,
  summary,
  transaction,
}) => {
  const details = transactionDetails(transaction);
  const feeRows = (Array.isArray(summary?.fees) ? summary.fees : [])
    .map((fee) => {
      const description = firstValue(
        fee?.category_name,
        fee?.category,
        fee?.fee_type,
        fee?.name,
        "Fee",
      );
      const amount = firstValue(
        fee?.final_amount,
        fee?.finalAmount,
        fee?.total_amount,
        fee?.totalAmount,
        0,
      );
      return `<tr><td>${escapeHtml(description)}</td><td>${escapeHtml(
        formatMoney(amount),
      )}</td></tr>`;
    })
    .join("");
  const schoolName = firstValue(
    session?.schoolName,
    session?.tenant?.school_name,
    session?.tenant?.name,
    "School",
  );
  const studentName = firstValue(selectedStudent?.name, "Student");
  const total = firstValue(summary?.cumulativeTotal, summary?.total, 0);
  const paid = firstValue(
    summary?.settledAmount,
    summary?.paid,
    details.amount,
    0,
  );
  const balance = firstValue(summary?.institutionalDues, summary?.balance, 0);
  const academicYear = firstValue(
    session?.academicYear,
    session?.academic_year,
    session?.academicYearName,
    "Not provided",
  );

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>
    body{font-family:Arial,sans-serif;color:#17175F;padding:28px;background:#fff}
    .header{text-align:center;border-bottom:2px solid #1E32CC;padding-bottom:18px}
    .logo{width:76px;height:76px;object-fit:contain}
    h1{font-size:22px;margin:8px 0;color:#13137F} h2{font-size:18px;letter-spacing:1px;margin:18px 0 8px;text-align:center}
    .muted{color:#596080;font-size:11px;margin:4px 0}.meta{display:flex;justify-content:space-between;gap:16px;margin:8px 0;font-size:12px}
    .meta div{flex:1}.label{color:#596080;font-weight:bold}.value{font-weight:bold;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th,td{padding:9px 6px;border-bottom:1px solid #D9DDF2;text-align:left}th:last-child,td:last-child{text-align:right}
    .total td{font-weight:bold;border-bottom:0}.summary{border-top:2px solid #1E32CC;margin-top:8px;padding-top:8px}.status{color:#1E8056;font-weight:bold}
    .footer{text-align:center;color:#596080;font-size:11px;margin-top:28px}
  </style></head><body>
    <div class="header">${logoUri ? `<img class="logo" src="${escapeHtml(logoUri)}" />` : ""}<h1>${escapeHtml(
    schoolName,
  )}</h1><p class="muted">${escapeHtml(
    firstValue(session?.schoolAddress, session?.tenant?.address, ""),
  )}</p><p class="muted">${escapeHtml(
    firstValue(session?.schoolContact, session?.tenant?.contact, ""),
  )}</p><h2>FEE RECEIPT</h2></div>
    <div class="meta"><div><span class="label">Receipt No</span><div class="value">${escapeHtml(
    details.receiptNo,
  )}</div></div><div><span class="label">Payment Date</span><div class="value">${escapeHtml(
    formatReceiptDate(details.paymentDate),
  )}</div></div></div>
    <div class="meta"><div><span class="label">Student/Ward</span><div class="value">${escapeHtml(
    studentName,
  )}</div></div><div><span class="label">Student ID</span><div class="value">${escapeHtml(
    firstValue(selectedStudent?.admission_no, selectedStudent?.id),
  )}</div></div></div>
    <div class="meta"><div><span class="label">Class</span><div class="value">${escapeHtml(
    firstValue(selectedStudent?.className, selectedStudent?.class_name),
  )}</div></div><div><span class="label">Section</span><div class="value">${escapeHtml(
    firstValue(selectedStudent?.section, selectedStudent?.division_name),
  )}</div></div><div><span class="label">Roll Number</span><div class="value">${escapeHtml(
    selectedStudent?.roll_no,
  )}</div></div></div>
    <div class="meta"><div><span class="label">Academic Year</span><div class="value">${escapeHtml(
    academicYear,
  )}</div></div><div><span class="label">Payment Status</span><div class="value status">${escapeHtml(
    details.status,
  )}</div></div></div>
    <table><thead><tr><th>Fee Description</th><th>Amount</th></tr></thead><tbody>${feeRows ||
    "<tr><td>Payment received</td><td>" +
    escapeHtml(formatMoney(details.amount)) +
    "</td></tr>"
    }<tr class="summary"><td>Total Fee</td><td>${escapeHtml(formatMoney(total))}</td></tr><tr><td>Amount Paid</td><td>${escapeHtml(
      formatMoney(paid),
    )}</td></tr><tr><td>Balance / Due</td><td>${escapeHtml(formatBalance(balance))}</td></tr></tbody></table>
    <div class="meta summary"><div><span class="label">Payment Method</span><div class="value">${escapeHtml(
      details.method,
    )}</div></div><div><span class="label">Transaction ID</span><div class="value">${escapeHtml(
      details.transactionId,
    )}</div></div></div><p class="footer">Thank you</p>
  </body></html>`;
};

const getLocalReceiptFile = async ({ receipt, session, generatePdf }) => {
  const details = transactionDetails(receipt);
  const receiptUrl = String(details.receiptUrl || "").trim();
  let mimeType = mimeTypeFrom(receiptUrl, details.mimeType);
  let localUri = receiptUrl;
  let generatedFromPayment = false;

  const generateReceiptCopy = async () => {
    const generated = await Print.printToFileAsync({ html: generatePdf() });
    localUri = generated?.uri;
    mimeType = "application/pdf";
    generatedFromPayment = true;
  };

  if (!receiptUrl) {
    await generateReceiptCopy();
  } else if (isRemoteUri(receiptUrl)) {
    try {
      if (!FileSystem.cacheDirectory) {
        throw new Error("A local receipt directory is unavailable.");
      }
      const destination = `${FileSystem.cacheDirectory}${receiptFileName(
        receipt,
        receiptUrl,
        mimeType,
      )}`;
      const downloadResult = await FileSystem.downloadAsync(
        receiptUrl,
        destination,
        session?.token
          ? { headers: { Authorization: `Bearer ${session.token}` } }
          : undefined,
      );
      const status = Number(downloadResult?.status);
      if (!Number.isFinite(status) || status < 200 || status >= 300) {
        throw new Error(
          `Receipt download failed (HTTP ${status || "unknown"}).`,
        );
      }
      const responseMimeType = String(
        downloadResult.mimeType ||
        Object.entries(downloadResult.headers || {}).find(
          ([name]) => name.toLowerCase() === "content-type",
        )?.[1] ||
        "",
      )
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (
        /^(text\/|application\/(json|problem\+json))/.test(responseMimeType)
      ) {
        throw new Error("The receipt URL returned a non-document response.");
      }
      localUri = downloadResult?.uri;
      if (!localUri || !isLocalUri(localUri)) {
        throw new Error("The receipt download did not return a local file.");
      }
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo?.exists || fileInfo.size === 0) {
        throw new Error("The downloaded receipt file could not be found.");
      }
    } catch {
      await generateReceiptCopy();
    }
  }

  if (!localUri || isRemoteUri(localUri) || !isLocalUri(localUri)) {
    throw new Error("The receipt was not downloaded to a local file.");
  }

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo?.exists) {
    throw new Error("The receipt file could not be found.");
  }

  return { localUri, mimeType, generatedFromPayment };
};

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "pending").toLowerCase();
  const isPaid = ["fully paid", "paid", "complete", "completed"].includes(
    normalizedStatus,
  );
  const isPartial = ["partial", "partially paid"].includes(normalizedStatus);

  const [bg, border, text, icon] = isPaid
    ? [colors.paleGreen, "#B6E7D0", colors.green, "checkmark-circle"]
    : isPartial
      ? [colors.paleOrange, "#F5D98B", colors.orange, "time"]
      : [colors.paleRed, "#F4C4C4", colors.red, "alert-circle"];

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={icon} size={11} color={text} style={{ marginRight: 4 }} />
      <Text style={[styles.statusText, { color: text }]}>
        {isPaid ? "Paid" : isPartial ? "Partial" : "Pending"}
      </Text>
    </View>
  );
}

function FeeTransaction({ transaction, selected, onToggle }) {
  const isPaid = transaction.balance <= 0;
  const isPartial = !isPaid && transaction.paid > 0;
  const accentColor = isPaid
    ? colors.green
    : isPartial
      ? colors.orange
      : colors.red;
  const status = isPaid ? "Paid" : isPartial ? "Partial" : "Pending";
  const percentPaid =
    transaction.total > 0
      ? Math.min(100, Math.max(0, Math.round((transaction.paid / transaction.total) * 100)))
      : 0;

  return (
    <View
      style={[
        styles.transactionCard,
        {
          borderLeftColor: accentColor,
          borderColor: selected ? colors.blue : colors.line,
          backgroundColor: selected ? "#FAFBFF" : colors.white,
        },
      ]}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.categoryWrap}>
          {transaction.balance > 0 ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Select ${transaction.category}`}
              onPress={() => onToggle(transaction.id)}
              style={styles.feeCheckbox}
              hitSlop={8}
            >
              <Ionicons
                name={selected ? "checkbox" : "square-outline"}
                size={22}
                color={selected ? colors.blue : colors.muted}
              />
            </Pressable>
          ) : (
            <View style={styles.settledIcon}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </View>
          )}
          <View style={styles.categoryTitleWrap}>
            <Text style={styles.category}>{transaction.category}</Text>
            {transaction.dueDate ? (
              <View style={styles.dueDateBadge}>
                <Ionicons name="calendar-outline" size={11} color={colors.muted} />
                <Text style={styles.dueDateBadgeText}>Due {transaction.dueDate}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <StatusBadge status={status} />
      </View>

      {/* Progress bar per fee */}
      <View style={styles.miniProgressContainer}>
        <View style={styles.miniProgressTrack}>
          <View
            style={[
              styles.miniProgressFill,
              {
                width: `${percentPaid}%`,
                backgroundColor: isPaid ? colors.green : isPartial ? colors.orange : colors.blue,
              },
            ]}
          />
        </View>
        <Text style={styles.miniProgressText}>
          {isPaid ? "100% Cleared" : `${percentPaid}% Paid`}
        </Text>
      </View>

      {/* 3-Column Financial Breakdown */}
      <View style={styles.transactionDetails}>
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>TOTAL FEE</Text>
          <Text style={styles.detailValue}>{formatMoney(transaction.total)}</Text>
        </View>
        <View style={styles.detailColDivider} />
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>AMOUNT PAID</Text>
          <Text
            style={[
              styles.detailValue,
              transaction.paid > 0 && { color: colors.green },
            ]}
          >
            {formatMoney(transaction.paid)}
          </Text>
        </View>
        <View style={styles.detailColDivider} />
        <View style={styles.detailCol}>
          <Text style={styles.detailLabel}>BALANCE DUE</Text>
          <Text
            style={[
              styles.detailValue,
              transaction.balance > 0 ? styles.balanceDue : styles.balanceCredit,
            ]}
          >
            {formatBalance(transaction.balance)}
          </Text>
        </View>
      </View>

      {/* Footer prompt */}
      {transaction.balance > 0 && (
        <Pressable
          style={styles.selectPromptRow}
          onPress={() => onToggle(transaction.id)}
        >
          <Text style={styles.selectPromptText}>
            {selected ? "Selected for settlement" : "Tap to select for payment"}
          </Text>
          <Ionicons
            name={selected ? "checkmark-circle" : "chevron-forward"}
            size={14}
            color={selected ? colors.blue : colors.muted}
          />
        </Pressable>
      )}
    </View>
  );
}

function ReceiptTransaction({ receipt, downloading, onDownload }) {
  const details = transactionDetails(receipt);

  return (
    <View style={styles.receiptCard}>
      <View style={styles.receiptHeader}>
        <View style={styles.receiptHeaderLeft}>
          <View style={styles.receiptIconWrap}>
            <Ionicons name="receipt-outline" size={18} color={colors.blue} />
          </View>
          <View>
            <Text style={styles.receiptNo}>Receipt #{receipt.receiptNo || details.receiptNo || "N/A"}</Text>
            <View style={styles.receiptDateRow}>
              <Ionicons name="calendar-outline" size={11} color={colors.muted} />
              <Text style={styles.receiptDate}>{formatReceiptDate(receipt.date || details.paymentDate)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.receiptHeaderRight}>
          <Text style={styles.receiptAmountLabel}>AMOUNT PAID</Text>
          <Text style={styles.receiptAmount}>+{formatMoney(receipt.amount || details.amount)}</Text>
        </View>
      </View>

      <View style={styles.receiptMetaRow}>
        <View style={styles.receiptMetaPill}>
          <Ionicons name="card-outline" size={12} color={colors.muted} />
          <Text style={styles.receiptMetaText}>Mode: {receipt.mode || details.method || "Cash / Online"}</Text>
        </View>
        {(receipt.transactionId || details.transactionId) ? (
          <View style={styles.receiptMetaPill}>
            <Ionicons name="barcode-outline" size={12} color={colors.muted} />
            <Text style={styles.receiptMetaText} numberOfLines={1}>
              Ref: {receipt.transactionId || details.transactionId}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.receiptFooter}>
        <Pressable
          style={[styles.receiptButton, downloading && styles.disabledButton]}
          onPress={() => onDownload(receipt)}
          disabled={downloading}
          accessibilityRole="button"
          accessibilityLabel="Download fee receipt"
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.blue} />
          ) : (
            <Ionicons name="download-outline" size={16} color={colors.blue} />
          )}
          <Text style={styles.receiptButtonText}>
            {downloading ? "Preparing Receipt PDF..." : "Download Official Receipt"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ParentFeesScreen({
  session,
  selectedStudentId,
  selectedStudent,
  onSessionExpired,
}) {
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState({});
  const [pendingFees, setPendingFees] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedFeeIds, setSelectedFeeIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);

  const loadFees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextSummary = await feesApi.getSummary(session, selectedStudentId);
      const nextPendingFees = nextSummary?.fees || [];
      setSummary(nextSummary || {});
      setPendingFees(nextPendingFees || []);
      setSelectedFeeIds(
        nextPendingFees
          .filter((fee) => fee.balance > 0)
          .map((fee) => fee.id),
      );
      try {
        const nextTransactionHistory = await feesApi.getTransactionHistory({
          ...session,
          studentId: selectedStudentId,
        });
        setTransactionHistory(nextTransactionHistory || []);
      } catch (transactionError) {
        if (transactionError.status === 401) onSessionExpired?.();
        setTransactionHistory([]);
      }
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to load fees. Please try again later.",
      );
      if (requestError.status === 401) onSessionExpired?.();
    } finally {
      setLoading(false);
    }
  }, [session, selectedStudentId, onSessionExpired]);

  useEffect(() => {
    const timer = setTimeout(() => void loadFees(), 0);
    return () => clearTimeout(timer);
  }, [loadFees]);

  const toggleFee = (feeId) => {
    setSelectedFeeIds((current) =>
      current.includes(feeId)
        ? current.filter((id) => id !== feeId)
        : [...current, feeId],
    );
  };

  const selectableFees = pendingFees.filter((fee) => fee.balance > 0);
  const allSelectableChosen =
    selectableFees.length > 0 &&
    selectableFees.every((f) => selectedFeeIds.includes(f.id));

  const toggleSelectAll = () => {
    if (allSelectableChosen) {
      setSelectedFeeIds([]);
    } else {
      setSelectedFeeIds(selectableFees.map((f) => f.id));
    }
  };

  const selectedFeeTotal = pendingFees.reduce(
    (total, fee) =>
      selectedFeeIds.includes(fee.id) && fee.balance > 0
        ? total + fee.balance
        : total,
    0,
  );
  const sortedPendingFees = [...pendingFees].sort(
    (left, right) => Number(right.balance > 0) - Number(left.balance > 0),
  );

  const cumulative = Number(summary?.cumulativeTotal || summary?.total || 0);
  const settled = Number(summary?.settledAmount || summary?.paid || 0);
  const dues = Number(summary?.institutionalDues || summary?.balance || 0);
  const clearanceRate =
    cumulative > 0
      ? Math.min(100, Math.max(0, Math.round((settled / cumulative) * 100)))
      : dues === 0 && settled > 0
        ? 100
        : 0;

  const downloadReceipt = async (receipt) => {
    if (downloadingReceiptId || !receipt) return;
    setDownloadingReceiptId(receipt.id);
    try {
      const receiptHtml = buildReceiptHtml({
        logoUri: null,
        session,
        selectedStudent,
        summary,
        transaction: receipt,
      });
      if (Platform.OS === "web") {
        const receiptUrl = String(
          transactionDetails(receipt).receiptUrl || "",
        ).trim();
        let downloadedOfficialReceipt = false;
        let receiptApiError = "";
        if (isRemoteUri(receiptUrl)) {
          try {
            const response = await fetch(receiptUrl, {
              headers: session?.token
                ? { Authorization: `Bearer ${session.token}` }
                : undefined,
            });
            if (!response.ok) {
              throw new Error(
                `Receipt request failed (HTTP ${response.status}).`,
              );
            }
            const blob = await response.blob();
            if (
              !blob.size ||
              /^(text\/|application\/(json|problem\+json))/.test(blob.type)
            ) {
              throw new Error("The API did not return a receipt document.");
            }
            downloadBlobOnWeb(
              blob,
              receiptFileName(
                receipt,
                receiptUrl,
                blob.type || "application/pdf",
              ),
            );
            downloadedOfficialReceipt = true;
          } catch (downloadError) {
            receiptApiError =
              downloadError?.message || "The API request failed.";
            downloadedOfficialReceipt = false;
          }
        }
        if (downloadedOfficialReceipt) return;

        const copyFileName = receiptFileName(
          receipt,
          "fee-receipt.html",
          "text/html",
        ).replace(/\.pdf$/i, "_copy.html");
        downloadBlobOnWeb(
          new Blob([receiptHtml], { type: "text/html;charset=utf-8" }),
          copyFileName,
        );
        const reason = receiptApiError
          ? ` The official receipt request failed: ${receiptApiError}.`
          : " No official receipt file URL was returned by the transaction API.";
        window.alert(
          `A payment-details receipt copy was downloaded as HTML.${reason}`,
        );
        return;
      }
      const { localUri, mimeType, generatedFromPayment } =
        await getLocalReceiptFile({
          receipt,
          session,
          generatePdf: () => receiptHtml,
        });
      if (Platform.OS === "android") {
        const permission =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) return;

        const fileName = receiptFileName(receipt, localUri, mimeType);
        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileName.slice(0, fileName.lastIndexOf(".")),
          mimeType,
        );
        const contents = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.StorageAccessFramework.writeAsStringAsync(
          fileUri,
          contents,
          { encoding: FileSystem.EncodingType.Base64 },
        );
        Alert.alert(
          generatedFromPayment
            ? "Receipt copy saved"
            : "Fee receipt downloaded successfully.",
          generatedFromPayment
            ? "The official receipt file was unavailable. This copy was generated from the transaction details."
            : undefined,
        );
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Receipt generated",
          "The receipt was generated, but sharing is not available on this device.",
        );
        return;
      }
      await Sharing.shareAsync(localUri, {
        mimeType,
        dialogTitle: "Download Fee Receipt",
        ...(mimeType === "application/pdf" ? { UTI: "com.adobe.pdf" } : {}),
      });
      Alert.alert(
        generatedFromPayment
          ? "Receipt copy ready"
          : "Fee receipt downloaded successfully.",
        generatedFromPayment
          ? "The official receipt file was unavailable. This copy was generated from the transaction details."
          : undefined,
      );
    } catch (requestError) {
      const message =
        requestError?.message || "Unable to generate the fee receipt.";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Unable to generate the fee receipt", message);
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const payOutstanding = () => {
    if (selectedFeeTotal <= 0) return;
    Alert.alert(
      "Online Payment Gateway",
      `Online payment processing is currently in setup mode for this portal. Selected dues to clear: ${formatMoney(selectedFeeTotal)}. Please visit the school fees counter or complete bank transfer.`,
    );
  };

  const isWide = width >= 768;
  const summaryCardWidth = isWide ? "31.8%" : "100%";

  return (
    <View style={styles.container}>
      {/* 1. Welcome / Header Banner (Matching Dashboard style) */}
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeCopy}>
          <Text style={styles.welcomeEyebrow}>IDPS Madanapalle · FINANCIAL PORTAL</Text>
          <Text style={styles.welcomeTitle}>Fees & Payments</Text>
          <Text style={styles.welcomeSubtitle}>
            {selectedStudent?.name
              ? `Ledger & receipts for ${selectedStudent.name}`
              : "Fee schedules, settlement breakdown, and downloadable receipts"}
          </Text>
        </View>
        <View style={styles.welcomeIconBadge}>
          <Ionicons name="wallet" size={28} color={colors.white} />
        </View>
      </View>



      {/* 4. Clearance Progress Card (Matching Dashboard progressCard) */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={styles.progressHeaderCopy}>
            <Text style={styles.progressTitle}>Annual Fee Settlement Status</Text>
            <Text style={styles.progressHint}>
              {dues > 0
                ? `${formatMoney(dues)} pending out of ${formatMoney(cumulative)} total`
                : "Congratulations! All fees have been fully settled for this term."}
            </Text>
          </View>
          <View
            style={[
              styles.clearanceBadge,
              {
                backgroundColor: clearanceRate === 100 ? colors.paleGreen : colors.paleBlue,
              },
            ]}
          >
            <Text
              style={[
                styles.clearanceText,
                { color: clearanceRate === 100 ? colors.green : colors.blue },
              ]}
            >
              {clearanceRate}% Cleared
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${clearanceRate}%`,
                backgroundColor: clearanceRate === 100 ? colors.green : colors.blue,
              },
            ]}
          />
        </View>

        <View style={styles.progressStats}>
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatLabel}>Total Budget</Text>
            <Text style={styles.progressStatValue}>{formatMoney(cumulative)}</Text>
          </View>
          <View style={styles.progressStatDivider} />
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatLabel}>Settled</Text>
            <Text style={[styles.progressStatValue, { color: colors.green }]}>
              {formatMoney(settled)}
            </Text>
          </View>
          <View style={styles.progressStatDivider} />
          <View style={styles.progressStatItem}>
            <Text style={styles.progressStatLabel}>Remaining Dues</Text>
            <Text
              style={[
                styles.progressStatValue,
                { color: dues > 0 ? colors.red : colors.green },
              ]}
            >
              {formatMoney(dues)}
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Segmented Tabs & Panel */}
      <View style={styles.feePanel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeading}>
            <View style={styles.panelIcon}>
              <Ionicons
                name={activeTab === "pending" ? "calendar-outline" : "receipt-outline"}
                size={18}
                color={colors.blue}
              />
            </View>
            <View style={styles.panelHeadingCopy}>
              <Text style={styles.panelTitle}>
                {activeTab === "pending" ? "Fee Schedule & Dues" : "Payment Ledger"}
              </Text>
              <Text style={styles.panelSubtitle}>
                {activeTab === "pending"
                  ? "Category breakdown and installment dates"
                  : "Verified payment transactions & receipts"}
              </Text>
            </View>
          </View>

          <View style={styles.tabContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === "pending" }}
              onPress={() => setActiveTab("pending")}
              style={[
                styles.segmentTab,
                activeTab === "pending" && styles.segmentTabActive,
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={15}
                color={activeTab === "pending" ? colors.blue : colors.muted}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  activeTab === "pending" && styles.segmentTabTextActive,
                ]}
              >
                Schedule
              </Text>
              <View
                style={[
                  styles.badgePill,
                  activeTab === "pending" && styles.badgePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    activeTab === "pending" && styles.badgePillTextActive,
                  ]}
                >
                  {pendingFees.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === "history" }}
              onPress={() => setActiveTab("history")}
              style={[
                styles.segmentTab,
                activeTab === "history" && styles.segmentTabActive,
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={15}
                color={activeTab === "history" ? colors.blue : colors.muted}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  activeTab === "history" && styles.segmentTabTextActive,
                ]}
              >
                Receipts
              </Text>
              <View
                style={[
                  styles.badgePill,
                  activeTab === "history" && styles.badgePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.badgePillText,
                    activeTab === "history" && styles.badgePillTextActive,
                  ]}
                >
                  {transactionHistory.length}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Selection Bar for Pending items */}
        {activeTab === "pending" && selectableFees.length > 0 && !loading && !error && (
          <View style={styles.selectionToolbar}>
            <Pressable onPress={toggleSelectAll} style={styles.selectAllButton}>
              <Ionicons
                name={allSelectableChosen ? "checkbox" : "square-outline"}
                size={18}
                color={colors.blue}
              />
              <Text style={styles.selectAllButtonText}>
                {allSelectableChosen ? "Deselect All" : "Select All Pending"}
              </Text>
            </Pressable>
            <View style={styles.selectedTotalPill}>
              <Text style={styles.selectedTotalText}>
                {selectedFeeIds.length} of {selectableFees.length} selected ({formatMoney(selectedFeeTotal)})
              </Text>
            </View>
          </View>
        )}

        <View style={styles.panelBody}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.blue} />
              <Text style={styles.loadingText}>Fetching fee records & invoices...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.red} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={loadFees}>
                <Ionicons name="refresh-outline" size={14} color={colors.white} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : activeTab === "pending" ? (
            pendingFees.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="checkmark-done-circle" size={40} color={colors.green} />
                </View>
                <Text style={styles.emptyTitle}>No Pending Dues Found</Text>
                <Text style={styles.emptySubtitle}>
                  All fees for the current academic session have been settled on time.
                </Text>
              </View>
            ) : (
              sortedPendingFees.map((transaction) => (
                <FeeTransaction
                  key={transaction.id}
                  transaction={transaction}
                  selected={selectedFeeIds.includes(transaction.id)}
                  onToggle={toggleFee}
                />
              ))
            )
          ) : transactionHistory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={38} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No Transaction History</Text>
              <Text style={styles.emptySubtitle}>
                No official payments or downloadable receipts recorded yet.
              </Text>
            </View>
          ) : (
            transactionHistory.map((receipt) => (
              <ReceiptTransaction
                key={receipt.id}
                receipt={receipt}
                downloading={downloadingReceiptId === receipt.id}
                onDownload={downloadReceipt}
              />
            ))
          )}
        </View>
      </View>

      {/* 6. Sticky / Floating Bottom Pay Bar */}
      {activeTab === "pending" && dues > 0 && selectedFeeTotal > 0 && (
        <View style={styles.bottomPayBar}>
          <View style={styles.bottomPaySummary}>
            <Text style={styles.bottomPayEyebrow}>Selected Outstanding Dues</Text>
            <Text style={styles.bottomPayAmount}>{formatMoney(selectedFeeTotal)}</Text>
            <Text style={styles.bottomPayCount}>
              {selectedFeeIds.length} item{selectedFeeIds.length === 1 ? "" : "s"} selected
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={loading || selectedFeeTotal <= 0}
            style={[
              styles.payActionButton,
              (loading || selectedFeeTotal <= 0) && styles.disabledButton,
            ]}
            onPress={payOutstanding}
          >
            <Ionicons name="card-outline" size={18} color={colors.white} />
            <Text style={styles.payActionButtonText}>Pay Selected</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.canvas,
    paddingBottom: 28,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },

  // 1. Welcome / Header Banner (Matching Dashboard welcomeBanner)
  welcomeBanner: {
    minHeight: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0878E8",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  welcomeCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  welcomeEyebrow: {
    color: "#D7EAFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  welcomeTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  welcomeSubtitle: {
    color: "#E7F2FF",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  welcomeIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. Student Info Strip
  studentStrip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: `${colors.blue}30`,
    alignItems: "center",
    justifyContent: "center",
  },
  studentAvatarText: {
    color: colors.blue,
    fontSize: 16,
    fontWeight: "900",
  },
  studentStripCopy: { flex: 1, minWidth: 0 },
  studentName: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  studentMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionPill: {
    backgroundColor: colors.paleBlue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.blue}20`,
  },
  sessionPillText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
  },

  // 3. Dashboard-style Summary Cards
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    minHeight: 88,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    padding: 12,
    justifyContent: "space-between",
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 2,
  },
  summaryDetail: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
  },

  // 4. Clearance Progress Card
  progressCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  progressHeaderCopy: { flex: 1, minWidth: 0 },
  progressTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  progressHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  clearanceBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  clearanceText: {
    fontSize: 11,
    fontWeight: "900",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "#EEF0FC",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#F7F8FF",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  progressStatItem: {
    alignItems: "center",
    flex: 1,
  },
  progressStatLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  progressStatValue: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  progressStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.line,
  },

  // 5. Panel Header & Segmented Tabs
  feePanel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: "hidden",
  },
  panelHeader: {
    backgroundColor: "#F8F9FF",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  panelHeading: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  panelIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: `${colors.blue}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  panelHeadingCopy: { flex: 1, minWidth: 0 },
  panelTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  panelSubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 },

  tabContainer: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.canvas,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  segmentTabActive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentTabText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  segmentTabTextActive: {
    color: colors.blue,
    fontWeight: "900",
  },
  badgePill: {
    backgroundColor: "#E9EEF4",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgePillActive: {
    backgroundColor: colors.paleBlue,
  },
  badgePillText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
  },
  badgePillTextActive: {
    color: colors.blue,
  },

  selectionToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FAFBFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectAllButtonText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "800",
  },
  selectedTotalPill: {
    backgroundColor: colors.paleBlue,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedTotalText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "800",
  },

  panelBody: { padding: 12 },

  // Fee Transaction Card
  transactionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
  },
  transactionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  categoryWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  feeCheckbox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  settledIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTitleWrap: { flex: 1, minWidth: 0 },
  category: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  dueDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  dueDateBadgeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 10, fontWeight: "900" },

  miniProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  miniProgressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#EEF0FC",
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  miniProgressText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
  },

  transactionDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F8FF",
    borderRadius: 8,
    padding: 9,
  },
  detailCol: { flex: 1, alignItems: "center" },
  detailColDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.line,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 2,
  },
  detailValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  balanceDue: { color: colors.red },
  balanceCredit: { color: colors.green },

  selectPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  selectPromptText: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "700",
  },

  // Receipt Card
  receiptCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.blue,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  receiptHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  receiptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.paleBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptNo: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  receiptDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  receiptDate: {
    color: colors.muted,
    fontSize: 10,
  },
  receiptHeaderRight: {
    alignItems: "flex-end",
  },
  receiptAmountLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: "800",
  },
  receiptAmount: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "900",
  },

  receiptMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  receiptMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F7F8FF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  receiptMetaText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },

  receiptFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  receiptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.paleBlue,
    borderWidth: 1,
    borderColor: `${colors.blue}30`,
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  receiptButtonText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "900",
  },

  // Bottom Pay Bar
  bottomPayBar: {
    marginTop: 14,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: `${colors.blue}40`,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bottomPaySummary: { flex: 1, minWidth: 0 },
  bottomPayEyebrow: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bottomPayAmount: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  bottomPayCount: {
    color: colors.blue,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  payActionButton: {
    backgroundColor: colors.blue,
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  payActionButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  disabledButton: { opacity: 0.5 },

  // State Containers
  loadingContainer: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F4C4C4",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  emptyContainer: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F7F8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  emptySubtitle: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 15,
  },
});
