export type ServiceInfo = {
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
};

export const serviceCatalog: ServiceInfo[] = [
  {
    slug: "birth-certificate",
    name: "Birth certificate",
    category: "Personal documents",
    description: "Get help applying for a birth certificate or correcting an existing record.",
    requiredDocuments: ["Hospital discharge slip", "Parent identity proof", "Proof of address"],
    estimatedDays: 7,
    governmentFee: 50,
    assistanceFee: 299,
    icon: "baby",
    color: "mint",
  },
  {
    slug: "income-certificate",
    name: "Income certificate",
    category: "Certificates",
    description: "Apply for an income certificate for scholarships, admissions, or benefits.",
    requiredDocuments: ["Aadhaar card", "Salary slips or income affidavit", "Proof of address"],
    estimatedDays: 5,
    governmentFee: 30,
    assistanceFee: 249,
    icon: "wallet",
    color: "lavender",
  },
  {
    slug: "caste-certificate",
    name: "Caste certificate",
    category: "Certificates",
    description: "A verified local agent can guide you through your state application.",
    requiredDocuments: ["Aadhaar card", "Family caste proof", "Proof of address"],
    estimatedDays: 10,
    governmentFee: 40,
    assistanceFee: 349,
    icon: "badge",
    color: "peach",
  },
  {
    slug: "domicile-certificate",
    name: "Domicile certificate",
    category: "Certificates",
    description: "Get procedural help with your state residence certificate application.",
    requiredDocuments: ["Aadhaar card", "Residence proof", "School or utility records"],
    estimatedDays: 7,
    governmentFee: 30,
    assistanceFee: 299,
    icon: "home",
    color: "blue",
  },
  {
    slug: "pan-card",
    name: "PAN card services",
    category: "Identity services",
    description: "Help with a new PAN application, corrections, or a duplicate card.",
    requiredDocuments: ["Aadhaar card", "Recent photograph", "Email and mobile number"],
    estimatedDays: 4,
    governmentFee: 107,
    assistanceFee: 199,
    icon: "credit-card",
    color: "yellow",
  },
  {
    slug: "aadhaar-services",
    name: "Aadhaar assistance",
    category: "Identity services",
    description: "Book help understanding the right process for Aadhaar updates.",
    requiredDocuments: ["Aadhaar number", "Supporting document for requested update"],
    estimatedDays: 3,
    governmentFee: 50,
    assistanceFee: 149,
    icon: "fingerprint",
    color: "rose",
  },
];
