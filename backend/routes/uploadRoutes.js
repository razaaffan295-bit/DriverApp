const express = require('express')
const router = express.Router()
const multer = require('multer')
const { verifyToken } = require('../middleware/authMiddleware')
const { uploadPDF } = require('../controllers/uploadController')

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.endsWith('.pdf')
    ) {
      cb(null, true)
    } else {
      cb(new Error('Sirf PDF allowed hai'))
    }
  },
})

router.post('/pdf', verifyToken, upload.single('pdf'), uploadPDF)

module.exports = router
