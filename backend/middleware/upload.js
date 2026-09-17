const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cloudinaryUtil = require('../utils/cloudinary');

const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Magic-byte signatures for the image formats we accept. The extension and
// Content-Type checked in fileFilter above are both supplied by the client
// and easily spoofed, so this looks at the actual file bytes in memory.
const SIGNATURES = [
  { bytes: [0x89, 0x50, 0x4e, 0x47] },              // PNG
  { bytes: [0xff, 0xd8, 0xff] },                     // JPEG
  { bytes: [0x47, 0x49, 0x46, 0x38] },               // GIF ("GIF8")
  { bytes: [0x52, 0x49, 0x46, 0x46], extra: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 } }, // WEBP ("RIFF"...."WEBP")
];

function matchesImageSignature(buffer) {
  return SIGNATURES.some(({ bytes, extra }) => {
    const headMatches = bytes.every((b, i) => buffer[i] === b);
    if (!headMatches) return false;
    if (!extra) return true;
    return extra.bytes.every((b, i) => buffer[extra.offset + i] === b);
  });
}

// Run after upload.single()/upload.array(): rejects any file whose real
// content isn't one of the allowed image formats.
function verifyImageSignature(req, res, next) {
  if (!req.file) return next();

  if (!matchesImageSignature(req.file.buffer)) {
    return res.status(400).json({ success: false, message: 'Το αρχείο δεν είναι έγκυρη εικόνα' });
  }

  next();
}

// Uploads to Cloudinary when configured (production); otherwise falls back
// to writing the buffer into the local uploads/ folder (dev, no signup needed).
async function saveImage(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (cloudinaryUtil.isConfigured) {
    const result = await cloudinaryUtil.uploadBuffer(file.buffer, crypto.randomUUID());
    return result.secure_url;
  }

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filename = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

// Deletes a previously saved image, whether it lives on Cloudinary or locally.
// Seeded/external URLs that match neither pattern are silently skipped.
function deleteImage(imageUrl) {
  if (!imageUrl) return;

  if (imageUrl.includes('res.cloudinary.com')) {
    cloudinaryUtil.destroyByUrl(imageUrl);
    return;
  }

  if (imageUrl.startsWith('/uploads/')) {
    fs.unlink(path.join(uploadDir, path.basename(imageUrl)), () => {});
  }
}

module.exports = { upload, verifyImageSignature, saveImage, deleteImage };
