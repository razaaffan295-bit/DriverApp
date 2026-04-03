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

router.post('/', verifyToken, isOwner, createContract)
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
router.get('/:id', verifyToken, getContractById)
router.put('/:id/sign', verifyToken, isDriver, driverSignContract)
router.put(
  '/:id/complete',
  verifyToken,
  isOwner,
  completeContract
)

module.exports = router
