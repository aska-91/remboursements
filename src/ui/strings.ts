/** All user-facing text lives here so another language can be added later. */
import type { Category, ClaimStatus, RefundMode, Source } from "../domain/types";
import type { ListFilter } from "../domain/list";
import { SOURCE_NAMES } from "../domain/messages";
import { formatDate } from "../domain/dates";
import { formatMoney as m } from "../domain/money";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const days = (n: number) => plural(n, "day");

export const strings = {
  appName: "Refund Tracker",
  tagline: "Every expense you paid upfront, what you are owed, by whom, and everything that happened since.",
  loading: "Loading…",
  storageNotPersistent: "Storage is unavailable in this browser window: changes will be lost when it is closed.",
  migrated: (n: number) => `${plural(n, "expense")} imported from the previous version.`,
  saveFailed: "Could not save on this device. Your last change may be lost if you close the app.",

  categories: {
    gp: "General practitioner",
    specialist: "Specialist",
    pharmacy: "Pharmacy",
    dental_optical: "Dental / Optical",
    lab_tests: "Tests / Lab work",
    item_return: "Item return",
    other: "Other",
  } satisfies Record<Category, string>,
  sources: SOURCE_NAMES satisfies Record<Source, string>,
  refundModes: {
    original_payment: "to original payment method",
    store_credit: "store credit / voucher",
    other: "other",
  } satisfies Record<RefundMode, string>,

  status: {
    pending: "Pending",
    partial: "Partial",
    received: "Received",
    late: "Late",
    gap: "Gap to chase",
    to_return: "To return",
    to_send: "Request to send",
    refused: "Refused",
    cancelled: "Cancelled",
  } satisfies Record<ClaimStatus, string>,
  archivedPill: "Archived",

  /** "in 3 days" / "today" / "overdue by 2 days" */
  inDays: (d: number) => (d < 0 ? `overdue by ${days(-d)}` : d === 0 ? "today" : `in ${days(d)}`),

  // ---------- list ----------
  filters: {
    in_progress: "In progress",
    to_chase: "To chase",
    done: "Done",
    refused_cancelled: "Refused / cancelled",
    archived: "Archive",
    all: "All",
  } satisfies Record<ListFilter, string>,
  filtersLabel: "Filters",
  searchPlaceholder: "Search (doctor, shop, note, history…)",
  searchLabel: "Search",
  categoryLabel: "Category",
  allCategories: "All categories",
  emptyView: "No expenses in this view.",
  emptyAll: "No expenses tracked yet.",
  listLabel: "Expenses",

  // ---------- card ----------
  card: {
    meta: (category: string, date: string, ref: string) =>
      `${category} · paid on ${formatDate(date)}${ref ? ` · ref. ${ref}` : ""}`,
    paid: (amount: number) => `Paid ${m(amount)}`,
    cancelled: "Cancelled",
    stillToReceive: "still to receive",
    receivedTotal: "received in total",
    cancelReason: (reason: string) => `Cancelled: ${reason}`,
    noItems: "No refund expected on this expense.",
    note: (text: string) => `Note: ${text}`,
    history: (n: number) => `History (${n})`,
    noHistory: "No events recorded.",
    refundLines: "Expected refunds",
  },
  item: {
    received: (amount: number) => `${m(amount)} received`,
    receivedOn: (date: string) => `Received on ${formatDate(date)}`,
    gap: (received: number, expected: number, gap: number) => `${m(received)} received of ${m(expected)} · ${m(gap)} missing`,
    lastPayment: (date: string) => `Last payment on ${formatDate(date)}`,
    writtenOff: (received: number, expected: number, gap: number) =>
      `${m(received)} received of ${m(expected)} · ${m(gap)} out-of-pocket`,
    writtenOffWhen: "Gap accepted as out-of-pocket",
    refused: (expected: number) => `${m(expected)} refused`,
    refusedReason: (reason: string) => `Reason: ${reason || "not specified"}`,
    expected: (expected: number) => `${m(expected)} expected`,
    afterReturn: "Refund expected after the return",
    late: (daysLate: number, due: string) => `Late by ${days(daysLate)} (due ${formatDate(due)})`,
    dueToday: "Due today",
    due: (due: string, d: number) => `Due ${formatDate(due)} (in ${days(d)})`,
    noDue: "No expected date",
    chased: (date: string) => ` · chased on ${formatDate(date)}`,
  },
  shop: {
    step1: "1. To return",
    step2: "2. Returned",
    step3: (mode: string) => `3. Refund (${mode})`,
    done: "Done",
    returnBefore: (date: string, inDays: string) => `Before ${formatDate(date)} (${inDays})`,
    noDeadline: "No deadline set",
    returnedOn: (date: string, tracking: string) => `On ${formatDate(date)}${tracking ? ` · tracking ${tracking}` : ""}`,
    toDo: "To do",
    left: (amount: number) => `${m(amount)} left`,
    afterReturn: "After the return",
  },
  request: {
    sent: (date: string) => `Request sent on ${formatDate(date)}`,
    toSendBefore: (date: string, inDays: string) => `Request to send before ${formatDate(date)} (${inDays})`,
    toSendNoDeadline: "Request to send (no deadline)",
  },
  actions: {
    markReceived: "Mark received",
    topUp: "Top-up received",
    chase: "Chase",
    refused: "Refused",
    writeOff: "Out-of-pocket",
    undo: "Undo",
    reopen: "Reopen",
    markReturned: "Mark as returned",
    markSent: "Mark as sent",
    addNote: "Add note",
    edit: "Edit",
    archive: "Archive",
    unarchive: "Restore",
    deleteForever: "Delete permanently",
    reinstate: "Reinstate",
    cancelClaim: "Cancel expense",
  },

  // ---------- dialogs ----------
  dialog: {
    cancel: "Cancel",
    ok: "OK",
    confirm: "Confirm",
    receivedTitle: "Refund received",
    topUpTitle: "Top-up payment",
    receivedInfo: (label: string, source: string, expected: number) => `${label} · ${source} · ${m(expected)} expected`,
    topUpInfo: (label: string, source: string, missing: number) => `${label} · ${source} · ${m(missing)} missing`,
    amountReceived: "Amount received (€)",
    receivedDate: "Date received",
    stillMissing: (gap: number) => `${m(gap)} will still be missing. The line will stay open (gap).`,
    writeOffCheckbox: "Accept the missing amount as out-of-pocket (stop chasing it)",

    chaseTitle: (source: string) => `Chase ${source}`,
    chaseInfo: (label: string, amount: number) => `${label} · ${m(amount)} expected`,
    chaseDate: "Date of the follow-up",
    chaseText: "What was done or said (optional)",
    chaseNewDue: "New expected date (optional)",
    chaseOk: "Save follow-up",

    refuseTitle: "Refund refused",
    refuseText: "Reason for refusal",
    refuseOk: "Save refusal",

    cancelTitle: "Cancel the expense",
    cancelInfo: (label: string) => `${label} · no refund will be expected any more (history is kept).`,
    cancelText: "Reason",
    cancelOk: "Cancel the expense",

    noteTitle: "Add to history",
    noteDate: "Date",
    noteText: "Note",
    noteOk: "Add",

    sentTitle: "Request sent",
    sentDate: "Sent on",
    sentText: "How (post, app…) (optional)",
    sentOk: "Save",

    returnedTitle: "Item returned",
    returnedDate: "Return date",
    returnedTracking: "Parcel tracking number (optional)",
    returnedRefundDue: "Refund expected by",
    returnedOk: "Save return",

    deleteTitle: "Delete permanently",
    deleteMessage: (label: string) => `Delete “${label}” and its whole history? This cannot be undone.`,
    deleteOk: "Delete",
  },

  toast: {
    received: "Refund recorded",
    writtenOff: "Gap accepted as out-of-pocket",
    archived: "Expense archived",
    deleted: "Expense deleted",
    saved: "Saved",
  },
};
