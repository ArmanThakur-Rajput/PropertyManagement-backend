/**
 * uploadController.js
 *
 * Handles file uploads to Cloudflare R2 (S3-compatible).
 * Supports images AND videos.
 *
 * Required ENV vars:
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 access key
 *   R2_SECRET_ACCESS_KEY— R2 secret key
 *   R2_BUCKET_NAME      — bucket name (e.g. "hyper-realestate")
 *   R2_PUBLIC_URL       — public base URL  (e.g. "https://pub-xxxx.r2.dev")
 *                         OR custom domain  (e.g. "https://media.yoursite.com")
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import FileType from 'file-type';

// ── Build R2 client once at module load ────────────────────────────────────────
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// ── Allowed MIME types ─────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
]);
const ALL_ALLOWED = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);

// ── File size limits ───────────────────────────────────────────────────────────
const IMAGE_LIMIT = 10 * 1024 * 1024;  // 10 MB
const VIDEO_LIMIT = 100 * 1024 * 1024; // 100 MB

// ── Multer: memory storage, dynamic size limit ─────────────────────────────────
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_LIMIT },  // upper cap; images checked below
  fileFilter: (_req, file, cb) => {
    if (ALL_ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG/PNG/WebP/GIF) and videos (MP4/WebM/MOV/AVI) are allowed'), false);
    }
  },
}).single('file');  // field name: "file"

// ── Helper: upload buffer → R2 ────────────────────────────────────────────────
async function uploadToR2(buffer, mimetype, folder = 'listings') {
  const isImage = ALLOWED_IMAGE_TYPES.has(mimetype);
  const ext = path.extname(
    mimetype.replace('image/', '.').replace('video/', '.')
  ) || (isImage ? '.jpg' : '.mp4');

  const key = `${folder}/${randomUUID()}${ext}`;

  await r2Client.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype,
    // Make object publicly readable (requires bucket to allow public access)
    // ACL: 'public-read',  // uncomment if your bucket uses ACL-based public access
  }));

  return `${PUBLIC_URL}/${key}`;
}

// ── POST /api/upload ───────────────────────────────────────────────────────────
export const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { buffer, size } = req.file;

    // Verify actual file type via magic bytes — MIME header can be spoofed
    const type = await FileType.fromBuffer(req.file.buffer);
    if (!detected || !ALL_ALLOWED.has(detected.mime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file. Only images (JPEG/PNG/WebP/GIF) and videos (MP4/WebM/MOV/AVI) are allowed',
      });
    }
    const mimetype = detected.mime;

    // Extra image size check (multer limit covers videos only above)
    if (ALLOWED_IMAGE_TYPES.has(mimetype) && size > IMAGE_LIMIT) {
      return res.status(400).json({
        success: false,
        message: 'Image must be under 10 MB',
      });
    }

    const folder = ALLOWED_VIDEO_TYPES.has(mimetype) ? 'listing-videos' : 'listing-images';
    const url = await uploadToR2(buffer, mimetype, folder);

    return res.status(200).json({
      success: true,
      url,
      type: ALLOWED_VIDEO_TYPES.has(mimetype) ? 'video' : 'image',
    });
  } catch (err) {
    console.error('R2 Upload Error:', err);
    return res.status(500).json({ success: false, message: 'Upload failed. Please try again.' });
  }
};

// ── POST /api/upload/many  (up to 10 files at once) ───────────────────────────
export const uploadManyMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_LIMIT },
  fileFilter: (_req, file, cb) => {
    if (ALL_ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  },
}).array('files', 10);

export const handleUploadMany = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const results = await Promise.all(
      req.files.map(async (f) => {
        // Verify magic bytes — don't trust the MIME header from the request
        const detected = await fileTypeFromBuffer(f.buffer);
        if (!detected || !ALL_ALLOWED.has(detected.mime)) {
          return { success: false, originalName: f.originalname, message: 'Invalid file type' };
        }
        const mime = detected.mime;

        if (ALLOWED_IMAGE_TYPES.has(mime) && f.size > IMAGE_LIMIT) {
          return { success: false, originalName: f.originalname, message: 'Too large (max 10 MB)' };
        }
        const folder = ALLOWED_VIDEO_TYPES.has(mime) ? 'listing-videos' : 'listing-images';
        const url = await uploadToR2(f.buffer, mime, folder);
        return {
          success: true,
          url,
          type: ALLOWED_VIDEO_TYPES.has(mime) ? 'video' : 'image',
          originalName: f.originalname,
        };
      })
    );

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('R2 Bulk Upload Error:', err);
    return res.status(500).json({ success: false, message: 'Upload failed. Please try again.' });
  }
};
