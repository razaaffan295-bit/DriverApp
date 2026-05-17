const express = require('express')
const router = express.Router()
const Job = require('../models/Job')
const {
  createJob,
  getOwnerJobs,
  getJobById,
  closeJob,
} = require('../controllers/jobController')
const { verifyToken, isOwner, isDriver } =
  require('../middleware/authMiddleware')
const { cacheMiddleware } = require('../middleware/cacheMiddleware')
const { requireActiveSubscription } =
  require('../middleware/subscriptionMiddleware')
const { validateObjectId } =
  require('../middleware/validateParams')

const publicJobRouter = express.Router()
publicJobRouter.get('/public/:id', verifyToken, isDriver, validateObjectId('id'), cacheMiddleware(60), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      'ownerId',
      'name location'
    )

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job nahi mili',
      })
    }
    return res.json({ success: true, job })
  } catch (error) {
    console.error('[Error]', error)
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production'
        ? 'Server error'
        : error.message,
    })
  }
})

router.use(publicJobRouter)

router.use(verifyToken, isOwner)
router.post('/', requireActiveSubscription, createJob)
router.get('/my-jobs', cacheMiddleware(60), getOwnerJobs)
router.get('/:id', validateObjectId('id'), cacheMiddleware(60), getJobById)
router.put('/:id/close', validateObjectId('id'), closeJob)

module.exports = router
