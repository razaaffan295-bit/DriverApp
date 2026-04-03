const express = require('express')
const router = express.Router()
const Job = require('../models/Job')
const {
  createJob,
  getOwnerJobs,
  getJobById,
  closeJob,
} = require('../controllers/jobController')
const { verifyToken, isOwner } =
  require('../middleware/authMiddleware')

const publicJobRouter = express.Router()
publicJobRouter.get('/public/:id', verifyToken, async (req, res) => {
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
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
})

router.use(publicJobRouter)

router.use(verifyToken, isOwner)
router.post('/', createJob)
router.get('/my-jobs', getOwnerJobs)
router.get('/:id', getJobById)
router.put('/:id/close', closeJob)

module.exports = router
