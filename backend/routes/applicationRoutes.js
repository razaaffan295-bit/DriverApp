const express = require('express')
const router = express.Router()
const {
  getJobApplications,
  getOwnerApplications,
  acceptApplication,
  rejectApplication,
  cancelApplication
} = require('../controllers/applicationController')
const { verifyToken, isOwner } =
  require('../middleware/authMiddleware')
const { cacheMiddleware } = require('../middleware/cacheMiddleware')
const { validateObjectId } =
  require('../middleware/validateParams')

router.use(verifyToken, isOwner)
router.get('/my-applications',
  cacheMiddleware(30), getOwnerApplications)
router.get(
  '/job/:jobId',
  validateObjectId('jobId'),
  cacheMiddleware(30),
  getJobApplications
)
router.put(
  '/:id/cancel',
  validateObjectId('id'),
  cancelApplication
)
router.put(
  '/:id/accept',
  validateObjectId('id'),
  acceptApplication
)
router.put(
  '/:id/reject',
  validateObjectId('id'),
  rejectApplication
)

module.exports = router
