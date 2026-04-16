const mongoose = require('mongoose')
require('dotenv').config()

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User')
  const users = await User.find({
    role: { $in: ['owner', 'driver'] }
  }).select('name phone role subscriptionRequired subscriptionDeadline freeTrialStart isPermanentFree subscription createdAt')
  
  console.log('Total users:', users.length)
  users.forEach(u => {
    const days = Math.floor(
      (Date.now() - new Date(u.freeTrialStart || u.createdAt)) / 
      (24 * 60 * 60 * 1000)
    )
    console.log({
      name: u.name,
      role: u.role,
      daysSinceJoin: days,
      subscriptionRequired: u.subscriptionRequired,
      isPermanentFree: u.isPermanentFree,
      deadline: u.subscriptionDeadline
    })
  })
  
  mongoose.disconnect()
}).catch(console.error)
