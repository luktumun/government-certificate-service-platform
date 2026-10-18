import { readFile } from "node:fs/promises";
import mongoose from "mongoose";

try {
  const envFile = await readFile(".env.local", "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Set MONGODB_URI in .env.local or your environment first.");

const services = [
  ["birth-certificate", "Birth certificate", "Personal documents", "Get help applying for a birth certificate or correcting an existing record.", ["Hospital discharge slip", "Parent identity proof", "Proof of address"], 7, 50, 299, "baby", "mint"],
  ["income-certificate", "Income certificate", "Certificates", "Apply for an income certificate for scholarships, admissions, or benefits.", ["Aadhaar card", "Salary slips or income affidavit", "Proof of address"], 5, 30, 249, "wallet", "lavender"],
  ["caste-certificate", "Caste certificate", "Certificates", "A verified local agent can guide you through your state application.", ["Aadhaar card", "Family caste proof", "Proof of address"], 10, 40, 349, "badge", "peach"],
  ["domicile-certificate", "Domicile certificate", "Certificates", "Get procedural help with your state residence certificate application.", ["Aadhaar card", "Residence proof", "School or utility records"], 7, 30, 299, "home", "blue"],
  ["pan-card", "PAN card services", "Identity services", "Help with a new PAN application, corrections, or a duplicate card.", ["Aadhaar card", "Recent photograph", "Email and mobile number"], 4, 107, 199, "credit-card", "yellow"],
  ["aadhaar-services", "Aadhaar assistance", "Identity services", "Book help understanding the right process for Aadhaar updates.", ["Aadhaar number", "Supporting document for requested update"], 3, 50, 149, "fingerprint", "rose"],
].map(([slug, name, category, description, requiredDocuments, estimatedDays, governmentFee, assistanceFee, icon, color]) => ({
  slug, name, category, description, requiredDocuments, estimatedDays, governmentFee, assistanceFee, icon, color, active: true,
}));

const serviceSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  requiredDocuments: { type: [String], default: [] },
  estimatedDays: { type: Number, required: true, min: 1 },
  governmentFee: { type: Number, required: true, min: 0 },
  assistanceFee: { type: Number, required: true, min: 0 },
  icon: String,
  color: String,
  active: { type: Boolean, default: true },
});

const Service = mongoose.models.Service ?? mongoose.model("Service", serviceSchema, "janseva_services");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
try {
  await Service.bulkWrite(services.map((service) => ({
    updateOne: { filter: { slug: service.slug }, update: { $set: service }, upsert: true },
  })));
  console.log(`Seeded ${services.length} government services.`);
} finally {
  await mongoose.disconnect();
}
