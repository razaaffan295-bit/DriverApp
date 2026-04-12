import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import { getUser } from '../../utils/helpers'
import { savePDF, isNativeApp } from '../../utils/pdfUpload'
import { getContractById, completeContract } from '../../api/contractAPI'

const getSalaryDisplay = (contract) => {
  if (!contract) return '₹0'
  const cat = contract.vehicleCategory
  const type = contract.salaryType

  if (cat === 'transport') {
    return `₹${contract.salaryPerMonth || 0}/month`
  }
  if (type === 'hourly') {
    return `₹${contract.salaryPerHour || 0}/ghanta`
  }
  if (type === 'monthly') {
    return `₹${contract.salaryPerMonth || 0}/month`
  }
  return `₹${contract.salaryPerDay || 0}/din`
}

const getTotalKamayi = (contract) => {
  if (!contract) return 0
  const type = contract.salaryType
  const cat = contract.vehicleCategory
  const dur = contract.duration || 0

  if (cat === 'transport') {
    const months = Math.ceil(dur / 30)
    return (contract.salaryPerMonth || 0) * months
  }
  if (type === 'monthly') {
    const months = Math.ceil(dur / 30)
    return (contract.salaryPerMonth || 0) * months
  }
  if (type === 'hourly') {
    return 'Ghante ke hisaab se'
  }
  return (contract.salaryPerDay || 0) * dur
}

const contractSalaryTypeLabel = (c) => {
  if (!c) return '—'
  if (c.vehicleCategory === 'transport') return 'Monthly (Transport)'
  if (c.salaryType === 'hourly') return 'Per Hour'
  if (c.salaryType === 'monthly') return 'Per Month'
  if (c.salaryType === 'daily') return 'Per Day'
  return String(c.salaryType || '—')
}

const ViewContract = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const fetchContract = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const res = await getContractById(id)
      setContract(res.data?.contract ?? null)
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Contract load nahi hua'
      )
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContract()
  }, [fetchContract])

  const handlePrint = async () => {
    if (isNativeApp()) {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('Contract Details', 14, 20)
      doc.setFontSize(11)
      doc.text(`Job: ${contract?.jobId?.title || ''}`, 14, 32)
      doc.text(`Driver: ${contract?.driverId?.name || ''}`, 14, 40)
      doc.text(`Owner: ${contract?.ownerId?.name || ''}`, 14, 48)
      doc.text(`Salary: ${getSalaryDisplay(contract)}`, 14, 56)
      doc.text(
        `Start: ${new Date(
          contract?.startDate
        ).toLocaleDateString('en-IN')}`,
        14,
        64
      )
      doc.text(`Status: ${contract?.status || ''}`, 14, 72)
      await savePDF(doc, `contract-${contract?._id}.pdf`)
    } else {
      window.print()
    }
  }

  const handleComplete = async () => {
    if (!contract?._id) return
    if (
      !window.confirm(
        'Kya aap sure hain? Contract complete mark ho jayega.'
      )
    ) {
      return
    }
    try {
      setCompleting(true)
      await completeContract(contract._id)
      toast.success(
        'Contract complete ho gaya! Ab rating de sakte hain.'
      )
      await fetchContract()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Complete nahi hua'
      )
    } finally {
      setCompleting(false)
    }
  }

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O'

  const driverLoc = [
    contract?.driverId?.location?.state,
    contract?.driverId?.location?.district,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-4xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div
                className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
            </div>
          ) : !contract ? (
            <p className="text-center text-gray-600">Contract nahi mila</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
              >
                ← Wapas Jaao
              </button>

              <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                  Joining Letter
                </h1>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl text-sm"
                >
                  PDF Download Karo
                </button>
              </div>

              {contract.status === 'sent' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <div className="font-semibold text-yellow-800">
                      Driver ke sign karne ka wait hai
                    </div>
                    <div className="text-sm text-yellow-600">
                      Driver ne abhi sign nahi kiya
                    </div>
                  </div>
                </div>
              )}

              {contract.status === 'active' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-bold text-green-800">
                        Contract Active Hai — Kaam Chal Raha Hai!
                      </div>
                      <div className="text-sm text-green-600">
                        Driver ne{' '}
                        {formatDate(contract.driverSignedAt)} ko sign kiya
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xl font-bold text-green-700">
                      {typeof getTotalKamayi(contract) === 'string'
                        ? getTotalKamayi(contract)
                        : `₹${getTotalKamayi(contract)}`}
                    </div>
                    <div className="text-xs text-green-600">
                      Total Contract Value
                    </div>
                  </div>
                </div>
              )}

              {contract.status === 'completed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                  <p className="font-bold text-blue-900">
                    ✅ Contract Complete Ho Gaya
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Ab dono rating de sakte hain
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/ratings')}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      Rating Do
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchContract()}
                      className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
                    >
                      History Dekho
                    </button>
                  </div>
                </div>
              )}

              <div className="print-area bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <div className="print-heading">JOINING LETTER</div>

                <div className="print-row">
                  <span>Date:</span>
                  <span>{formatDate(contract.createdAt)}</span>
                </div>

                <div className="print-row">
                  <span>Owner:</span>
                  <span>{contract.ownerId?.name}</span>
                </div>

                <div className="print-row">
                  <span>Driver:</span>
                  <span>{contract.driverId?.name}</span>
                </div>

                <div className="print-row">
                  <span>Kaam:</span>
                  <span>
                    {contract.jobId?.title} — {contract.jobId?.vehicleType}
                  </span>
                </div>

                <div className="print-row">
                  <span>Location:</span>
                  <span>{contract.workLocation}</span>
                </div>

                <div className="print-row">
                  <span>Start Date:</span>
                  <span>{formatDate(contract.startDate)}</span>
                </div>

                <div className="print-row">
                  <span>Duration:</span>
                  <span>{contract.duration} din</span>
                </div>

                <div className="print-row">
                  <span>Salary Type:</span>
                  <span>{contractSalaryTypeLabel(contract)}</span>
                </div>

                <div className="print-row">
                  <span>Rate:</span>
                  <span>{getSalaryDisplay(contract)}</span>
                </div>

                {contract.hasBhatta && contract.dailyBhatta > 0 && (
                  <div className="print-row">
                    <span>Daily Bhatta:</span>
                    <span>₹{contract.dailyBhatta}/din</span>
                  </div>
                )}

                {contract.hasHourlyBonus &&
                  contract.salaryPerHour > 0 && (
                    <div className="print-row">
                      <span>Hourly Bonus:</span>
                      <span>
                        ₹{contract.salaryPerHour}/ghanta
                      </span>
                    </div>
                  )}

                <div className="print-row">
                  <span>Total Kamayi:</span>
                  <span>
                    {typeof getTotalKamayi(contract) === 'string'
                      ? getTotalKamayi(contract)
                      : `₹${getTotalKamayi(contract)}`}
                  </span>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <strong>Shartein:</strong>
                  <p style={{ whiteSpace: 'pre-line', marginTop: '8px' }}>
                    {contract.terms}
                  </p>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <strong>Safety Conditions:</strong>
                  <p style={{ whiteSpace: 'pre-line', marginTop: '8px' }}>
                    {contract.safetyConditions}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div>Owner Signature:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.ownerId?.name}
                    </div>
                  </div>
                  <div>
                    <div>Driver Signature:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.driverSigned
                        ? contract.driverId?.name
                        : '(Abhi sign nahi kiya)'}
                    </div>
                    {contract.driverSignedAt && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {formatDate(contract.driverSignedAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '40px',
                    fontSize: '11px',
                    color: '#666',
                    textAlign: 'center',
                    borderTop: '1px solid #eee',
                    paddingTop: '10px',
                  }}
                >
                  Generated by DriverApp —{' '}
                  {new Date().toLocaleDateString('en-IN')}
                </div>
              </div>

              {contract.status === 'active' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={completing}
                    className="bg-gray-700 text-white border border-gray-200 rounded-2xl p-4 text-center hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    <div className="text-2xl mb-1">✅</div>
                    <div className="text-sm font-medium">
                      {completing
                        ? 'Ho raha hai...'
                        : 'Kaam Complete Karo'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/attendance')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-sm font-medium text-gray-700">
                      Attendance Dekho
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/payments')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">💰</div>
                    <div className="text-sm font-medium text-gray-700">
                      Payment Karo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/complaints')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-red-300 hover:bg-red-50 transition-all col-span-2 md:col-span-1"
                  >
                    <div className="text-2xl mb-1">⚠️</div>
                    <div className="text-sm font-medium text-gray-700">
                      Complaint
                    </div>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  )
}

export default ViewContract
