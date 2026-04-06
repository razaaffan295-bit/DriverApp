require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log('Connected...')
  
  const collections = [
    'users',
    'contracts',
    'payments',
    'advances',
    'applications',
    'attendances',
    'driverattendances',
    'ownerattendances',
    'complaints',
    'messages',
    'notifications',
    'payments',
    'ratings',
    'resignletters',
    'subscriptions',
    'triprecords',
    'repairrequests',
    'driverinvites',
    'jobs',
    'vehicles',
    'ownerprofiles',
    'driverprofiles',
  ]
  
  for (const col of collections) {
    try {
      await mongoose.connection
        .collection(col).deleteMany({})
      console.log(`Cleared: ${col}`)
    } catch (e) {
      console.log(`Skip: ${col}`)
    }
  }
  
  console.log('Done! Database cleared.')
  mongoose.disconnect()
})
