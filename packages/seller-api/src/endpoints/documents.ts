/**
 * Company documents and KYC: the document list, attach and delete, the private media upload
 * routes and the verified-document change requests.
 *
 * A file is uploaded first (`/media/seller-documents/:type`, or `/media/kyc/:type` for the GST
 * manual path, which enforces PDF) and then attached. The two steps are separate calls so a failed
 * attach is retried without uploading the file again.
 */
import { api } from "../http/client";
import { getPage, qs, type Page } from "./paged";
import type { ProfileVerification } from "./profile";

export type DocumentType =
  | "GST_CERTIFICATE"
  | "PAN_CARD"
  | "AADHAAR_CARD"
  | "IEC_CERTIFICATE"
  | "INCORPORATION_CERTIFICATE"
  | "BUSINESS_LICENSE"
  | "ADDRESS_PROOF"
  | "BANK_PROOF"
  | "UDYAM_CERTIFICATE"
  | "FSSAI_LICENSE"
  | "EXPORT_LICENSE"
  | "COMMERCIAL_INVOICE"
  | "PACKING_LIST"
  | "CERTIFICATE_OF_ORIGIN"
  | "BILL_OF_LADING"
  | "SHIPPING_BILL"
  | "INSURANCE_CERTIFICATE"
  | "OTHER";

export interface CompanyDocumentView {
  id: string;
  mediaAssetId: string;
  documentType: DocumentType;
  label: string | null;
  documentNumber: string | null;
  fileName: string;
  fileUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedByName: string | null;
  uploadedAt: string;
  verificationState: ProfileVerification;
  verifiedAt: string | null;
  rejectionReason: string | null;
  expiresOn: string | null;
  isExpired: boolean;
  version: number;
  isActive: boolean;
}

export const listDocuments = (includeArchived = false, signal?: AbortSignal): Promise<Page<CompanyDocumentView>> =>
  getPage<CompanyDocumentView>(
    `/seller/profile/documents${qs({ limit: 100, includeArchived: includeArchived ? "true" : undefined })}`,
    { requireAuth: true, signal },
  );

export interface AttachDocumentBody {
  documentType: DocumentType;
  mediaAssetId: string;
  label?: string;
  documentNumber?: string;
  expiresOn?: string;
}

export const attachDocument = (body: AttachDocumentBody) =>
  api.post<CompanyDocumentView>("/seller/profile/documents", body, { requireAuth: true });

export const deleteDocument = (id: string) =>
  api.delete<{ removed: true }>(`/seller/profile/documents/${encodeURIComponent(id)}`, { requireAuth: true });

/** A short-lived link to a private file; valid for one hour. */
export const getMediaSignedUrl = (mediaAssetId: string, signal?: AbortSignal) =>
  api.get<{ url: string; expiresInSeconds: number }>(`/media/${encodeURIComponent(mediaAssetId)}/signed-url`, {
    requireAuth: true,
    signal,
  });

/** What an upload route returns (the same shape for every purpose). */
export interface UploadedMedia {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status?: string;
}

/** The path the app uploads a private document to. */
export const sellerDocumentUploadPath = (type: DocumentType) =>
  `/media/seller-documents/${encodeURIComponent(type)}`;

/** The KYC-evidence route, which enforces PDF; the GST manual certificate goes here. */
export const kycEvidenceUploadPath = (type: DocumentType) => `/media/kyc/${encodeURIComponent(type)}`;

/* ------------------------------------------------------------------ KYC change requests */

export interface KycChangeRequest {
  id: string;
  documentType: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  decisionNote: string | null;
  ticketId: string | null;
  createdAt: string;
}

export const listKycChangeRequests = (signal?: AbortSignal) =>
  api.get<KycChangeRequest[]>("/me/kyc/change-requests", { requireAuth: true, signal });

/** Asks compliance to unlock a verified document for one replacement upload; opens a support ticket. */
export const requestKycDocumentChange = (documentType: DocumentType, reason: string) =>
  api.post<KycChangeRequest>("/me/kyc/change-requests", { documentType, reason }, { requireAuth: true });

/** An open ask from compliance for more documents (GET /me/kyc, field documentRequests). */
export interface KycDocumentRequest {
  id: string;
  documentTypes: string[];
  notes: string | null;
  status: string;
  createdAt: string;
}

/** GET /me/kyc: the seller's KYC case, with the asks compliance has made; null before any case. */
export interface KycCaseView {
  id?: string;
  status?: string;
  documentRequests?: KycDocumentRequest[];
}

export const getMyKyc = (signal?: AbortSignal) =>
  api.get<KycCaseView | null>("/me/kyc", { requireAuth: true, signal });
