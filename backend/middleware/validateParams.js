const mongoose = require('mongoose')

// Validate ObjectId helper
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ''))
}

// Validate a single param (e.g., :id in URL)
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName]
    
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName}`,
      })
    }
    
    next()
  }
}

// Validate multiple params at once
// Usage: validateObjectIds(['userId', 'jobId'])
const validateObjectIds = (paramNames = []) => {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName]
      if (!id || !isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${paramName}`,
        })
      }
    }
    next()
  }
}

module.exports = {
  validateObjectId,
  validateObjectIds,
  isValidObjectId,
}
