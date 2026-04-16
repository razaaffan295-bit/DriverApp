const express = require('express')
const router = express.Router()
const { verifyToken, isAdmin } = require('../middleware/authMiddleware')
const {
  getFreeTrialUsers,
  requireSubscription,
  extendFreeTrial,
  setPermanentFree,
  removePermanentFree,
} = require('../controllers/adminSubscriptionController')

router.use(verifyToken)
router.use(isAdmin)

router.get('/users', getFreeTrialUsers)
router.post('/require', requireSubscription)
router.post('/extend', extendFreeTrial)
router.post('/permanent-free', setPermanentFree)
router.post('/remove-permanent-free', removePermanentFree)

module.exports = router

