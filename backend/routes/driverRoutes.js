const express = require('express')
const router = express.Router()
const { upload } = require('../config/cloudinary')
const { verifyToken, isDriver } =
  require('../middleware/authMiddleware')
const {
  getPublicDriverProfile,
  getDriverProfile,
  updateDriverProfile,
  uploadProfilePhoto,
  uploadDocuments,
  searchJobs,
  getJobDetail,
  applyJob,
  getDriverApplications,
} = require('../controllers/driverController')

router.get('/public/:id', verifyToken, getPublicDriverProfile)

router.get('/profile', verifyToken, isDriver, getDriverProfile)
router.put('/profile', verifyToken, isDriver, updateDriverProfile)
router.post(
  '/profile/photo',
  verifyToken,
  isDriver,
  upload.single('photo'),
  uploadProfilePhoto
)
router.post(
  '/documents',
  verifyToken,
  isDriver,
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'aadhar', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'other', maxCount: 1 },
  ]),
  uploadDocuments
)
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
