const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRouter = require("./auth");
const appsRouter = require("./apps");

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({
  limit: "1mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "1mb"
}));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "sennin network"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/apps", appsRouter);

const distPath = path.join(__dirname, "../dist");

app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(distPath, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API endpoint not found"
    });
  }

  res.status(404).send("Not Found");
});

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sennin Network server running on port ${PORT}`);
});
