const express = require('express')
const router = express.Router()
const {
  sendMessage,
  getMessages,
  getConversations
} = require('../controllers/messageController')
const { verifyToken } =
  require('../middleware/authMiddleware')

router.use(verifyToken)
router.get('/conversations/all',
  getConversations)
router.get('/:jobId/:otherUserId',
  getMessages)
router.post('/send', sendMessage)

module.exports = router
