const { cloudinary } = require('../config/cloudinary')
const streamifier = require('streamifier')

const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'PDF file required',
      })
    }

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'driverapp/pdfs',
            resource_type: 'raw',
            format: 'pdf',
            access_mode: 'public',
          },
          (error, result) => {
            if (result) resolve(result)
            else reject(error)
          }
        )
        streamifier.createReadStream(buffer).pipe(stream)
      })
    }

    const result = await streamUpload(req.file.buffer)

    return res.json({
      success: true,
      url: result.secure_url,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Upload failed',
    })
  }
}

module.exports = { uploadPDF }
