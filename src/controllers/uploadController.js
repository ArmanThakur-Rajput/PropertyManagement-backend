import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// ── Configure Cloudinary once at module load — not per-request ─────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer: memory storage with 5MB limit and image-only filter ────────────────
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF, SVG)'), false);
    }
  },
}).single('file');

export const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Upload buffer stream directly to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'hyper_realestate', resource_type: 'image' },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return res.status(500).json({ success: false, message: 'Upload failed' });
        }
        return res.status(200).json({ success: true, url: result.secure_url });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
