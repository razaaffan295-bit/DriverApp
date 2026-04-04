const express = require('express')
const router = express.Router()
const { upload } = require('../config/cloudinary')
const {
  getOwnerProfile,
  updateOwnerProfile,
  uploadProfilePhoto,
  addVehicle,
  getVehicles,
  getVehicleDetail,
  getDriverDetail,
  deleteVehicle,
  getPublicOwnerProfile,
} = require('../controllers/ownerController')
const { verifyToken, isOwner } =
  require('../middleware/authMiddleware')

router.get('/public/:id', verifyToken, getPublicOwnerProfile)

router.get('/profile', verifyToken, isOwner, getOwnerProfile)
router.put('/profile', verifyToken, isOwner, updateOwnerProfile)
router.post(
  '/profile/photo',
  verifyToken,
  isOwner,
  upload.single('photo'),
  uploadProfilePhoto
)
router.post('/vehicles', verifyToken, isOwner, addVehicle)
router.get('/vehicles', verifyToken, isOwner, getVehicles)
router.get('/vehicles/:id', verifyToken, isOwner, getVehicleDetail)
router.get('/driver-detail/:id', verifyToken, isOwner, getDriverDetail)
router.delete('/vehicles/:id', verifyToken, isOwner, deleteVehicle)

module.exports = router
