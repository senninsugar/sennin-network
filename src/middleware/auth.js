import { getUserFromRequest } from "../lib/supabase.js";

export async function requireUser(req, res, next) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      // 無効なセッション・削除されたユーザーのクッキーを強制的にブラウザから消去
      res.clearCookie("sennin_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });

      return res.status(401).json({
        error: "ログインが必要です。"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(error);

    res.clearCookie("sennin_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });

    res.status(401).json({
      error: "認証に失敗しました。"
    });
  }
}
