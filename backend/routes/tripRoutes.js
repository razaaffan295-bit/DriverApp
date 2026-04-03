const express = require('express')
const router = express.Router()
const {
  createTrip,
  addExpense,
  submitTrip,
  getDriverTrips,
  getOwnerTrips,
  reviewTrip,
  createRepairRequest,
  reviewRepairRequest
} = require('../controllers/tripController')
const {
  verifyToken,
  isOwner,
  isDriver
} = require('../middleware/authMiddleware')

router.post(
  '/create',
  verifyToken, isDriver,
  createTrip
)
router.post(
  '/expense/add',
  verifyToken, isDriver,
  addExpense
)
router.post(
  '/submit',
  verifyToken, isDriver,
  submitTrip
)
router.get(
  '/driver',
  verifyToken, isDriver,
  getDriverTrips
)
router.get(
  '/owner',
  verifyToken, isOwner,
  getOwnerTrips
)
router.put(
  '/review',
  verifyToken, isOwner,
  reviewTrip
)
router.post(
  '/repair/create',
  verifyToken, isDriver,
  createRepairRequest
)
router.put(
  '/repair/review',
  verifyToken, isOwner,
  reviewRepairRequest
)

module.exports = router

