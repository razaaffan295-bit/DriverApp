const express = require('express')
const router = express.Router()
const {
  sendMessage,
  getMessages,
  getConversations
} = require('../controllers/messageController')
const { verifyToken } =
  require('../middleware/authMiddleware')
const { requireActiveSubscription } =
  require('../middleware/subscriptionMiddleware')

router.use(verifyToken)
router.get('/conversations/all',
  getConversations)
router.get('/:jobId/:otherUserId',
  getMessages)
router.post('/send', requireActiveSubscription, sendMessage)

module.exports = router
