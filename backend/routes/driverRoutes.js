const express = require('express')
const router = express.Router()
const { verifyToken, isDriver } =
  require('../middleware/authMiddleware')
const {
  getPublicDriverProfile,
  getDriverProfile,
  updateDriverProfile,
  searchJobs,
  getJobDetail,
  applyJob,
  getDriverApplications,
} = require('../controllers/driverController')

router.get('/public/:id', verifyToken, getPublicDriverProfile)

router.get('/profile', verifyToken, isDriver, getDriverProfile)
router.put('/profile', verifyToken, isDriver, updateDriverProfile)
router.get(
  '/my-applications',
  verifyToken,
  isDriver,
  getDriverApplications
)
router.get('/jobs/search', verifyToken, isDriver, searchJobs)
router.get('/jobs/:id', verifyToken, isDriver, getJobDetail)
router.post('/jobs/:id/apply', verifyToken, isDriver, applyJob)

module.exports = router
