const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const authRouter = require("./auth");
const appsRouter = require("./apps");

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

app.use(express.json({
  limit: "2mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "2mb"
}));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Web OS API",
    version: "1.0.0"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/apps", appsRouter);

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");

  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`Web OS server running on http://localhost:${PORT}`);
});
