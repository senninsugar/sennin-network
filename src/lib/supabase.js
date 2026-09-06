import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

export const supabaseAdmin = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

export function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createSessionToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return {
    salt,
    hash
  };
}

export function verifyPassword(password, salt, storedHash) {
  const derived = crypto.scryptSync(password, salt, 64);

  const stored = Buffer.from(storedHash, "hex");

  if (derived.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, stored);
}

export async function getUserFromRequest(req) {
  const token = req.cookies?.sennin_session;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("id,user_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from("sessions")
      .delete()
      .eq("id", session.id);

    return null;
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id,username,created_at")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  return user;
}
