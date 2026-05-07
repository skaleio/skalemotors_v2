// Servicio TOTP MFA basado en supabase.auth.mfa.
// La habilitación de TOTP a nivel proveedor ya está en supabase/config.toml:
//   [auth.mfa.totp]
//   enroll_enabled = true
//   verify_enabled = true
//
// Requiere Supabase Auth Pro (incluido en plan Pro).

import { supabase } from "@/lib/supabase";

export type MfaFactor = {
  id: string;
  friendly_name: string | null;
  factor_type: "totp";
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
};

export async function listFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []) as MfaFactor[];
}

export async function getAal(): Promise<{ currentLevel: string | null; nextLevel: string | null }> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return {
    currentLevel: data?.currentLevel ?? null,
    nextLevel: data?.nextLevel ?? null,
  };
}

export type EnrollResult = {
  factorId: string;
  qr: string; // SVG con el QR
  secret: string; // base32 secret (manual entry)
  uri: string; // otpauth://...
};

export async function enrollTotp(friendlyName: string): Promise<EnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;
  if (!data) throw new Error("MFA enroll: respuesta vacía");
  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyEnroll(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const challengeId = challenge.data?.id;
  if (!challengeId) throw new Error("MFA challenge: id ausente");
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: code.trim(),
  });
  if (verify.error) throw verify.error;
}

export async function challengeAndVerify(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });
  if (error) throw error;
}

export async function unenroll(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
