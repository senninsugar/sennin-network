const express = require("express");
const crypto = require("crypto");
const supabase = require("./db");
const { authenticate } = require("./auth");

const router = express.Router();

const MAX_APP_SIZE = 500 * 1024;

function calculateSize(files) {
  return files.reduce((total, file) => {
    const content = String(file.content || "");

    return total + Buffer.byteLength(content, "utf8");
  }, 0);
}

function validateFiles(files) {
  if (!Array.isArray(files)) {
    throw new Error("Files must be an array");
  }

  if (files.length === 0) {
    throw new Error("At least one file is required");
  }

  if (files.length > 20) {
    throw new Error("Too many files");
  }

  for (const file of files) {
    if (!file.name) {
      throw new Error("File name is required");
    }

    if (typeof file.content !== "string") {
      throw new Error("File content must be a string");
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      throw new Error(`Invalid file name: ${file.name}`);
    }
  }

  const size = calculateSize(files);

  if (size > MAX_APP_SIZE) {
    throw new Error(
      `Application size exceeds 500KB (${size} bytes)`
    );
  }

  return size;
}

router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    let query = supabase
      .from("apps")
      .select(`
        id,
        name,
        description,
        icon,
        version,
        category,
        size,
        installs,
        published,
        created_at,
        updated_at
      `)
      .eq("published", true)
      .order("created_at", {
        ascending: false
      });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      apps: data || []
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load apps"
    });
  }
});

router.get("/installed", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("installations")
      .select(`
        app_id,
        installed_at,
        apps (
          id,
          name,
          description,
          icon,
          version,
          category,
          size,
          published
        )
      `)
      .eq("user_id", req.user.id)
      .order("installed_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    res.json({
      apps: data || []
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load installed apps"
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { data: app, error } = await supabase
      .from("apps")
      .select(`
        id,
        owner_id,
        name,
        description,
        icon,
        version,
        category,
        size,
        installs,
        published,
        created_at,
        updated_at,
        app_files (
          file_name,
          content
        )
      `)
      .eq("id", req.params.id)
      .single();

    if (error || !app) {
      return res.status(404).json({
        error: "App not found"
      });
    }

    if (!app.published) {
      return res.status(404).json({
        error: "App not found"
      });
    }

    res.json({
      app
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load app"
    });
  }
});

router.post("/:id/install", authenticate, async (req, res) => {
  try {
    const appId = req.params.id;

    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("id, published")
      .eq("id", appId)
      .single();

    if (appError || !app || !app.published) {
      return res.status(404).json({
        error: "App not found"
      });
    }

    const { data: existing } = await supabase
      .from("installations")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("app_id", appId)
      .maybeSingle();

    if (existing) {
      return res.json({
        installed: true
      });
    }

    const { error } = await supabase
      .from("installations")
      .insert({
        user_id: req.user.id,
        app_id: appId
      });

    if (error) {
      throw error;
    }

    await supabase
      .from("apps")
      .update({
        installs: (app.installs || 0) + 1
      })
      .eq("id", appId);

    res.json({
      installed: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Installation failed"
    });
  }
});

router.delete("/:id/install", authenticate, async (req, res) => {
  try {
    const appId = req.params.id;

    const { error } = await supabase
      .from("installations")
      .delete()
      .eq("user_id", req.user.id)
      .eq("app_id", appId);

    if (error) {
      throw error;
    }

    res.json({
      installed: false
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Uninstall failed"
    });
  }
});

router.post("/developer/create", authenticate, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    const icon = String(req.body.icon || "🧩");
    const category = String(req.body.category || "Other");
    const version = String(req.body.version || "1.0.0");
    const files = req.body.files;

    if (!name || name.length > 60) {
      return res.status(400).json({
        error: "Invalid application name"
      });
    }

    if (description.length > 500) {
      return res.status(400).json({
        error: "Description is too long"
      });
    }

    const size = validateFiles(files);

    const appId = crypto.randomUUID();

    const { error: appError } = await supabase
      .from("apps")
      .insert({
        id: appId,
        owner_id: req.user.id,
        name,
        description,
        icon,
        category,
        version,
        size,
        installs: 0,
        published: false
      });

    if (appError) {
      throw appError;
    }

    const rows = files.map(file => ({
      app_id: appId,
      file_name: file.name,
      content: file.content
    }));

    const { error: filesError } = await supabase
      .from("app_files")
      .insert(rows);

    if (filesError) {
      await supabase
        .from("apps")
        .delete()
        .eq("id", appId);

      throw filesError;
    }

    res.status(201).json({
      id: appId,
      size
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      error: error.message || "Failed to create application"
    });
  }
});

router.get("/developer/my", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("apps")
      .select(`
        id,
        name,
        description,
        icon,
        version,
        category,
        size,
        installs,
        published,
        created_at,
        updated_at
      `)
      .eq("owner_id", req.user.id)
      .order("updated_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    res.json({
      apps: data || []
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load developer apps"
    });
  }
});

router.post("/developer/:id/publish", authenticate, async (req, res) => {
  try {
    const appId = req.params.id;

    const { data: app, error } = await supabase
      .from("apps")
      .select("id, owner_id, size")
      .eq("id", appId)
      .single();

    if (error || !app) {
      return res.status(404).json({
        error: "Application not found"
      });
    }

    if (app.owner_id !== req.user.id) {
      return res.status(403).json({
        error: "You do not own this application"
      });
    }

    if (app.size > MAX_APP_SIZE) {
      return res.status(400).json({
        error: "Application exceeds 500KB"
      });
    }

    const { error: updateError } = await supabase
      .from("apps")
      .update({
        published: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", appId);

    if (updateError) {
      throw updateError;
    }

    res.json({
      published: true
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Publishing failed"
    });
  }
});

router.get("/:id/runtime", async (req, res) => {
  try {
    const { data: app, error } = await supabase
      .from("apps")
      .select(`
        id,
        published,
        app_files (
          file_name,
          content
        )
      `)
      .eq("id", req.params.id)
      .single();

    if (error || !app || !app.published) {
      return res.status(404).send("Application not found");
    }

    const htmlFile = app.app_files.find(
      file => file.file_name === "index.html"
    );

    if (!htmlFile) {
      return res.status(400).send(
        "index.html is required"
      );
    }

    let html = htmlFile.content;

    const cssFiles = app.app_files.filter(
      file => file.file_name.endsWith(".css")
    );

    const jsFiles = app.app_files.filter(
      file => file.file_name.endsWith(".js")
    );

    for (const file of cssFiles) {
      html += `<style>${file.content}</style>`;
    }

    for (const file of jsFiles) {
      html += `<script>${file.content}<\/script>`;
    }

    res.type("html").send(html);
  } catch (error) {
    console.error(error);

    res.status(500).send(
      "Failed to start application"
    );
  }
});

module.exports = router;
