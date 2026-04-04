const express = require('express')
const router = express.Router()
const { upload } = require('../config/cloudinary')
const {
  createTrip,
  addExpense,
  addRepair,
  completeTrip,
  submitTrip,
  getActiveTrip,
  getDriverTrips,
  getOwnerTrips,
  handleTrip,
  reviewTrip,
  createRepairRequest,
  reviewRepairRequest,
} = require('../controllers/tripController')
const {
  verifyToken,
  isOwner,
  isDriver,
} = require('../middleware/authMiddleware')

router.post('/create', verifyToken, isDriver, createTrip)

router.post(
  '/add-expense',
  verifyToken,
  isDriver,
  upload.single('image'),
  addExpense
)
router.post(
  '/expense/add',
  verifyToken,
  isDriver,
  upload.single('image'),
  addExpense
)

router.post(
  '/add-repair',
  verifyToken,
  isDriver,
  upload.single('image'),
  addRepair
)

router.post('/complete', verifyToken, isDriver, completeTrip)
router.post('/submit', verifyToken, isDriver, submitTrip)

router.get('/active', verifyToken, isDriver, getActiveTrip)
router.get('/driver', verifyToken, isDriver, getDriverTrips)

router.get('/owner', verifyToken, isOwner, getOwnerTrips)

router.post('/handle', verifyToken, isOwner, handleTrip)
router.put('/review', verifyToken, isOwner, reviewTrip)

router.post('/repair/create', verifyToken, isDriver, createRepairRequest)
router.put('/repair/review', verifyToken, isOwner, reviewRepairRequest)

module.exports = router
