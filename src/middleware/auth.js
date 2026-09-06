import { getUserFromRequest } from "../lib/supabase.js";

export async function requireUser(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Authentication required." });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed." });
  }
}
