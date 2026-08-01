const path = require('path');
const fs = require('fs');
const multer = require('multer');

const STORAGE_MODE = process.env.STORAGE_MODE || 'cloudinary';
const uploadsDir = path.join(__dirname, '..', 'uploads');

let cloudinary = null;
let upload;

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

if (STORAGE_MODE === 'local') {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
} else {
  cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'campustrace/items',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
  });

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

/** Normalize multer file into { url, publicId } for both storage backends. */
const toImageData = (file) => {
  if (!file) return { url: '', publicId: '' };

  if (STORAGE_MODE === 'local') {
    return {
      url: `/uploads/${file.filename}`,
      publicId: file.filename,
    };
  }

  return {
    url: file.path,
    publicId: file.filename,
  };
};

/** Delete an image by publicId (Cloudinary destroy or local file unlink). */
const destroyImage = async (publicId) => {
  if (!publicId) return;

  if (STORAGE_MODE === 'local') {
    const filePath = path.join(uploadsDir, publicId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  if (cloudinary) {
    await cloudinary.uploader.destroy(publicId);
  }
};

module.exports = { upload, cloudinary, toImageData, destroyImage, STORAGE_MODE };
