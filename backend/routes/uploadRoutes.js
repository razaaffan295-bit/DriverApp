const express = require('express')
const router = express.Router()
const { verifyToken } = require('../middleware/authMiddleware')
const { generatePDF } = require('../controllers/uploadController')

router.post('/generate-pdf', verifyToken, generatePDF)

module.exports = router
