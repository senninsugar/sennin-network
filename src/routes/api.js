import express from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireUser } from "../middleware/auth.js";
import { apiRateLimit } from "../middleware/security.js";
import { projectSchema, publishSchema, validatePaths, enforceSourceSize, scanPublishedSource } from "../lib/validation.js";

const router = express.Router();
router.use(apiRateLimit);

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sennin-network-os" });
});

router.get("/apps", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,author_name,owner_id,downloads,rating,rating_count,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to load apps." });
  res.json({ apps: data || [] });
});

router.get("/apps/:slug", async (req, res) => {
  const { data: app, error } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,author_name,owner_id,downloads,rating,rating_count,created_at")
    .eq("slug", req.params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !app) return res.status(404).json({ error: "App not found." });

  const { data: files, error: filesError } = await supabaseAdmin
    .from("app_files")
    .select("path,content")
    .eq("app_id", app.id)
    .eq("version", app.version)
    .order("path");

  if (filesError) return res.status(500).json({ error: "Failed to load app." });

  const { data: reviews } = await supabaseAdmin
    .from("app_reviews")
    .select("id,rating,comment,created_at,user_id")
    .eq("app_id", app.id)
    .order("created_at", { ascending: false })
    .limit(50);

  await supabaseAdmin.from("apps").update({ downloads: (app.downloads || 0) + 1 }).eq("id", app.id);

  res.json({ app, files: files || [], reviews: reviews || [] });
});

router.get("/sellers/:id", async (req, res) => {
  const { data: seller, error } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name,avatar_url,bio,website,created_at")
    .eq("id", req.params.id)
    .maybeSingle();

  if (error || !seller) return res.status(404).json({ error: "Seller not found." });

  const { data: apps } = await supabaseAdmin
    .from("apps")
    .select("id,slug,name,description,icon,version,downloads,rating,rating_count,created_at")
    .eq("owner_id", seller.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  res.json({ seller, apps: apps || [] });
});

router.get("/me/projects", requireUser, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,updated_at,created_at")
    .eq("owner_id", req.user.id)
    .order("updated_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Failed to load projects." });
  res.json({ projects: data || [] });
});

router.get("/me/projects/:id", requireUser, async (req, res) => {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,updated_at,created_at")
    .eq("id", req.params.id)
    .eq("owner_id", req.user.id)
    .maybeSingle();

  if (error || !project) return res.status(404).json({ error: "Project not found." });

  const { data: files, error: fileError } = await supabaseAdmin
    .from("project_files")
    .select("path,content")
    .eq("project_id", project.id)
    .order("path");

  if (fileError) return res.status(500).json({ error: "Failed to load files." });
  res.json({ project, files: files || [] });
});

router.post("/me/projects", requireUser, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid project data.", details: parsed.error.flatten() });

  try {
    validatePaths(parsed.data.files);
    enforceSourceSize(parsed.data.files);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const { name, description, icon, files } = parsed.data;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .insert({ owner_id: req.user.id, name, description, icon })
    .select("id,name,description,icon,updated_at,created_at")
    .single();

  if (error) return res.status(500).json({ error: "Failed to create project." });

  const rows = files.map(file => ({ project_id: project.id, path: file.path, content: file.content }));
  const { error: filesError } = await supabaseAdmin.from("project_files").insert(rows);

  if (filesError) {
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    return res.status(500).json({ error: "Failed to save project files." });
  }

  res.status(201).json({ project });
});

router.put("/me/projects/:id", requireUser, async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid project data." });

  try {
    validatePaths(parsed.data.files);
    enforceSourceSize(parsed.data.files);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const { name, description, icon, files } = parsed.data;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .update({ name, description, icon, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("owner_id", req.user.id)
    .select("id,name,description,icon,updated_at,created_at")
    .maybeSingle();

  if (error || !project) return res.status(404).json({ error: "Project not found." });

  await supabaseAdmin.from("project_files").delete().eq("project_id", project.id);
  const rows = files.map(file => ({ project_id: project.id, path: file.path, content: file.content }));
  const { error: fileError } = await supabaseAdmin.from("project_files").insert(rows);

  if (fileError) return res.status(500).json({ error: "Failed to save files." });
  res.json({ project });
});

router.post("/me/publish", requireUser, async (req, res) => {
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid publish data." });

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id,name,description,icon,owner_id")
    .eq("id", parsed.data.projectId)
    .eq("owner_id", req.user.id)
    .maybeSingle();

  if (!project) return res.status(404).json({ error: "Project not found." });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", req.user.id)
    .maybeSingle();

  const { data: files } = await supabaseAdmin
    .from("project_files")
    .select("path,content")
    .eq("project_id", project.id);

  if (!files?.length) return res.status(400).json({ error: "Project has no files." });

  try {
    validatePaths(files);
    enforceSourceSize(files);
    scanPublishedSource(files);
  } catch (error) {
    return res.status(400).json({ error: `公開を拒否しました: ${error.message}` });
  }

  const slugBase = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "app";
  const slug = `${slugBase}-${project.id.slice(0, 8)}`;

  const { data: existing } = await supabaseAdmin.from("apps").select("id,version").eq("project_id", project.id).maybeSingle();
  const version = existing ? (existing.version || 0) + 1 : 1;

  let app;
  if (existing) {
    const result = await supabaseAdmin.from("apps").update({
      name: project.name,
      description: parsed.data.storeDescription || project.description,
      icon: project.icon,
      version,
      author_name: profile?.display_name || "Sennin Developer",
      status: "published",
      updated_at: new Date().toISOString()
    }).eq("id", existing.id).select("*").single();
    app = result.data;
    if (result.error) return res.status(500).json({ error: "Failed to publish app." });
    await supabaseAdmin.from("app_files").delete().eq("app_id", app.id);
  } else {
    const result = await supabaseAdmin.from("apps").insert({
      project_id: project.id,
      owner_id: req.user.id,
      slug,
      name: project.name,
      description: parsed.data.storeDescription || project.description,
      icon: project.icon,
      version,
      author_name: profile?.display_name || "Sennin Developer",
      status: "published"
    }).select("*").single();
    app = result.data;
    if (result.error) return res.status(500).json({ error: "Failed to publish app." });
  }

  const appRows = files.map(file => ({ app_id: app.id, version, path: file.path, content: file.content }));
  const { error: appFileError } = await supabaseAdmin.from("app_files").insert(appRows);
  if (appFileError) return res.status(500).json({ error: "Failed to publish app files." });

  res.status(201).json({ app });
});

router.post("/apps/:id/reviews", requireUser, async (req, res) => {
  const rating = Number(req.body.rating);
  const comment = String(req.body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
    return res.status(400).json({ error: "Rating must be 1-5 and comment must be at most 1000 characters." });
  }

  const { data: target } = await supabaseAdmin.from("apps").select("id,status").eq("id", req.params.id).maybeSingle();
  if (!target || target.status !== "published") return res.status(404).json({ error: "App not found." });

  const { error } = await supabaseAdmin.from("app_reviews").upsert({
    app_id: target.id,
    user_id: req.user.id,
    rating,
    comment
  }, { onConflict: "app_id,user_id" });

  if (error) return res.status(500).json({ error: "Failed to save review." });

  const { data: aggregate } = await supabaseAdmin
    .from("app_reviews")
    .select("rating")
    .eq("app_id", target.id);

  const rows = aggregate || [];
  const avg = rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : 0;

  await supabaseAdmin.from("apps").update({
    rating: Number(avg.toFixed(2)),
    rating_count: rows.length
  }).eq("id", target.id);

  res.status(201).json({ ok: true });
});

router.post("/apps/:id/install-consent", requireUser, async (req, res) => {
  if (req.body?.accepted !== true) return res.status(400).json({ error: "Installation requires explicit consent." });

  const { data: target } = await supabaseAdmin.from("apps").select("id,status").eq("id", req.params.id).maybeSingle();
  if (!target || target.status !== "published") return res.status(404).json({ error: "App not found." });

  const { error } = await supabaseAdmin.from("app_install_consents").upsert({
    app_id: target.id,
    user_id: req.user.id,
    accepted_at: new Date().toISOString(),
    consent_version: 1
  }, { onConflict: "app_id,user_id" });

  if (error) return res.status(500).json({ error: "Failed to record consent." });
  res.status(201).json({ ok: true });
});

router.delete("/me/projects/:id", requireUser, async (req, res) => {
  const { error } = await supabaseAdmin.from("projects").delete().eq("id", req.params.id).eq("owner_id", req.user.id);
  if (error) return res.status(500).json({ error: "Failed to delete project." });
  res.status(204).end();
});

router.put("/me/profile", requireUser, async (req, res) => {
  const display_name = String(req.body.display_name || "").trim();
  const bio = String(req.body.bio || "").trim();
  const website = String(req.body.website || "").trim();

  if (display_name.length < 1 || display_name.length > 80 || bio.length > 500 || website.length > 300) {
    return res.status(400).json({ error: "Invalid profile data." });
  }

  const { error } = await supabaseAdmin.from("profiles").upsert({
    id: req.user.id,
    display_name,
    bio,
    website,
    updated_at: new Date().toISOString()
  });

  if (error) return res.status(500).json({ error: "Failed to update profile." });
  res.json({ ok: true });
});

export default router;
