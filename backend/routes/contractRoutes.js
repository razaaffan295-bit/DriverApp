const express = require('express')
const router = express.Router()
const {
  createContract,
  getOwnerContracts,
  getContractById,
  driverSignContract,
  completeContract,
  getDriverContract,
  getDriverContracts,
  getDriverContractHistory,
} = require('../controllers/contractController')
const {
  verifyToken,
  isOwner,
  isDriver,
} = require('../middleware/authMiddleware')
const { cacheMiddleware } = require('../middleware/cacheMiddleware')
const { requireActiveSubscription } =
  require('../middleware/subscriptionMiddleware')
const { validateObjectId } =
  require('../middleware/validateParams')

router.post(
  '/',
  verifyToken,
  isOwner,
  requireActiveSubscription,
  createContract
)
router.get('/owner', verifyToken, isOwner, cacheMiddleware(60), getOwnerContracts)
router.get(
  '/driver/active',
  verifyToken,
  isDriver,
  cacheMiddleware(60),
  getDriverContract
)
router.get(
  '/driver/history',
  verifyToken,
  isDriver,
  getDriverContractHistory
)
router.get(
  '/driver/all',
  verifyToken,
  isDriver,
  cacheMiddleware(60),
  getDriverContracts
)
router.get(
  '/:id',
  verifyToken,
  validateObjectId('id'),
  cacheMiddleware(60),
  getContractById
)
router.put(
  '/:id/sign',
  verifyToken,
  validateObjectId('id'),
  isDriver,
  requireActiveSubscription,
  driverSignContract
)
router.put(
  '/:id/complete',
  verifyToken,
  validateObjectId('id'),
  isOwner,
  completeContract
)

module.exports = router
