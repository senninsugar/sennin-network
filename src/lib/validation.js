import { z } from "zod";

const MAX_SOURCE_BYTES = Number(process.env.MAX_SOURCE_BYTES || 200000);
const MAX_FILE_BYTES = Number(process.env.MAX_PROJECT_FILE_BYTES || 100000);

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
  icon: z.string().trim().max(500).default("◈"),
  files: z.array(z.object({
    path: z.string().trim().min(1).max(180),
    content: z.string().max(MAX_FILE_BYTES)
  })).min(1).max(Number(process.env.MAX_PROJECT_FILES || 50))
});

export const publishSchema = z.object({
  projectId: z.string().uuid(),
  storeDescription: z.string().trim().min(1).max(2000).optional()
});

export function totalBytes(files) {
  return Buffer.byteLength(files.map(x => x.content).join(""), "utf8");
}

export function validatePaths(files) {
  for (const file of files) {
    if (
      file.path.includes("..") ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      !/^[A-Za-z0-9._/-]+$/.test(file.path)
    ) {
      throw new Error(`Invalid file path: ${file.path}`);
    }
  }
}

export function enforceSourceSize(files) {
  if (totalBytes(files) > MAX_SOURCE_BYTES) {
    throw new Error("Project source is too large.");
  }
}

const blockedPatterns = [
  { pattern: /<script[^>]+src\s*=\s*["']https?:/i, reason: "External script loading is not allowed." },
  { pattern: /javascript\s*:/i, reason: "javascript: URLs are not allowed." },
  { pattern: /<object\b/i, reason: "object elements are not allowed." },
  { pattern: /<embed\b/i, reason: "embed elements are not allowed." },
  { pattern: /<base\b/i, reason: "base elements are not allowed." },
  { pattern: /document\.cookie/i, reason: "Cookie access is not allowed." },
  { pattern: /localStorage/i, reason: "Direct localStorage access is not allowed in published apps." },
  { pattern: /sessionStorage/i, reason: "Direct sessionStorage access is not allowed in published apps." },
  { pattern: /indexedDB/i, reason: "Direct IndexedDB access is not allowed in published apps." },
  { pattern: /navigator\.clipboard/i, reason: "Direct clipboard access is not allowed." },
  { pattern: /navigator\.sendBeacon/i, reason: "sendBeacon is not allowed." },
  { pattern: /\bWebSocket\s*\(/i, reason: "WebSocket access is not allowed." },
  { pattern: /\bEventSource\s*\(/i, reason: "EventSource is not allowed." },
  { pattern: /\bSharedWorker\s*\(/i, reason: "SharedWorker is not allowed." },
  { pattern: /\bWorker\s*\(/i, reason: "Worker creation is not allowed." },
  { pattern: /\bServiceWorker\b/i, reason: "Service workers are not allowed." },
  { pattern: /\bWebAssembly\b/i, reason: "WebAssembly is not allowed." },
  { pattern: /\beval\s*\(/i, reason: "eval is not allowed." },
  { pattern: /\bFunction\s*\(/i, reason: "Dynamic Function construction is not allowed." },
  { pattern: /\bimport\s*\(/i, reason: "Dynamic imports are not allowed." },
  { pattern: /<iframe\b/i, reason: "Nested iframes are not allowed." },
  { pattern: /<form\b/i, reason: "Forms are not allowed in published apps." }
];

export function scanPublishedSource(files) {
  for (const file of files) {
    for (const item of blockedPatterns) {
      if (item.pattern.test(file.content)) {
        throw new Error(`${file.path}: ${item.reason}`);
      }
    }
  }
}
