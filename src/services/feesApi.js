import { apiRequest, isApiConfigured, resolveApiUrl } from "./api";
import {
    parentFeesSummary,
    parentPendingFees,
    parentTransactionHistory,
} from "./feesMock";

const amountFrom = (...values) => {
  const value = values.find(
    (candidate) =>
      candidate !== undefined && candidate !== null && candidate !== "",
  );
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? 0).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateFrom = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
};

const listFrom = (payload) => {
  const candidates = [
    payload?.data?.fees,
    payload?.data?.pending_fees,
    payload?.data?.pendingFees,
    payload?.data?.data,
    payload?.data,
    payload?.fees,
    payload?.studentFees,
    payload,
  ];
  const result = candidates.find((candidate) => Array.isArray(candidate));
  return result || [];
};

const transactionsFrom = (payload) => {
  const transactions =
    payload?.transactions ||
    payload?.data?.transactions ||
    payload?.data?.payments ||
    payload?.data?.results ||
    payload?.data?.items ||
    payload?.data?.data?.transactions ||
    payload?.data?.data?.payments ||
    payload?.data?.data?.results ||
    payload?.result?.transactions ||
    payload?.result?.payments ||
    payload?.results ||
    payload?.items ||
    payload?.data?.data ||
    payload?.data ||
    [];
  return Array.isArray(transactions) ? transactions : [];
};

const receiptUrlFrom = (receipt) => {
  const nestedReceipt =
    receipt.receipt && typeof receipt.receipt === "object"
      ? receipt.receipt
      : {};
  const value =
    receipt.receiptUrl ||
    receipt.receipt_url ||
    receipt.receipt_download_url ||
    receipt.receipt_path ||
    receipt.receipt_file_path ||
    receipt.receipt_file ||
    receipt.receipt_file_url ||
    receipt.document_url ||
    receipt.download_path ||
    receipt.file_url ||
    receipt.file_path ||
    receipt.download_url ||
    receipt.url ||
    nestedReceipt.url ||
    nestedReceipt.path ||
    nestedReceipt.file_url ||
    nestedReceipt.download_url ||
    (typeof receipt.receipt === "string" ? receipt.receipt : "") ||
    "";
  return value ? resolveApiUrl(value) : "";
};

const normalizeTransaction = (receipt, index) => ({
  ...receipt,
  id:
    receipt.id ??
    receipt.transaction_id ??
    receipt.transactionId ??
    receipt.payment_id ??
    index + 1,
  date: dateFrom(
    receipt.date ||
      receipt.payment_date ||
      receipt.paymentDate ||
      receipt.transaction_date ||
      receipt.created_at,
  ),
  receiptNo:
    receipt.receiptNo ||
    receipt.receipt_no ||
    receipt.receipt_number ||
    receipt.receipt_id ||
    "-",
  receiptUrl: receiptUrlFrom(receipt),
  mode:
    receipt.mode ||
    receipt.payment_mode ||
    receipt.paymentMode ||
    receipt.payment_method ||
    receipt.paymentMethod ||
    receipt.payment_method_name ||
    receipt.paymentMethodName ||
    receipt.payment_type ||
    receipt.paymentType ||
    (receipt.upi_id || receipt.upiId ? "UPI" : "-"),
  amount: amountFrom(
    receipt.amount,
    receipt.paid_amount,
    receipt.paidAmount,
    receipt.payment_amount,
    receipt.paymentAmount,
    receipt.total_amount,
  ),
});

const normalizeFee = (fee, index) => {
  const total = amountFrom(
    fee.total,
    fee.total_amount,
    fee.totalAmount,
    fee.final_amount,
    fee.finalAmount,
    fee.amount,
    fee.fee_amount,
    fee.feeAmount,
  );
  const paid = amountFrom(
    fee.paid,
    fee.paid_amount,
    fee.paidAmount,
    fee.paid_total,
    fee.paidTotal,
    fee.amount_paid,
    fee.amountPaid,
    fee.paid_fee,
    fee.paidFee,
  );
  const balanceValue =
    fee.balance ??
    fee.balance_due ??
    fee.balanceDue ??
    fee.due_amount ??
    fee.dueAmount;
  const balance =
    balanceValue === undefined ? total - paid : amountFrom(balanceValue);
  const status = fee.status || (balance > 0 ? "Pending" : "Fully Paid");

  return {
    ...fee,
    id: fee.id ?? fee.fee_id ?? fee.feeId ?? index + 1,
    category: fee.category || fee.fee_type || fee.feeType || fee.name || "Fee",
    total,
    paid,
    balance,
    dueDate: dateFrom(
      fee.dueDate ||
        fee.due_date ||
        fee.fee_due_date ||
        fee.feeDueDate ||
        fee.due,
    ),
    status,
  };
};

const normalizeSummary = (summary = {}, fees = []) => {
  const cumulativeTotal = amountFrom(
    summary.cumulativeTotal,
    summary.cumulative_total,
    summary.total,
    summary.total_amount,
    summary.totalAmount,
    summary.total_fees,
    summary.totalFees,
    summary.total_fee,
    summary.totalFee,
    fees.reduce((total, fee) => total + fee.total, 0),
  );
  const settledAmount = amountFrom(
    summary.settledAmount,
    summary.settled_amount,
    summary.paid,
    summary.paid_amount,
    summary.paidAmount,
    summary.total_paid,
    summary.totalPaid,
    summary.paid_fee,
    summary.paidFee,
    fees.reduce((total, fee) => total + fee.paid, 0),
  );
  const balance = amountFrom(
    summary.institutionalDues,
    summary.institutional_dues,
    summary.balance,
    summary.due,
    summary.outstanding,
    summary.outstanding_amount,
    summary.pending_amount,
    summary.total_due,
    summary.totalDue,
    summary.remaining_amount,
    summary.remainingAmount,
    fees.reduce((total, fee) => total + Math.max(fee.balance, 0), 0),
  );

  return {
    ...summary,
    cumulativeTotal,
    settledAmount,
    institutionalDues: balance,
    fees,
  };
};

export const feesApi = {
  async getSummary(session, studentId) {
    if (!isApiConfigured) return parentFeesSummary;
    const payload = await apiRequest(`/parents/child/${studentId}/fees`, {
      token: session?.token,
    });
    if (payload?.data?.summary) {
      return normalizeSummary(
        payload.data.summary,
        listFrom(payload).map(normalizeFee),
      );
    }
    const allFees = listFrom(payload);
    const fees = studentId
      ? allFees.filter(
          (fee) =>
            String(fee.student_id ?? fee.studentId) === String(studentId),
        )
      : allFees;
    return normalizeSummary({}, fees.map(normalizeFee));
  },

  async getPendingFees(session) {
    if (!isApiConfigured) return parentPendingFees;
    const payload = await apiRequest("/fees/pending", {
      token: session?.token,
    });
    return listFrom(payload).map(normalizeFee);
  },

  async getTransactionHistory(session) {
    if (!isApiConfigured) return parentTransactionHistory;
    const request = {
      token: session?.token,
      query: { student_id: session?.studentId },
    };
    try {
      const payload = await apiRequest("/finance/transactions", request);
      return transactionsFrom(payload).map(normalizeTransaction);
    } catch (error) {
      if (error?.status !== 404) throw error;
      const payload = await apiRequest("/fees/transactions", request);
      return transactionsFrom(payload).map(normalizeTransaction);
    }
  },

  async getChildProfile(session) {
    if (!isApiConfigured) return null;
    const payload = await apiRequest("/parents/profile", {
      token: session?.token,
    });
    return payload?.data || payload?.profile || null;
  },
};
