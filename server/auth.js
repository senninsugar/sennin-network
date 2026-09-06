const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("./db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing");
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const token = header.substring(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = payload;

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

router.post("/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        error: "Username must be between 3 and 30 characters"
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        error: "Username can only contain letters, numbers and underscores"
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Password must be between 8 and 128 characters"
      });
    }

    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return res.status(409).json({
        error: "Username already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        username,
        password_hash: passwordHash
      })
      .select("id, username, created_at")
      .single();

    if (error) {
      throw error;
    }

    const token = createToken(user);

    res.status(201).json({
      token,
      user
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Registration failed"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password_hash, created_at")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!user) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid username or password"
      });
    }

    const publicUser = {
      id: user.id,
      username: user.username,
      created_at: user.created_at
    };

    const token = createToken(publicUser);

    res.json({
      token,
      user: publicUser
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Login failed"
    });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, created_at")
      .eq("id", req.user.id)
      .single();

    if (error) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    res.json({
      user
    });
  } catch {
    res.status(500).json({
      error: "Failed to get account"
    });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;
