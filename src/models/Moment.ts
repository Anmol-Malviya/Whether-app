import mongoose, { Schema, Document } from "mongoose";

export interface IMoment extends Document {
  userId: string;
  userName: string;
  caption?: string;
  imageUrl: string;
  approximateLocation: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  incidentType?: "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal";
  createdAt: Date;
  expiresAt: Date;
  analysisStatus: "pending" | "completed" | "failed";
  analysisResult?: {
    skyCondition?: string;
    detectedObjects?: string[];
    visiblePrecipitation?: boolean;
    ocrExtractedText?: string;
    confidenceScore?: number;
    isSuspectedStaleOrOld?: boolean;
    pHash?: string;
    aiSummary?: string;
    waterDepthEstimate?: string;
  };
  verificationStatus: "unverified" | "corroborated" | "confirmed" | "stale_or_duplicate";
  clusterId?: string;
  moderationStatus: "approved" | "reported" | "hidden";
  reportsCount: number;
}

const MomentSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, default: "guest_user" },
    userName: { type: String, required: true, default: "Indori Observer" },
    caption: { type: String, maxlength: 280 },
    imageUrl: { type: String, required: true },
    approximateLocation: { type: String, required: true, default: "Indore (City Center)" },
    coordinates: {
      lat: { type: Number },
      lon: { type: Number },
    },
    incidentType: {
      type: String,
      enum: ["waterlogging", "heavy_rain", "storm", "cloudy", "normal"],
      default: "normal",
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 60 minutes TTL
    },
    analysisStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    analysisResult: {
      skyCondition: { type: String },
      detectedObjects: [{ type: String }],
      visiblePrecipitation: { type: Boolean, default: false },
      ocrExtractedText: { type: String },
      confidenceScore: { type: Number, min: 0, max: 100 },
      isSuspectedStaleOrOld: { type: Boolean, default: false },
      pHash: { type: String },
      aiSummary: { type: String },
      waterDepthEstimate: { type: String },
    },
    verificationStatus: {
      type: String,
      enum: ["unverified", "corroborated", "confirmed", "stale_or_duplicate"],
      default: "unverified",
    },
    clusterId: { type: String },
    moderationStatus: {
      type: String,
      enum: ["approved", "reported", "hidden"],
      default: "approved",
    },
    reportsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes specified in SRS Section 6.2 + spatial and verification indexes
MomentSchema.index({ expiresAt: 1, createdAt: -1 });
MomentSchema.index({ approximateLocation: 1, createdAt: -1 });
MomentSchema.index({ moderationStatus: 1, createdAt: -1 });
MomentSchema.index({ verificationStatus: 1, createdAt: -1 });
MomentSchema.index({ "coordinates.lat": 1, "coordinates.lon": 1 });

export default mongoose.models.Moment || mongoose.model<IMoment>("Moment", MomentSchema);

