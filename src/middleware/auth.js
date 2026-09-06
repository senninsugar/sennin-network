import { getUserFromRequest } from "../lib/supabase.js";

export async function requireUser(req, res, next) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        error: "ログインが必要です。"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(error);

    res.status(401).json({
      error: "認証に失敗しました。"
    });
  }
}
