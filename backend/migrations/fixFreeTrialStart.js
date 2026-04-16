const mongoose = require('mongoose')
require('dotenv').config()

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('../models/User')
  
  const users = await User.find({
    role: { $in: ['owner', 'driver'] },
    freeTrialStart: null
  })
  
  console.log('Users to fix:', users.length)
  
  for (const u of users) {
    await User.findByIdAndUpdate(u._id, {
      freeTrialStart: u.createdAt || new Date()
    })
    console.log('Fixed:', u.name, '- createdAt:', u.createdAt)
  }
  
  console.log('Migration complete!')
  mongoose.disconnect()
}).catch(console.error)
