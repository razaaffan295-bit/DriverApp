const express = require('express')
const router = express.Router()
const {
  sendInvite,
  getOwnerInvites,
  getDriverInvites,
  acceptInvite,
  rejectInvite,
} = require('../controllers/inviteController')
const { verifyToken, isOwner, isDriver } = require('../middleware/authMiddleware')

router.post('/send', verifyToken, isOwner, sendInvite)
router.get('/owner', verifyToken, isOwner, getOwnerInvites)
router.get('/driver', verifyToken, isDriver, getDriverInvites)
router.put('/accept', verifyToken, isDriver, acceptInvite)
router.put('/reject', verifyToken, isDriver, rejectInvite)

module.exports = router

