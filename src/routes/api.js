import express from "express";
import {
  supabaseAdmin,
  createSessionToken,
  hashSessionToken,
  hashPassword,
  verifyPassword
} from "../lib/supabase.js";
import { requireUser } from "../middleware/auth.js";
import { apiRateLimit } from "../middleware/security.js";
import {
  projectSchema,
  publishSchema,
  validatePaths,
  enforceSourceSize,
  scanPublishedSource
} from "../lib/validation.js";

const router = express.Router();

router.use(apiRateLimit);

const SESSION_DAYS = 30;

function sessionExpiresAt() {
  return new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

function setSessionCookie(res, token) {
  res.cookie("sennin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function usernameValid(username) {
  return /^[A-Za-z0-9_]{3,32}$/.test(username);
}

function passwordValid(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sennin-network-os"
  });
});

router.post("/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!usernameValid(username)) {
      return res.status(400).json({
        error: "ユーザー名は英数字とアンダースコアのみ、3〜32文字で入力してください。"
      });
    }

    if (!passwordValid(password)) {
      return res.status(400).json({
        error: "パスワードは8〜128文字で入力してください。"
      });
    }

    const normalized = username.toLowerCase();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username_normalized", normalized)
      .maybeSingle();

    if (existingError) {
      console.error(existingError);

      return res.status(500).json({
        error: "アカウントを確認できませんでした。"
      });
    }

    if (existing) {
      return res.status(409).json({
        error: "そのユーザー名は既に使用されています。"
      });
    }

    const passwordData = hashPassword(password);

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .insert({
        username,
        username_normalized: normalized,
        password_hash: passwordData.hash,
        password_salt: passwordData.salt
      })
      .select("id,username,created_at")
      .single();

    if (userError || !user) {
      console.error(userError);

      return res.status(500).json({
        error: "アカウントを作成できませんでした。"
      });
    }

    const { data: registeredUser, error: registeredUserError } = await supabaseAdmin
      .from("users")
      .select("id,username,created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (registeredUserError || !registeredUser) {
      console.error(registeredUserError);

      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", user.id);

      return res.status(500).json({
        error: "作成したアカウントを確認できませんでした。"
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: registeredUser.id,
        display_name: registeredUser.username,
        bio: "",
        website: ""
      });

    if (profileError) {
      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", registeredUser.id);

      console.error(profileError);

      return res.status(500).json({
        error: "プロフィールを作成できませんでした。"
      });
    }

    const token = createSessionToken();

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        user_id: registeredUser.id,
        token_hash: hashSessionToken(token),
        expires_at: sessionExpiresAt()
      });

    if (sessionError) {
      await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", registeredUser.id);

      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", registeredUser.id);

      console.error(sessionError);

      return res.status(500).json({
        error: "セッションを作成できませんでした。"
      });
    }

    setSessionCookie(res, token);

    res.status(201).json({
      user: registeredUser
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "登録処理でエラーが発生しました。"
    });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).json({
        error: "ユーザー名とパスワードを入力してください。"
      });
    }

    const normalized = username.toLowerCase();

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id,username,password_hash,password_salt,created_at")
      .eq("username_normalized", normalized)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({
        error: "ユーザー名またはパスワードが正しくありません。"
      });
    }

    const valid = verifyPassword(
      password,
      user.password_salt,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: "ユーザー名またはパスワードが正しくありません。"
      });
    }

    const token = createSessionToken();

    const { error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: sessionExpiresAt()
      });

    if (sessionError) {
      console.error(sessionError);

      return res.status(500).json({
        error: "セッションを作成できませんでした。"
      });
    }

    setSessionCookie(res, token);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "ログイン処理でエラーが発生しました。"
    });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.sennin_session;

    if (token) {
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("token_hash", hashSessionToken(token));
    }

    res.clearCookie("sennin_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });

    res.json({
      ok: true
    });
  } catch (error) {
    console.error(error);

    res.clearCookie("sennin_session");

    res.json({
      ok: true
    });
  }
});

router.get("/auth/me", requireUser, async (req, res) => {
  res.json({
    user: req.user
  });
});

router.get("/apps", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,author_name,owner_id,downloads,rating,rating_count,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "アプリを読み込めませんでした。"
    });
  }

  res.json({
    apps: data || []
  });
});

router.get("/apps/:slug", async (req, res) => {
  const { data: app, error } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,author_name,owner_id,downloads,rating,rating_count,created_at")
    .eq("slug", req.params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !app) {
    return res.status(404).json({
      error: "アプリが見つかりません。"
    });
  }

  const { data: files, error: filesError } = await supabaseAdmin
    .from("app_files")
    .select("path,content")
    .eq("app_id", app.id)
    .eq("version", app.version)
    .order("path");

  if (filesError) {
    console.error(filesError);

    return res.status(500).json({
      error: "アプリを読み込めませんでした。"
    });
  }

  const { data: reviews } = await supabaseAdmin
    .from("app_reviews")
    .select("id,rating,comment,created_at,user_id")
    .eq("app_id", app.id)
    .order("created_at", { ascending: false })
    .limit(50);

  res.json({
    app,
    files: files || [],
    reviews: reviews || []
  });
});

router.get("/sellers/:id", async (req, res) => {
  const { data: seller, error } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name,avatar_url,bio,website,created_at")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error || !seller) {
    return res.status(404).json({
      error: "出品者が見つかりません。"
    });
  }

  const { data: apps } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,downloads,rating,rating_count,created_at")
    .eq("owner_id", seller.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  res.json({
    seller,
    apps: apps || []
  });
});

router.get("/me/projects", requireUser, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,updated_at,created_at")
    .eq("owner_id", req.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "プロジェクトを読み込めませんでした。"
    });
  }

  res.json({
    projects: data || []
  });
});

router.get("/me/projects/:id", requireUser, async (req, res) => {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,updated_at,created_at")
    .eq("id", req.params.id)
    .eq("owner_id", req.user.id)
    .maybeSingle();

  if (error || !project) {
    return res.status(404).json({
      error: "プロジェクトが見つかりません。"
    });
  }

  const { data: files, error: fileError } = await supabaseAdmin
    .from("project_files")
    .select("path,content")
    .eq("project_id", project.id)
    .order("path");

  if (fileError) {
    console.error(fileError);

    return res.status(500).json({
      error: "ファイルを読み込めませんでした。"
    });
  }

  res.json({
    project,
    files: files || []
  });
});

router.post("/me/projects", requireUser, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "プロジェクトデータが不正です。"
    });
  }

  try {
    validatePaths(parsed.data.files);
    enforceSourceSize(parsed.data.files);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  const {
    name,
    description,
    icon,
    files
  } = parsed.data;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .insert({
      owner_id: req.user.id,
      name,
      description,
      icon
    })
    .select("id,name,description,icon,updated_at,created_at")
    .single();

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "プロジェクトを作成できませんでした。"
    });
  }

  const rows = files.map(file => ({
    project_id: project.id,
    path: file.path,
    content: file.content
  }));

  const { error: filesError } = await supabaseAdmin
    .from("project_files")
    .insert(rows);

  if (filesError) {
    await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", project.id);

    console.error(filesError);

    return res.status(500).json({
      error: "プロジェクトファイルを保存できませんでした。"
    });
  }

  res.status(201).json({
    project
  });
});

router.put("/me/projects/:id", requireUser, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "プロジェクトデータが不正です。"
    });
  }

  try {
    validatePaths(parsed.data.files);
    enforceSourceSize(parsed.data.files);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }

  const {
    name,
    description,
    icon,
    files
  } = parsed.data;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .update({
      name,
      description,
      icon,
      updated_at: new Date().toISOString()
    })
    .eq("id", req.params.id)
    .eq("owner_id", req.user.id)
    .select("id,name,description,icon,updated_at,created_at")
    .maybeSingle();

  if (error || !project) {
    return res.status(404).json({
      error: "プロジェクトが見つかりません。"
    });
  }

  await supabaseAdmin
    .from("project_files")
    .delete()
    .eq("project_id", project.id);

  const rows = files.map(file => ({
    project_id: project.id,
    path: file.path,
    content: file.content
  }));

  const { error: fileError } = await supabaseAdmin
    .from("project_files")
    .insert(rows);

  if (fileError) {
    console.error(fileError);

    return res.status(500).json({
      error: "ファイルを保存できませんでした。"
    });
  }

  res.json({
    project
  });
});

router.post("/me/publish", requireUser, async (req, res) => {
  const parsed = publishSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "公開データが不正です。"
    });
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,owner_id")
    .eq("id", parsed.data.projectId)
    .eq("owner_id", req.user.id)
    .maybeSingle();

  if (!project) {
    return res.status(404).json({
      error: "プロジェクトが見つかりません。"
    });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", req.user.id)
    .maybeSingle();

  const { data: files } = await supabaseAdmin
    .from("project_files")
    .select("path,content")
    .eq("project_id", project.id);

  if (!files?.length) {
    return res.status(400).json({
      error: "プロジェクトにファイルがありません。"
    });
  }

  try {
    validatePaths(files);
    enforceSourceSize(files);
    scanPublishedSource(files);
  } catch (error) {
    return res.status(400).json({
      error: `公開を拒否しました: ${error.message}`
    });
  }

  const slugBase =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "app";

  const slug = `${slugBase}-${project.id.slice(0, 8)}`;

  const { data: existing } = await supabaseAdmin
    .from("apps")
    .select("id,version")
    .eq("project_id", project.id)
    .maybeSingle();

  const version = existing
    ? (existing.version || 0) + 1
    : 1;

  let app;

  if (existing) {
    const result = await supabaseAdmin
      .from("apps")
      .update({
        name: project.name,
        description: parsed.data.storeDescription || project.description,
        icon: project.icon,
        version,
        author_name: profile?.display_name || req.user.username,
        status: "published",
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    app = result.data;

    if (result.error) {
      console.error(result.error);

      return res.status(500).json({
        error: "アプリを公開できませんでした。"
      });
    }

    await supabaseAdmin
      .from("app_files")
      .delete()
      .eq("app_id", app.id);
  } else {
    const result = await supabaseAdmin
      .from("apps")
      .insert({
        project_id: project.id,
        owner_id: req.user.id,
        slug,
        name: project.name,
        description: parsed.data.storeDescription || project.description,
        icon: project.icon,
        version,
        author_name: profile?.display_name || req.user.username,
        status: "published"
      })
      .select("*")
      .single();

    app = result.data;

    if (result.error) {
      console.error(result.error);

      return res.status(500).json({
        error: "アプリを公開できませんでした。"
      });
    }
  }

  const appRows = files.map(file => ({
    app_id: app.id,
    version,
    path: file.path,
    content: file.content
  }));

  const { error: appFileError } = await supabaseAdmin
    .from("app_files")
    .insert(appRows);

  if (appFileError) {
    console.error(appFileError);

    return res.status(500).json({
      error: "アプリファイルを公開できませんでした。"
    });
  }

  res.status(201).json({
    app
  });
});

router.post("/apps/:id/reviews", requireUser, async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || "").trim();

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    comment.length > 1000
  ) {
    return res.status(400).json({
      error: "評価は1〜5、コメントは1000文字以内です。"
    });
  }

  const { data: target } = await supabaseAdmin
    .from("apps")
    .select("id,status")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!target || target.status !== "published") {
    return res.status(404).json({
      error: "アプリが見つかりません。"
    });
  }

  const { error } = await supabaseAdmin
    .from("app_reviews")
    .upsert(
      {
        app_id: target.id,
        user_id: req.user.id,
        rating,
        comment
      },
      {
        onConflict: "app_id,user_id"
      }
    );

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "レビューを保存できませんでした。"
    });
  }

  const { data: aggregate } = await supabaseAdmin
    .from("app_reviews")
    .select("rating")
    .eq("app_id", target.id);

  const rows = aggregate || [];

  const avg = rows.length
    ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
    : 0;

  await supabaseAdmin
    .from("apps")
    .update({
      rating: Number(avg.toFixed(2)),
      rating_count: rows.length
    })
    .eq("id", target.id);

  res.status(201).json({
    ok: true
  });
});

router.post("/apps/:id/install-consent", requireUser, async (req, res) => {
  if (req.body?.accepted !== true) {
    return res.status(400).json({
      error: "インストールには明示的な同意が必要です。"
    });
  }

  const { data: target } = await supabaseAdmin
    .from("apps")
    .select("id,status")
    .eq("id", req.params.id)
    .maybeSingle();

  if (!target || target.status !== "published") {
    return res.status(404).json({
      error: "アプリが見つかりません。"
    });
  }

  const { error } = await supabaseAdmin
    .from("app_install_consents")
    .upsert(
      {
        app_id: target.id,
        user_id: req.user.id,
        accepted_at: new Date().toISOString(),
        consent_version: 1
      },
      {
        onConflict: "app_id,user_id"
      }
    );

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "同意情報を保存できませんでした。"
    });
  }

  res.status(201).json({
    ok: true
  });
});

router.delete("/me/projects/:id", requireUser, async (req, res) => {
  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", req.params.id)
    .eq("owner_id", req.user.id);

  if (error) {
    return res.status(500).json({
      error: "プロジェクトを削除できませんでした。"
    });
  }

  res.status(204).end();
});

router.get("/me/profile", requireUser, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name,avatar_url,bio,website,created_at,updated_at")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      error: "プロフィールを取得できませんでした。"
    });
  }

  res.json({
    profile: data
  });
});

router.put("/me/profile", requireUser, async (req, res) => {
  const display_name = String(req.body.display_name || "").trim();
  const bio = String(req.body.bio || "").trim();
  const website = String(req.body.website || "").trim();

  if (
    display_name.length < 1 ||
    display_name.length > 80 ||
    bio.length > 500 ||
    website.length > 300
  ) {
    return res.status(400).json({
      error: "プロフィールデータが不正です。"
    });
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: req.user.id,
      display_name,
      bio,
      website,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error(error);

    return res.status(500).json({
      error: "プロフィールを更新できませんでした。"
    });
  }

  res.json({
    ok: true
  });
});

export default router;
