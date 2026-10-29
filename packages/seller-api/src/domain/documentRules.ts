/**
 * Company document rules: the three KYC documents, the other 15 types, the state each slot is in,
 * the capture limits, and the two-step upload (upload the file, then attach it) that never uploads
 * the same file twice.
 */
import { ApiError } from "../http/client";
import type { CompanyDocumentView, DocumentType, KycChangeRequest, UploadedMedia } from "../endpoints/documents";

export const REQUIRED_KYC_DOCUMENTS: readonly DocumentType[] = ["GST_CERTIFICATE", "PAN_CARD", "AADHAAR_CARD"];

/** The remaining 15 types, in the order the web lists them (the export set stays with them). */
export const OTHER_DOCUMENT_TYPES: readonly DocumentType[] = [
  "IEC_CERTIFICATE",
  "INCORPORATION_CERTIFICATE",
  "BUSINESS_LICENSE",
  "ADDRESS_PROOF",
  "BANK_PROOF",
  "UDYAM_CERTIFICATE",
  "FSSAI_LICENSE",
  "EXPORT_LICENSE",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "BILL_OF_LADING",
  "SHIPPING_BILL",
  "INSURANCE_CERTIFICATE",
  "OTHER",
];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  GST_CERTIFICATE: "GST certificate",
  PAN_CARD: "PAN card",
  AADHAAR_CARD: "Aadhaar card",
  IEC_CERTIFICATE: "IEC certificate",
  INCORPORATION_CERTIFICATE: "Incorporation certificate",
  BUSINESS_LICENSE: "Business licence",
  ADDRESS_PROOF: "Address proof",
  BANK_PROOF: "Bank proof",
  UDYAM_CERTIFICATE: "Udyam certificate",
  FSSAI_LICENSE: "FSSAI licence",
  EXPORT_LICENSE: "Export licence",
  COMMERCIAL_INVOICE: "Commercial invoice",
  PACKING_LIST: "Packing list",
  CERTIFICATE_OF_ORIGIN: "Certificate of origin",
  BILL_OF_LADING: "Bill of lading",
  SHIPPING_BILL: "Shipping bill",
  INSURANCE_CERTIFICATE: "Insurance certificate",
  OTHER: "Other document",
};

export const documentLabel = (type: string): string => DOCUMENT_LABELS[type as DocumentType] ?? type;

export const DOCUMENT_FIELD_LIMITS = { number: 100, label: 150, changeReasonMin: 5, changeReasonMax: 1000 } as const;

/** Capture and upload limits. The server accepts up to 25 MB; the app aims for 5 MB or less. */
export const DOCUMENT_UPLOAD_LIMITS = {
  maxPages: 10,
  longSidePx: 1600,
  jpegQuality: 0.7,
  targetBytes: 5 * 1024 * 1024,
  hardBytes: 25 * 1024 * 1024,
  /** Tried in order when the combined PDF is over the target. */
  qualitySteps: [0.7, 0.55, 0.4, 0.3] as readonly number[],
} as const;

/** The next, lower JPEG quality to retry with, or null when the ladder is used up. */
export function nextQuality(current: number): number | null {
  const steps = DOCUMENT_UPLOAD_LIMITS.qualitySteps;
  const index = steps.findIndex((step) => step <= current + 1e-9);
  const next = index === -1 ? undefined : steps[index + 1];
  return next ?? null;
}

export type SizeVerdict = "ok" | "retryLower" | "tooLarge";

/** Under the target is fine; over the target retries at lower quality; over the hard limit is refused. */
export function sizeVerdict(bytes: number, canRetryLower: boolean): SizeVerdict {
  if (bytes <= DOCUMENT_UPLOAD_LIMITS.targetBytes) return "ok";
  if (canRetryLower) return "retryLower";
  return bytes <= DOCUMENT_UPLOAD_LIMITS.hardBytes ? "ok" : "tooLarge";
}

/** Moves one page within the list (a copy); out-of-range moves leave the order alone. */
export function movePage<T>(pages: readonly T[], from: number, to: number): T[] {
  const copy = [...pages];
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length || from === to) return copy;
  const [page] = copy.splice(from, 1);
  copy.splice(to, 0, page);
  return copy;
}

export const removePage = <T>(pages: readonly T[], index: number): T[] => pages.filter((_, i) => i !== index);

/* ------------------------------------------------------------------ slot state */

/**
 * `verified` documents are locked on the server (DOCUMENT_VERIFIED_LOCKED): they cannot be deleted
 * or replaced until compliance approves a change request.
 */
export type SlotState =
  | "missing"
  | "uploaded"
  | "underReview"
  | "verified"
  | "rejected"
  | "expired"
  | "changeRequested"
  | "changeApproved";

const byNewest = <T extends { createdAt?: string; uploadedAt?: string }>(a: T, b: T) =>
  Date.parse(b.uploadedAt ?? b.createdAt ?? "") - Date.parse(a.uploadedAt ?? a.createdAt ?? "");

/** The one active document of a type, or null. The newest active one wins if there are several. */
export function activeDocumentOf(documents: readonly CompanyDocumentView[], type: DocumentType): CompanyDocumentView | null {
  const matches = documents.filter((doc) => doc.documentType === type && doc.isActive);
  return matches.sort(byNewest)[0] ?? null;
}

/** The change request still in play for a type (waiting or approved but not yet used). */
export function openChangeRequest(
  requests: readonly KycChangeRequest[],
  type: DocumentType,
): KycChangeRequest | null {
  return (
    requests
      .filter((request) => request.documentType === type && (request.status === "PENDING" || request.status === "APPROVED"))
      .sort(byNewest)[0] ?? null
  );
}

export function slotState(doc: CompanyDocumentView | null, request: KycChangeRequest | null): SlotState {
  if (!doc) return "missing";
  if (doc.verificationState === "VERIFIED") {
    if (request?.status === "APPROVED") return "changeApproved";
    if (request?.status === "PENDING") return "changeRequested";
    return doc.isExpired ? "expired" : "verified";
  }
  if (doc.verificationState === "REJECTED") return "rejected";
  if (doc.isExpired || doc.verificationState === "EXPIRED") return "expired";
  if (doc.verificationState === "SUBMITTED" || doc.verificationState === "UNDER_REVIEW") return "underReview";
  return "uploaded";
}

export interface SlotActions {
  canUpload: boolean;
  canRemove: boolean;
  canRequestChange: boolean;
}

export function slotActions(state: SlotState, doc: CompanyDocumentView | null): SlotActions {
  const locked = doc?.verificationState === "VERIFIED";
  return {
    canUpload: !locked || state === "changeApproved",
    canRemove: Boolean(doc) && !locked,
    canRequestChange: locked && state !== "changeRequested" && state !== "changeApproved",
  };
}

/** Required documents that still need a file: a document counts unless it was rejected. */
export function missingRequired(documents: readonly CompanyDocumentView[]): DocumentType[] {
  return REQUIRED_KYC_DOCUMENTS.filter((type) => {
    const doc = activeDocumentOf(documents, type);
    return !doc || doc.verificationState === "REJECTED";
  });
}

export const kycComplete = (documents: readonly CompanyDocumentView[]): boolean => missingRequired(documents).length === 0;

/** "Extra" documents: everything that is not one of the three required types. */
export function otherDocuments(documents: readonly CompanyDocumentView[]): CompanyDocumentView[] {
  return documents.filter((doc) => !REQUIRED_KYC_DOCUMENTS.includes(doc.documentType)).sort(byNewest);
}

/* ------------------------------------------------------------------ errors */

export type DocumentErrorKind = "locked" | "notClean" | "storageFull" | "tooLarge" | "unsupported" | "other";

export function documentErrorKind(error: unknown): DocumentErrorKind {
  if (!(error instanceof ApiError)) return "other";
  switch (error.code) {
    case "DOCUMENT_VERIFIED_LOCKED":
      return "locked";
    case "MEDIA_NOT_CLEAN":
      return "notClean";
    case "FEATURE_LIMIT_REACHED":
      return "storageFull";
    case "UPLOAD_TOO_LARGE":
    case "FILE_TOO_LARGE":
      return "tooLarge";
    case "UNSUPPORTED_MEDIA_TYPE":
    case "FILE_TYPE_NOT_ALLOWED":
      return "unsupported";
    default:
      if (error.statusCode === 413) return "tooLarge";
      if (error.statusCode === 415) return "unsupported";
      return "other";
  }
}

/* ------------------------------------------------------------------ two-step upload */

export interface UploadDeps<File, Result> {
  upload(file: File): Promise<UploadedMedia>;
  attach(mediaAssetId: string): Promise<Result>;
}

/**
 * Uploads a file and attaches it. When the attach step fails the uploaded media id is kept, so
 * `run()` called again retries only the attach: each upload counts toward the storage allowance,
 * and a retry must never spend it twice.
 */
export class DocumentUploadFlow<File, Result = CompanyDocumentView> {
  private mediaId: string | null = null;

  constructor(private readonly deps: UploadDeps<File, Result>) {}

  get uploadedMediaId(): string | null {
    return this.mediaId;
  }

  async run(file: File): Promise<Result> {
    if (!this.mediaId) {
      const media = await this.deps.upload(file);
      this.mediaId = media.id;
    }
    const document = await this.deps.attach(this.mediaId);
    this.mediaId = null;
    return document;
  }
}

/* ------------------------------------------------------------------ view helpers */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The size bucket analytics may carry instead of the real size. */
export function sizeBucket(bytes: number): "lt1mb" | "1to5mb" | "gt5mb" {
  if (bytes < 1024 * 1024) return "lt1mb";
  return bytes <= 5 * 1024 * 1024 ? "1to5mb" : "gt5mb";
}
