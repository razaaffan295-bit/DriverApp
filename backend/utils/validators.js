const mongoose = require('mongoose')

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id)
}

const validateObjectId = (id, fieldName = 'id') => {
  if (!id || !isValidObjectId(id)) {
    const err = new Error(`Invalid ${fieldName}`)
    err.statusCode = 400
    throw err
  }
  return true
}

const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  isValidObjectId,
  validateObjectId,
  escapeRegex,
}
