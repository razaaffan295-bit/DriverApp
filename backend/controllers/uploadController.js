const { cloudinary } = require('../config/cloudinary')
const streamifier = require('streamifier')
const { jsPDF } = require('jspdf')

const generateAndUploadPDF = async (type, data) => {
  const doc = new jsPDF()

  if (type === 'attendance') {
    doc.setFontSize(18)
    doc.text('Attendance Report', 14, 20)
    doc.setFontSize(11)
    doc.text(
      `Driver: ${data.driverName || ''}`,
      14, 32
    )
    doc.text(
      `Month: ${data.month}/${data.year}`,
      14, 40
    )
    doc.text(
      `Present Days: ${data.presentDays || 0}`,
      14, 48
    )
    doc.text(
      `Absent Days: ${data.absentDays || 0}`,
      14, 56
    )
    doc.text(
      `Half Days: ${data.halfDays || 0}`,
      14, 64
    )
    doc.text(
      `Total Earned: Rs.${data.grossTotal || 0}`,
      14, 72
    )
    let y = 85
    doc.setFontSize(9)
    doc.text('Date', 14, y)
    doc.text('Status', 55, y)
    doc.text('Hours', 95, y)
    doc.text('Salary', 125, y)
    y += 5
    doc.line(14, y, 196, y)
    y += 5
    ;(data.records || []).forEach(r => {
      if (y > 270) { doc.addPage(); y = 20 }
      doc.text(
        new Date(r.date)
          .toLocaleDateString('en-IN'),
        14, y
      )
      doc.text(
        r.status === 'present' ? 'Present' :
        r.status === 'absent' ? 'Absent' :
        'Half Day',
        55, y
      )
      doc.text(String(r.hoursWorked || 0), 95, y)
      doc.text(`Rs.${r.salaryForDay || 0}`, 125, y)
      y += 8
    })
  }

  else if (type === 'payment') {
    doc.setFontSize(18)
    doc.text('Payment Receipt', 14, 20)
    doc.setFontSize(11)
    doc.text(
      `Amount: Rs.${data.amount || 0}`,
      14, 35
    )
    doc.text(
      `Net Amount: Rs.${data.netAmount || 0}`,
      14, 43
    )
    doc.text(
      `Type: ${(data.payoutMethod || 'UPI').toUpperCase()}`,
      14, 51
    )
    if (data.utrNumber) {
      doc.text(`UTR: ${data.utrNumber}`, 14, 59)
    }
    doc.text(
      `Date: ${data.date || ''}`,
      14, 67
    )
    doc.text(
      `Driver: ${data.driverName || ''}`,
      14, 75
    )
    doc.text(
      `Owner: ${data.ownerName || ''}`,
      14, 83
    )
    doc.text(
      `Status: ${data.status === 'paid'
        ? 'Confirmed' : data.status || ''}`,
      14, 91
    )
  }

  else if (type === 'trip') {
    doc.setFontSize(18)
    doc.text('Trip Receipt', 14, 20)
    doc.setFontSize(11)
    doc.text(
      `Route: ${data.from || ''} to ${data.to || ''}`,
      14, 32
    )
    doc.text(
      `Cargo: ${data.cargo || '-'}`,
      14, 40
    )
    doc.text(
      `Date: ${data.date || ''}`,
      14, 48
    )
    doc.text(
      `Total Expenses: Rs.${data.totalExpenses || 0}`,
      14, 56
    )
    doc.text(
      `Total Repairs: Rs.${data.totalRepairs || 0}`,
      14, 64
    )
    doc.text(
      `Grand Total: Rs.${data.grandTotal || 0}`,
      14, 72
    )
    doc.text(
      `Approved: Rs.${data.approvedAmount || 0}`,
      14, 80
    )
    doc.text(
      `Driver: ${data.driverName || ''}`,
      14, 88
    )
    doc.text(
      `Owner: ${data.ownerName || ''}`,
      14, 96
    )
  }

  else if (type === 'contract') {
    doc.setFontSize(18)
    doc.text('Contract Details', 14, 20)
    doc.setFontSize(11)
    doc.text(
      `Job: ${data.jobTitle || ''}`,
      14, 32
    )
    doc.text(
      `Driver: ${data.driverName || ''}`,
      14, 40
    )
    doc.text(
      `Owner: ${data.ownerName || ''}`,
      14, 48
    )
    doc.text(
      `Salary: ${data.salary || ''}`,
      14, 56
    )
    doc.text(
      `Start Date: ${data.startDate || ''}`,
      14, 64
    )
    doc.text(
      `Status: ${data.status || ''}`,
      14, 72
    )
  }

  const pdfBuffer = Buffer.from(
    doc.output('arraybuffer')
  )

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

  const result = await streamUpload(pdfBuffer)
  return result.secure_url
}

const generatePDF = async (req, res) => {
  try {
    const { type, data } = req.body
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        message: 'type aur data required hai'
      })
    }
    const url = await generateAndUploadPDF(type, data)
    return res.json({ success: true, url })
  } catch (error) {
    console.error('PDF generation error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'PDF generate nahi hua'
    })
  }
}

module.exports = { generatePDF }
