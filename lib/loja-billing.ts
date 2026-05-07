export type LojaBillingProfile = {
  email: string;
  billing_full_name: string;
  billing_company_name: string;
  billing_cpf_cnpj: string;
  billing_street: string;
  billing_number: string;
  billing_complement: string;
  billing_neighborhood: string;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
  billing_country: string;
  billing_phone: string;
};

const BILLING_COLUMNS: Array<{ name: keyof LojaBillingProfile; sql: string }> = [
  { name: "billing_full_name", sql: "ADD COLUMN billing_full_name VARCHAR(150) NULL" },
  { name: "billing_company_name", sql: "ADD COLUMN billing_company_name VARCHAR(150) NULL" },
  { name: "billing_cpf_cnpj", sql: "ADD COLUMN billing_cpf_cnpj VARCHAR(20) NULL" },
  { name: "billing_street", sql: "ADD COLUMN billing_street VARCHAR(255) NULL" },
  { name: "billing_number", sql: "ADD COLUMN billing_number VARCHAR(20) NULL" },
  { name: "billing_complement", sql: "ADD COLUMN billing_complement VARCHAR(100) NULL" },
  { name: "billing_neighborhood", sql: "ADD COLUMN billing_neighborhood VARCHAR(100) NULL" },
  { name: "billing_city", sql: "ADD COLUMN billing_city VARCHAR(100) NULL" },
  { name: "billing_state", sql: "ADD COLUMN billing_state VARCHAR(50) NULL" },
  { name: "billing_postal_code", sql: "ADD COLUMN billing_postal_code VARCHAR(20) NULL" },
  { name: "billing_country", sql: "ADD COLUMN billing_country VARCHAR(100) NULL DEFAULT 'Brasil'" },
  { name: "billing_phone", sql: "ADD COLUMN billing_phone VARCHAR(30) NULL" },
];

export const EMPTY_BILLING_PROFILE: LojaBillingProfile = {
  email: "",
  billing_full_name: "",
  billing_company_name: "",
  billing_cpf_cnpj: "",
  billing_street: "",
  billing_number: "",
  billing_complement: "",
  billing_neighborhood: "",
  billing_city: "",
  billing_state: "",
  billing_postal_code: "",
  billing_country: "Brasil",
  billing_phone: "",
};

function normalizeValue(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

export function normalizeBillingProfile(source: any): LojaBillingProfile {
  return {
    email: normalizeValue(source?.email),
    billing_full_name: normalizeValue(source?.billing_full_name),
    billing_company_name: normalizeValue(source?.billing_company_name),
    billing_cpf_cnpj: normalizeValue(source?.billing_cpf_cnpj),
    billing_street: normalizeValue(source?.billing_street),
    billing_number: normalizeValue(source?.billing_number),
    billing_complement: normalizeValue(source?.billing_complement),
    billing_neighborhood: normalizeValue(source?.billing_neighborhood),
    billing_city: normalizeValue(source?.billing_city),
    billing_state: normalizeValue(source?.billing_state),
    billing_postal_code: normalizeValue(source?.billing_postal_code),
    billing_country: normalizeValue(source?.billing_country, "Brasil") || "Brasil",
    billing_phone: normalizeValue(source?.billing_phone),
  };
}

export function isBillingProfileComplete(profile: LojaBillingProfile) {
  return Boolean(
    profile.email &&
      profile.billing_full_name &&
      profile.billing_cpf_cnpj &&
      profile.billing_street &&
      profile.billing_number &&
      profile.billing_neighborhood &&
      profile.billing_city &&
      profile.billing_state &&
      profile.billing_postal_code &&
      profile.billing_country &&
      profile.billing_phone,
  );
}

export function formatBillingAddress(profile: LojaBillingProfile) {
  const line1 = [profile.billing_street, profile.billing_number].filter(Boolean).join(", ");
  const line2 = [profile.billing_complement, profile.billing_neighborhood].filter(Boolean).join(", ");
  const line3 = [profile.billing_city, profile.billing_state].filter(Boolean).join(" - ");
  const line4 = [
    profile.billing_postal_code ? `CEP ${profile.billing_postal_code}` : "",
    profile.billing_country,
  ]
    .filter(Boolean)
    .join(" | ");

  return [line1, line2, line3, line4].filter(Boolean).join("\n") || "Nao informado";
}

export async function ensureBillingColumns(connection: any) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'players'
       AND COLUMN_NAME IN (${BILLING_COLUMNS.map(() => "?").join(", ")})`,
    BILLING_COLUMNS.map((column) => column.name),
  );

  const existing = new Set(
    Array.isArray(rows) ? rows.map((row: any) => String(row?.COLUMN_NAME || "").trim()) : [],
  );

  const missing = BILLING_COLUMNS.filter((column) => !existing.has(column.name));
  if (!missing.length) return;

  await connection.query(
    `ALTER TABLE players
     ${missing.map((column) => column.sql).join(",\n     ")}`,
  );
}