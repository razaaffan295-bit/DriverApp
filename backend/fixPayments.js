require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Payment = require('./models/Payment');
  const result = await Payment.updateMany(
    { tripId: { $exists: true, $ne: null }, paymentType: { $ne: 'trip' } },
    { $set: { paymentType: 'trip' } }
  );
  console.log('Updated:', result.modifiedCount);
  mongoose.disconnect();
});