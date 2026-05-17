const express = require('express')
const router = express.Router()
const {
  register,
  login,
  getMe,
  checkPhone,
} = require('../controllers/authController')
const { verifyToken, isOwner } =
  require('../middleware/authMiddleware')

router.post('/register', register)
router.post('/login', login)
router.get('/me', verifyToken, getMe)
router.get('/check-phone', verifyToken, isOwner, checkPhone)

module.exports = router
