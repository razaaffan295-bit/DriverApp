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

router.use(verifyToken, isOwner)
router.get('/my-applications',
  getOwnerApplications)
router.get('/job/:jobId',
  getJobApplications)
router.put('/:id/cancel',
  cancelApplication)
router.put('/:id/accept',
  acceptApplication)
router.put('/:id/reject',
  rejectApplication)

module.exports = router
