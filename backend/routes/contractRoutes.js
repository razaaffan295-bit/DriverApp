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
  startWork,
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
router.get('/owner', verifyToken, isOwner, getOwnerContracts)
router.get(
  '/driver/active',
  verifyToken,
  isDriver,
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
router.put(
  '/:id/start-work',
  verifyToken,
  validateObjectId('id'),
  isDriver,
  requireActiveSubscription,
  startWork
)

module.exports = router
