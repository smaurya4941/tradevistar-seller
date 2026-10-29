import {
  ApiError,
  DocumentUploadFlow,
  addDays,
  addressPayload,
  awayMinDate,
  bankActions,
  buildInviteLink,
  canActOn,
  canManage,
  changedFields,
  confirmedAccount,
  currentMember,
  documentErrorKind,
  emptyAddressForm,
  emptyExceptionForm,
  exceptionPayload,
  fieldsFromConfirmationError,
  gstOwnershipView,
  gstinAutofill,
  isAcceptableNewPassword,
  isStaleVersion,
  memberActions,
  mergeStale,
  minutesToTime,
  missingPinWarning,
  missingRequired,
  movePage,
  nextQuality,
  passwordProblems,
  passwordScore,
  pinAfterEdit,
  pinFromAddress,
  pinFromCapture,
  protectedFieldsChanged,
  roleOptionsFor,
  sizeVerdict,
  slotActions,
  slotState,
  timeToMinutes,
  todayInZone,
  validateAddress,
  validateAway,
  validateBankForm,
  validateException,
  validateRegistration,
  validateTaxForm,
  validateWorkingHours,
  validateAccount,
  validateBusiness,
  emptyBankForm,
  type CompanyAddressView,
  type CompanyDocumentView,
  type KycChangeRequest,
  type TeamMemberView,
  type WorkingHourView,
} from "../index";

const GSTIN = "27AAPFU0939F1ZV";

const doc = (patch: Partial<CompanyDocumentView> = {}): CompanyDocumentView => ({
  id: "d1",
  mediaAssetId: "m1",
  documentType: "PAN_CARD",
  label: null,
  documentNumber: null,
  fileName: "pan.pdf",
  fileUrl: null,
  mimeType: "application/pdf",
  sizeBytes: 1000,
  uploadedByUserId: "u1",
  uploadedByName: null,
  uploadedAt: "2026-10-01T00:00:00Z",
  verificationState: "PENDING",
  verifiedAt: null,
  rejectionReason: null,
  expiresOn: null,
  isExpired: false,
  version: 1,
  isActive: true,
  ...patch,
});

const request = (patch: Partial<KycChangeRequest> = {}): KycChangeRequest => ({
  id: "r1",
  documentType: "PAN_CARD",
  reason: "wrong file",
  status: "PENDING",
  decisionNote: null,
  ticketId: null,
  createdAt: "2026-10-02T00:00:00Z",
  ...patch,
});

describe("GSTIN autofill and cross-checks", () => {
  it("fills the state and, when empty, the PAN from a valid GSTIN", () => {
    expect(gstinAutofill(GSTIN, "")).toEqual({ stateCode: "27", stateName: "Maharashtra", pan: "AAPFU0939F" });
  });
  it("leaves an existing PAN alone", () => {
    expect(gstinAutofill(GSTIN, "ABCPE1234F")).toEqual({ stateCode: "27", stateName: "Maharashtra" });
  });
  it("does nothing for a half-typed or invalid GSTIN", () => {
    expect(gstinAutofill("27AAPFU0939", "")).toBeNull();
    expect(gstinAutofill("27AAPFU0939F1ZX", "")).toBeNull();
  });
  it("requires the PAN to equal the GSTIN's PAN and the state code its prefix", () => {
    const base = {
      gstin: GSTIN,
      pan: "ABCPE1234F",
      stateCode: "29",
      taxIdentificationNumber: "",
      taxResidencyCountryCode: "IN",
      exemptionReason: "",
      isTaxExempt: false,
      exportsUnderLut: false,
      lutNumber: "",
      exemptionCertNumber: "",
    };
    const errors = validateTaxForm(base);
    expect(errors.pan).toMatch(/match/);
    expect(errors.stateCode).toMatch(/first two digits/);
    expect(validateTaxForm({ ...base, pan: "AAPFU0939F", stateCode: "27" })).toEqual({});
  });
  it("checks the residency country and the foreign tax id", () => {
    const errors = validateTaxForm({
      gstin: "",
      pan: "",
      stateCode: "",
      taxIdentificationNumber: "!",
      taxResidencyCountryCode: "India",
      exemptionReason: "",
      isTaxExempt: false,
      exportsUnderLut: false,
      lutNumber: "",
      exemptionCertNumber: "",
    });
    expect(errors.taxResidencyCountryCode).toBeDefined();
    expect(errors.taxIdentificationNumber).toBeDefined();
  });
});

describe("protected GST fields", () => {
  it("flags protected fields only when the GST state is verified", () => {
    expect(protectedFieldsChanged("VERIFIED", { gstin: "x", legalName: "y" })).toEqual(["gstin", "legalName"]);
    expect(protectedFieldsChanged("PENDING", { gstin: "x" })).toEqual([]);
    expect(protectedFieldsChanged("VERIFIED", { isTaxExempt: true })).toEqual([]);
  });
  it("reads the server's field list", () => {
    expect(fieldsFromConfirmationError(["gstin", "pan"])).toEqual(["gstin", "pan"]);
    expect(fieldsFromConfirmationError({ fields: ["stateCode"] })).toEqual(["stateCode"]);
    expect(fieldsFromConfirmationError(null)).toEqual([]);
  });
});

describe("GST ownership card state machine", () => {
  const challenge = (patch = {}) => ({
    status: "PENDING" as const,
    emailVerified: false,
    mobileVerified: false,
    failureCode: null,
    failureMessage: null,
    ...patch,
  });
  const base = { hasGstin: true, taxState: "PENDING" as const, hasUnsavedEdits: false, otpAvailable: true, challenge: null };
  it("is hidden without a GSTIN or with unsaved edits", () => {
    expect(gstOwnershipView({ ...base, hasGstin: false }).kind).toBe("hidden");
    expect(gstOwnershipView({ ...base, hasUnsavedEdits: true }).kind).toBe("hidden");
  });
  it("offers only the manual path when OTP is not available", () => {
    expect(gstOwnershipView({ ...base, otpAvailable: false })).toEqual({ kind: "manual", reason: "otpUnavailable" });
  });
  it("starts, tracks partial confirms and finishes", () => {
    expect(gstOwnershipView(base).kind).toBe("start");
    expect(gstOwnershipView({ ...base, challenge: challenge({ emailVerified: true }) })).toEqual({
      kind: "codes",
      emailDone: true,
      mobileDone: false,
    });
    expect(gstOwnershipView({ ...base, challenge: challenge({ status: "VERIFIED" }) }).kind).toBe("verified");
    expect(gstOwnershipView({ ...base, taxState: "VERIFIED" }).kind).toBe("verified");
  });
  it("handles expiry, failure and a switch to manual", () => {
    expect(gstOwnershipView({ ...base, challenge: challenge({ status: "EXPIRED" }) }).kind).toBe("expired");
    expect(
      gstOwnershipView({ ...base, challenge: challenge({ status: "FAILED", failureMessage: "Too many attempts" }) }),
    ).toEqual({ kind: "failed", message: "Too many attempts" });
    expect(
      gstOwnershipView({ ...base, challenge: challenge({ status: "FAILED", failureCode: "GST_CONTACT_UNSUPPORTED" }) }),
    ).toEqual({ kind: "manual", reason: "contactUnavailable" });
  });
});

describe("document slots", () => {
  it("counts a document unless it was rejected", () => {
    expect(missingRequired([])).toEqual(["GST_CERTIFICATE", "PAN_CARD", "AADHAAR_CARD"]);
    const docs = [
      doc({ documentType: "GST_CERTIFICATE" }),
      doc({ id: "d2", documentType: "PAN_CARD", verificationState: "REJECTED" }),
      doc({ id: "d3", documentType: "AADHAAR_CARD", verificationState: "UNDER_REVIEW" }),
    ];
    expect(missingRequired(docs)).toEqual(["PAN_CARD"]);
  });
  it("ignores archived documents", () => {
    expect(missingRequired([doc({ isActive: false })])).toContain("PAN_CARD");
  });
  it("maps each state", () => {
    expect(slotState(null, null)).toBe("missing");
    expect(slotState(doc(), null)).toBe("uploaded");
    expect(slotState(doc({ verificationState: "SUBMITTED" }), null)).toBe("underReview");
    expect(slotState(doc({ verificationState: "REJECTED" }), null)).toBe("rejected");
    expect(slotState(doc({ isExpired: true }), null)).toBe("expired");
    expect(slotState(doc({ verificationState: "VERIFIED" }), null)).toBe("verified");
    expect(slotState(doc({ verificationState: "VERIFIED" }), request())).toBe("changeRequested");
    expect(slotState(doc({ verificationState: "VERIFIED" }), request({ status: "APPROVED" }))).toBe("changeApproved");
  });
  it("locks a verified document until a change is approved", () => {
    const verified = doc({ verificationState: "VERIFIED" });
    expect(slotActions("verified", verified)).toEqual({ canUpload: false, canRemove: false, canRequestChange: true });
    expect(slotActions("changeRequested", verified).canRequestChange).toBe(false);
    expect(slotActions("changeApproved", verified)).toEqual({ canUpload: true, canRemove: false, canRequestChange: false });
    expect(slotActions("uploaded", doc())).toEqual({ canUpload: true, canRemove: true, canRequestChange: false });
  });
  it("maps the upload errors", () => {
    const err = (code: string, status = 400) => new ApiError(status, { code, message: "x" });
    expect(documentErrorKind(err("DOCUMENT_VERIFIED_LOCKED"))).toBe("locked");
    expect(documentErrorKind(err("MEDIA_NOT_CLEAN"))).toBe("notClean");
    expect(documentErrorKind(err("FEATURE_LIMIT_REACHED", 403))).toBe("storageFull");
    expect(documentErrorKind(err("X", 413))).toBe("tooLarge");
    expect(documentErrorKind(err("X", 415))).toBe("unsupported");
    expect(documentErrorKind(new Error("x"))).toBe("other");
  });
});

describe("upload retry reuses the media id", () => {
  it("does not upload twice when the attach fails once", async () => {
    let uploads = 0;
    let attaches = 0;
    const flow = new DocumentUploadFlow<string>({
      upload: async () => {
        uploads += 1;
        return { id: "media-1", originalFilename: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 };
      },
      attach: async (id) => {
        attaches += 1;
        if (attaches === 1) throw new Error("boom");
        expect(id).toBe("media-1");
        return doc();
      },
    });
    await expect(flow.run("file")).rejects.toThrow("boom");
    expect(flow.uploadedMediaId).toBe("media-1");
    await flow.run("file");
    expect(uploads).toBe(1);
    expect(attaches).toBe(2);
    expect(flow.uploadedMediaId).toBeNull();
  });
});

describe("capture limits", () => {
  it("walks the quality ladder down and stops", () => {
    expect(nextQuality(0.7)).toBe(0.55);
    expect(nextQuality(0.55)).toBe(0.4);
    expect(nextQuality(0.3)).toBeNull();
  });
  it("decides on size", () => {
    expect(sizeVerdict(1_000_000, true)).toBe("ok");
    expect(sizeVerdict(6 * 1024 * 1024, true)).toBe("retryLower");
    expect(sizeVerdict(6 * 1024 * 1024, false)).toBe("ok");
    expect(sizeVerdict(30 * 1024 * 1024, false)).toBe("tooLarge");
  });
  it("reorders pages", () => {
    expect(movePage(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(movePage(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("changed-fields diff and stale merge", () => {
  it("sends only what changed and turns blank text into null", () => {
    const original: Record<string, unknown> = { displayName: "Acme", website: "https://a.com", phone: null };
    expect(changedFields(original, { displayName: "Acme ", website: "", phone: "" })).toEqual({ website: null });
    expect(changedFields(original, { displayName: "Acme 2" })).toEqual({ displayName: "Acme 2" });
  });
  it("compares arrays by value", () => {
    expect(changedFields({ list: ["a"] }, { list: ["a"] })).toEqual({});
    expect(changedFields({ list: ["a"] }, { list: ["a", "b"] })).toEqual({ list: ["a", "b"] });
  });
  it("re-applies the user's edits over the server copy", () => {
    expect(mergeStale({ a: 1, b: 2, version: 5 }, { b: 9 })).toEqual({ a: 1, b: 9, version: 5 });
  });
  it("recognises a stale version", () => {
    expect(isStaleVersion(new ApiError(409, { code: "STALE_RESOURCE_VERSION", message: "x" }))).toBe(true);
    expect(isStaleVersion(new ApiError(400, { code: "OTHER", message: "x" }))).toBe(false);
  });
});

describe("address pin rules", () => {
  const saved: CompanyAddressView = {
    id: "a1",
    purpose: "PICKUP",
    label: null,
    contactName: "Asha",
    phone: "9876543210",
    line1: "12 Park Street",
    line2: null,
    city: "Pune",
    state: "Maharashtra",
    stateCode: "27",
    zip: "411001",
    countryCode: "IN",
    latitude: 18.52,
    longitude: 73.85,
    locationSource: "MAP_PIN",
    isDefault: false,
    isActive: true,
    version: 3,
  };
  it("drops a saved pin when the address text changes", () => {
    const pin = pinFromAddress(saved);
    expect(pinAfterEdit(pin, "line1").latitude).toBeNull();
    expect(pinAfterEdit(pin, "zip").latitude).toBeNull();
    expect(pinAfterEdit(pin, "contactName").latitude).toBe(18.52);
  });
  it("keeps a pin set in this session when the text is corrected", () => {
    const pin = pinFromCapture(18.5204303, 73.8567437, "GPS");
    expect(pinAfterEdit(pin, "line1")).toBe(pin);
    expect(pinAfterEdit(pin, "city")).toBe(pin);
  });
  it("sends locationSource only for a pin set now", () => {
    const form = { ...emptyAddressForm("PICKUP"), contactName: "Asha", phone: "9876543210", line1: "12 Park Street", city: "Pune", state: "Maharashtra", zip: "411001" };
    expect(addressPayload(form, pinFromCapture(18.5, 73.8, "MAP_PIN"))).toMatchObject({ locationSource: "MAP_PIN", latitude: 18.5, longitude: 73.8 });
    const kept = addressPayload(form, pinFromAddress(saved), 3);
    expect(kept.locationSource).toBeUndefined();
    expect(kept.latitude).toBe(18.52);
    expect(kept.version).toBe(3);
  });
  it("clears the pin on edit when it was dropped", () => {
    const form = { ...emptyAddressForm("OPERATING") };
    const body = addressPayload(form, { latitude: null, longitude: null, source: null, setNow: false }, 2);
    expect(body.latitude).toBeNull();
    expect(body.longitude).toBeNull();
  });
  it("warns about a pickup-type address with no pin", () => {
    const none = { latitude: null, longitude: null, source: null, setNow: false };
    expect(missingPinWarning("PICKUP", none)).toBe(true);
    expect(missingPinWarning("WAREHOUSE", none)).toBe(true);
    expect(missingPinWarning("REGISTERED", none)).toBe(true);
    expect(missingPinWarning("BILLING", none)).toBe(false);
    expect(missingPinWarning("PICKUP", pinFromCapture(18.5, 73.8, "GPS"))).toBe(false);
  });
  it("validates the form", () => {
    const errors = validateAddress({ ...emptyAddressForm(), phone: "123", zip: "1" });
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(["contactName", "phone", "line1", "city", "state", "zip"]));
  });
});

describe("bank rules", () => {
  it("never verifies an unconfirmed or half-typed number", () => {
    expect(confirmedAccount("123456789", "")).toBe("");
    expect(confirmedAccount("123456789", "123456788")).toBe("");
    expect(confirmedAccount("123456789", "123456789")).toBe("123456789");
  });
  it("validates the add form", () => {
    const errors = validateBankForm({ ...emptyBankForm(), holderName: "A", accountNumber: "12", confirmAccountNumber: "13", ifsc: "BAD" });
    expect(Object.keys(errors).sort()).toEqual(["accountNumber", "confirmAccountNumber", "holderName", "ifsc"]);
    expect(
      validateBankForm({ ...emptyBankForm(), holderName: "Asha Traders", accountNumber: "123456789012", confirmAccountNumber: "123456789012", ifsc: "HDFC0001234" }),
    ).toEqual({});
  });
  it("offers the right actions per card", () => {
    const account = {
      isPrimary: false,
      settlementEnabled: true,
      automaticPayoutsAvailable: true,
      automaticPayoutLinked: false,
      status: "VERIFIED",
    } as never;
    expect(bankActions(account)).toMatchObject({ makePrimary: true, linkPayouts: true, settlementPending: false });
    expect(bankActions({ ...(account as object), settlementEnabled: false, status: "PENDING_VERIFICATION" } as never)).toMatchObject({
      makePrimary: false,
      linkPayouts: false,
      settlementPending: true,
    });
  });
});

describe("team permissions", () => {
  const member = (patch: Partial<TeamMemberView>): TeamMemberView => ({
    membershipId: "m",
    userId: "u",
    fullName: "N",
    email: "n@x.com",
    phone: null,
    status: "ACTIVE",
    companyRoles: ["VIEWER"],
    isOwner: false,
    isCurrentUser: false,
    joinedAt: null,
    lastLoginAt: null,
    ...patch,
  });
  const owner = member({ membershipId: "o", isOwner: true, isCurrentUser: true, companyRoles: ["OWNER"] });
  const admin = member({ membershipId: "a", isCurrentUser: true, companyRoles: ["ADMIN"] });
  const otherAdmin = member({ membershipId: "a2", companyRoles: ["ADMIN"] });
  const viewer = member({ membershipId: "v" });
  const sales = member({ membershipId: "s", isCurrentUser: true, companyRoles: ["SALES_MANAGER"] });

  it("lets the owner and admins manage", () => {
    expect(canManage(owner)).toBe(true);
    expect(canManage(admin)).toBe(true);
    expect(canManage(sales)).toBe(false);
    expect(canManage(null)).toBe(false);
  });
  it("applies canActOn", () => {
    expect(canActOn(owner, viewer)).toBe(true);
    expect(canActOn(owner, otherAdmin)).toBe(true);
    expect(canActOn(admin, otherAdmin)).toBe(false);
    expect(canActOn(admin, viewer)).toBe(true);
    expect(canActOn(admin, owner)).toBe(false);
    expect(canActOn(owner, owner)).toBe(false);
    expect(canActOn(sales, viewer)).toBe(false);
  });
  it("offers Admin and ownership transfer only to the owner", () => {
    expect(roleOptionsFor(owner)).toContain("ADMIN");
    expect(roleOptionsFor(admin)).not.toContain("ADMIN");
    expect(roleOptionsFor(owner)).toHaveLength(9);
    expect(memberActions(owner, viewer).transfer).toBe(true);
    expect(memberActions(admin, viewer).transfer).toBe(false);
    expect(memberActions(owner, member({ status: "SUSPENDED" })).transfer).toBe(false);
  });
  it("offers enable for a disabled member and disable for an active one", () => {
    expect(memberActions(owner, viewer)).toMatchObject({ disable: true, enable: false, remove: true });
    expect(memberActions(owner, member({ status: "SUSPENDED" }))).toMatchObject({ disable: false, enable: true });
  });
  it("finds the signed-in member and builds the invite link", () => {
    expect(currentMember([viewer, owner])).toBe(owner);
    expect(buildInviteLink("https://seller.example.com/", "a b")).toBe("https://seller.example.com/seller/invitations/accept?token=a%20b");
  });
});

describe("calendar", () => {
  it("converts minutes and times", () => {
    expect(minutesToTime(570)).toBe("09:30");
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(timeToMinutes("25:00")).toBeNull();
    expect(timeToMinutes("9:75")).toBeNull();
  });
  it("requires closing after opening on open days", () => {
    const hours: WorkingHourView[] = [
      { dayOfWeek: 1, isClosed: false, opensAtMinutes: 600, closesAtMinutes: 600 },
      { dayOfWeek: 2, isClosed: true, opensAtMinutes: 900, closesAtMinutes: 100 },
      { dayOfWeek: 3, isClosed: false, opensAtMinutes: 540, closesAtMinutes: 1080 },
    ];
    expect(Object.keys(validateWorkingHours(hours))).toEqual(["1"]);
  });
  it("takes today in the seller's zone, not the phone's", () => {
    // 20:00 UTC on 1 Jan is already 2 Jan in India (UTC+5:30) and still 1 Jan in New York.
    const now = new Date("2026-01-01T20:00:00Z");
    expect(todayInZone("Asia/Kolkata", now)).toBe("2026-01-02");
    expect(todayInZone("America/New_York", now)).toBe("2026-01-01");
    expect(awayMinDate("Asia/Kolkata", now)).toBe("2026-01-02");
  });
  it("rejects an away date before today in that zone", () => {
    const now = new Date("2026-01-01T20:00:00Z");
    expect(validateAway("2026-01-01", "", "Asia/Kolkata", now).until).toBeDefined();
    expect(validateAway("2026-01-02", "", "Asia/Kolkata", now)).toEqual({});
    expect(validateAway("nope", "", "Asia/Kolkata", now).until).toBeDefined();
  });
  it("validates exception ranges and hours", () => {
    const base = { ...emptyExceptionForm("2026-03-10"), label: "Holi" };
    expect(validateException(base)).toEqual({});
    expect(validateException({ ...base, endDate: "2026-03-09" }).endDate).toBeDefined();
    expect(validateException({ ...base, opensAt: "10:00" }).closesAt).toBeDefined();
    expect(validateException({ ...base, opensAt: "10:00", closesAt: "09:00" }).closesAt).toBeDefined();
    expect(exceptionPayload({ ...base, opensAt: "09:00", closesAt: "13:00" })).toMatchObject({ opensAtMinutes: 540, closesAtMinutes: 780 });
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("new password", () => {
  it("needs 8+ characters with lowercase, uppercase and a digit", () => {
    expect(passwordProblems("abc")).toEqual(expect.arrayContaining(["length", "uppercase", "digit"]));
    expect(passwordProblems("abcdefgh1")).toEqual(["uppercase"]);
    expect(isAcceptableNewPassword("Abcdefg1")).toBe(true);
    expect(isAcceptableNewPassword("x".repeat(129))).toBe(false);
  });
  it("scores strength", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abc")).toBe(1);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdefg1!xyz")).toBe(4);
  });
});

describe("profile forms", () => {
  it("validates the account form", () => {
    const form = {
      displayName: "",
      primaryContactName: "",
      businessEmail: "nope",
      businessPhone: "12",
      website: "example.com",
      preferredLanguage: "en",
      preferredContactMethod: "EMAIL",
      timezone: "Asia/Kolkata",
      businessDescription: "",
    };
    const errors = validateAccount(form);
    expect(Object.keys(errors).sort()).toEqual(["businessEmail", "businessPhone", "displayName", "website"]);
  });
  it("validates the business year against the current year", () => {
    const form = {
      legalName: "Acme",
      displayName: "",
      businessType: "",
      ownershipType: "",
      yearEstablished: "1700",
      industry: "",
      primaryCategoryCode: "",
      employeesBucket: "",
      turnoverBucket: "",
      factorySize: "",
      description: "",
      secondaryCategoryCodes: [],
      certificates: [],
      exportCountryCodes: [],
    };
    expect(validateBusiness(form).yearEstablished).toBeDefined();
    expect(validateBusiness({ ...form, yearEstablished: "2010" })).toEqual({});
  });
  it("validates registration numbers per type", () => {
    expect(validateRegistration({ type: "FSSAI", number: "123", issuedOn: "", expiresOn: "" }).number).toBeDefined();
    expect(validateRegistration({ type: "FSSAI", number: "12345678901234", issuedOn: "", expiresOn: "" })).toEqual({});
    expect(
      validateRegistration({ type: "FSSAI", number: "12345678901234", issuedOn: "2026-05-01", expiresOn: "2026-01-01" }).expiresOn,
    ).toBeDefined();
  });
});
