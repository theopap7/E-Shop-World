const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  }
});

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
// and easily spoofed, so this looks at the actual file bytes on disk.
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

// Run after upload.single()/upload.array(): rejects (and deletes) any file
// whose real content isn't one of the allowed image formats.
function verifyImageSignature(req, res, next) {
  if (!req.file) return next();

  const filePath = path.join(uploadDir, req.file.filename);

  fs.open(filePath, 'r', (openErr, fd) => {
    if (openErr) return next(openErr);

    const buffer = Buffer.alloc(12);
    fs.read(fd, buffer, 0, 12, 0, (readErr) => {
      fs.close(fd, () => {});
      if (readErr) return next(readErr);

      if (!matchesImageSignature(buffer)) {
        fs.unlink(filePath, () => {});
        return res.status(400).json({ success: false, message: 'Το αρχείο δεν είναι έγκυρη εικόνα' });
      }

      next();
    });
  });
}

module.exports = { upload, verifyImageSignature };
