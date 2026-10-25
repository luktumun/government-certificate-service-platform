import mongoose, { Schema, Types, type Model } from "mongoose";

export type UserRole = "citizen" | "agent" | "admin";
export type AgentVerification = "pending" | "verified" | "rejected";
export type RequestStatus =
  | "submitted"
  | "under_review"
  | "accepted"
  | "in_progress"
  | "documents_required"
  | "completed"
  | "rejected"
  | "cancelled";
export type ComplaintStatus = "open" | "investigating" | "escalated" | "resolved" | "closed";

interface UserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  verificationStatus?: AgentVerification;
  serviceAreas: string[];
}

interface ServiceRecord {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  category: string;
  description: string;
  requiredDocuments: string[];
  estimatedDays: number;
  governmentFee: number;
  assistanceFee: number;
  icon: string;
  color: string;
  active: boolean;
}

interface UploadedDocumentRecord {
  _id: Types.ObjectId;
  originalName: string;
  documentType?: string;
  storageKey: string;
  mimeType: string;
  size: number;
}

interface UploadedFileRecord {
  _id: Types.ObjectId;
  storageKey: string;
  content: Buffer;
}

interface TimelineEntryRecord {
  _id: Types.ObjectId;
  status: RequestStatus;
  note: string;
  updatedBy?: Types.ObjectId;
}

export interface ServiceRequestRecord {
  _id: Types.ObjectId;
  reference: string;
  citizen?: Types.ObjectId;
  service: Types.ObjectId;
  serviceName: string;
  applicantName: string;
  contactPhone: string;
  location: string;
  notes?: string;
  status: RequestStatus;
  assignedAgent?: Types.ObjectId | null;
  quotedTotal: number;
  governmentFee: number;
  assistanceFee: number;
  documents: Types.DocumentArray<UploadedDocumentRecord>;
  timeline: Types.DocumentArray<TimelineEntryRecord>;
}

interface ComplaintRecord {
  _id: Types.ObjectId;
  reference: string;
  citizen: Types.ObjectId;
  serviceRequest: Types.ObjectId;
  subject: string;
  description: string;
  status: ComplaintStatus;
  resolutionNote?: string;
}

const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 24 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["citizen", "agent", "admin"], default: "citizen" },
    verificationStatus: { type: String, enum: ["pending", "verified", "rejected"] },
    serviceAreas: { type: [String], default: [] },
  },
  { timestamps: true },
);

const serviceSchema = new Schema<ServiceRecord>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 1000 },
    requiredDocuments: { type: [String], default: [] },
    estimatedDays: { type: Number, required: true, min: 1 },
    governmentFee: { type: Number, required: true, min: 0 },
    assistanceFee: { type: Number, required: true, min: 0 },
    icon: { type: String, default: "file-text" },
    color: { type: String, default: "mint" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const uploadedDocumentSchema = new Schema<UploadedDocumentRecord>(
  {
    originalName: { type: String, required: true },
    documentType: { type: String, trim: true, maxlength: 100 },
    storageKey: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true },
);

const uploadedFileSchema = new Schema<UploadedFileRecord>(
  {
    storageKey: { type: String, required: true, unique: true, select: false },
    content: { type: Buffer, required: true, select: false },
  },
  { timestamps: true },
);

const timelineEntrySchema = new Schema<TimelineEntryRecord>(
  {
    status: { type: String, required: true },
    note: { type: String, required: true, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const serviceRequestSchema = new Schema<ServiceRequestRecord>(
  {
    reference: { type: String, required: true, unique: true },
    citizen: { type: Schema.Types.ObjectId, ref: "User", index: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, required: true },
    applicantName: { type: String, required: true, trim: true, maxlength: 100 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 24 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "accepted",
        "in_progress",
        "documents_required",
        "completed",
        "rejected",
        "cancelled",
      ],
      default: "submitted",
      index: true,
    },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", index: true },
    quotedTotal: { type: Number, required: true, min: 0 },
    governmentFee: { type: Number, required: true, min: 0 },
    assistanceFee: { type: Number, required: true, min: 0 },
    documents: { type: [uploadedDocumentSchema], default: [] },
    timeline: { type: [timelineEntrySchema], default: [] },
  },
  { timestamps: true },
);

const complaintSchema = new Schema<ComplaintRecord>(
  {
    reference: { type: String, required: true, unique: true },
    citizen: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceRequest: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, index: true },
    subject: {
      type: String,
      enum: ["service_issue", "delay", "document_concern", "payment", "other"],
      required: true,
    },
    description: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["open", "investigating", "escalated", "resolved", "closed"],
      default: "open",
      index: true,
    },
    resolutionNote: { type: String, maxlength: 1000 },
  },
  { timestamps: true },
);

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ??
  mongoose.model<UserRecord>("User", userSchema, "janseva_users");
export const Service =
  (mongoose.models.Service as Model<ServiceRecord> | undefined) ??
  mongoose.model<ServiceRecord>("Service", serviceSchema, "janseva_services");
export const ServiceRequest =
  (mongoose.models.ServiceRequest as Model<ServiceRequestRecord> | undefined) ??
  mongoose.model<ServiceRequestRecord>("ServiceRequest", serviceRequestSchema, "janseva_service_requests");
export const UploadedFile =
  (mongoose.models.UploadedFile as Model<UploadedFileRecord> | undefined) ??
  mongoose.model<UploadedFileRecord>("UploadedFile", uploadedFileSchema, "janseva_uploaded_files");
export const Complaint =
  (mongoose.models.Complaint as Model<ComplaintRecord> | undefined) ??
  mongoose.model<ComplaintRecord>("Complaint", complaintSchema, "janseva_complaints");
