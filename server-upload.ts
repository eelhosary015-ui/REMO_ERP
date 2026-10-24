import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow all files for CV parsing & document uploads
    cb(null, true);
  }
});
