import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  isNativeApp,
  generateAndOpenPDF,
} from '../../utils/pdfUpload'
import { getContractById, completeContract } from '../../api/contractAPI'

const getSalaryDisplay = (contract, t) => {
  if (!contract) return '₹0'
  const cat = contract.vehicleCategory
  const type = contract.salaryType

  if (cat === 'transport') {
    return `₹${contract.salaryPerMonth || 0}/${t('perMonth')}`
  }
  if (type === 'hourly') {
    return `₹${contract.salaryPerHour || 0}/${t('perHour')}`
  }
  if (type === 'monthly') {
    return `₹${contract.salaryPerMonth || 0}/${t('perMonth')}`
  }
  return `₹${contract.salaryPerDay || 0}/${t('perDay')}`
}

const getTotalKamayi = (contract, t) => {
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
    return t('hourlyBasis2')
  }
  return (contract.salaryPerDay || 0) * dur
}

const contractSalaryTypeLabel = (c, t) => {
  if (!c) return '—'
  if (c.vehicleCategory === 'transport') return t('monthlyTransport2')
  if (c.salaryType === 'hourly') return t('perHourLabel2')
  if (c.salaryType === 'monthly') return t('perMonthLabel2')
  if (c.salaryType === 'daily') return t('perDayLabel2')
  return String(c.salaryType || '—')
}

const ViewContract = () => {
  const { t } = useTranslation()
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
        err.response?.data?.message || t('contractLoadError2')
      )
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    fetchContract()
  }, [fetchContract])

  const handlePrint = async () => {
    if (isNativeApp()) {
      await generateAndOpenPDF(
        'contract',
        {
          jobTitle: contract?.jobId?.title || '',
          vehicleType: contract?.jobId?.vehicleType || '',
          driverName: contract?.driverId?.name || '',
          ownerName: contract?.ownerId?.name || '',
          salary: getSalaryDisplay(contract, t),
          salaryType: contractSalaryTypeLabel(contract, t),
          startDate: contract?.startDate
            ? new Date(contract.startDate)
              .toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '',
          createdAt: contract?.createdAt
            ? new Date(contract.createdAt)
              .toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '',
          duration: contract?.duration || 0,
          workLocation: contract?.workLocation || '',
          terms: contract?.terms || '',
          safetyConditions: contract?.safetyConditions || '',
          hasBhatta: contract?.hasBhatta || false,
          dailyBhatta: contract?.dailyBhatta || 0,
          hasHourlyBonus: contract?.hasHourlyBonus || false,
          salaryPerHour: contract?.salaryPerHour || 0,
          driverSigned: contract?.driverSigned || false,
          driverSignedAt: contract?.driverSignedAt
            ? new Date(contract.driverSignedAt)
              .toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : '',
          status: contract?.status || '',
        },
        `contract-${contract?._id}.pdf`
      )
    } else {
      window.print()
    }
  }

  const handleComplete = async () => {
    if (!contract?._id) return
    if (
      !window.confirm(
        t('confirmComplete')
      )
    ) {
      return
    }
    try {
      setCompleting(true)
      await completeContract(contract._id)
      toast.success(
        t('contractCompleted')
      )
      await fetchContract()
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('contractCompleteError')
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
            <div
              className="flex justify-center items-center h-64"
              role="status"
              aria-label={t('loading')}
            >
              <div
                className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
            </div>
          ) : !contract ? (
            <p className="text-center text-gray-600">
              {t('contractNotFound')}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
              >
                {t('backBtn2')}
              </button>

              <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                  {t('contractDetails')}
                </h1>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl text-sm"
                >
                  {t('downloadPDF')}
                </button>
              </div>

              {contract.status === 'sent' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <div className="font-semibold text-yellow-800">
                      {t('waitingDriverSign')}
                    </div>
                    <div className="text-sm text-yellow-600">
                      {t('driverNotSignedYet')}
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
                        {t('workInProgressContract')}
                      </div>
                      <div className="text-sm text-green-600">
                        {t('driverSignedOn')}{' '}
                        {formatDate(contract.driverSignedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xl font-bold text-green-700">
                      {typeof getTotalKamayi(contract, t) === 'string'
                        ? getTotalKamayi(contract, t)
                        : `₹${getTotalKamayi(contract, t)}`}
                    </div>
                    <div className="text-xs text-green-600">
                      {t('totalContractValue')}
                    </div>
                  </div>
                </div>
              )}

              {contract.status === 'completed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                  <p className="font-bold text-blue-900">
                    ✅ {t('contractCompletedMsg')}
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    {t('nowBothCanRate')}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/ratings')}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      {t('giveRatingBtn')}
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchContract()}
                      className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
                    >
                      {t('viewHistoryBtn')}
                    </button>
                  </div>
                </div>
              )}

              <div
                className="print-area bg-white rounded-2xl border border-gray-100 p-6 mb-6"
                aria-label={`${t('viewContract')} · ${t('status')}: ${contract.status}`}
              >
                <div className="print-heading">
                  {t('joiningLetterHeading').toUpperCase()}
                </div>

                <div className="print-row">
                  <span>{t('dateLabel2')}:</span>
                  <span>{formatDate(contract.createdAt)}</span>
                </div>

                <div className="print-row">
                  <span>{t('owner')}:</span>
                  <span>{contract.ownerId?.name}</span>
                </div>

                <div className="print-row">
                  <span>{t('driver')}:</span>
                  <span>{contract.driverId?.name}</span>
                </div>

                <div className="print-row">
                  <span>{t('workLabel2')}:</span>
                  <span>
                    {contract.jobId?.title} — {contract.jobId?.vehicleType}
                  </span>
                </div>

                <div className="print-row">
                  <span>{t('locationLabel4')}:</span>
                  <span>{contract.workLocation}</span>
                </div>

                <div className="print-row">
                  <span>{t('startDate')}:</span>
                  <span>{formatDate(contract.startDate)}</span>
                </div>

                {contract.endDate ? (
                  <div className="print-row">
                    <span>{t('endDate')}:</span>
                    <span>{formatDate(contract.endDate)}</span>
                  </div>
                ) : null}

                <div className="print-row">
                  <span>{t('durationLabel5')}:</span>
                  <span>
                    {contract.duration} {t('days')}
                  </span>
                </div>

                <div className="print-row">
                  <span>{t('salaryTypeLabel2')}:</span>
                  <span>{contractSalaryTypeLabel(contract, t)}</span>
                </div>

                <div className="print-row">
                  <span>{t('salary')}:</span>
                  <span>{getSalaryDisplay(contract)}</span>
                </div>

                {contract.hasBhatta && contract.dailyBhatta > 0 && (
                  <div className="print-row">
                    <span>{t('bhatta')}:</span>
                    <span>
                      ₹{contract.dailyBhatta}/{t('perDay')}
                    </span>
                  </div>
                )}

                {contract.hasHourlyBonus &&
                  contract.salaryPerHour > 0 && (
                    <div className="print-row">
                      <span>{t('bonus')}:</span>
                      <span>
                        ₹{contract.salaryPerHour}/{t('perHour')}
                      </span>
                    </div>
                  )}

                <div className="print-row">
                  <span>{t('totalEarningsLabel3')}:</span>
                  <span>
                    {typeof getTotalKamayi(contract, t) === 'string'
                      ? getTotalKamayi(contract, t)
                      : `₹${getTotalKamayi(contract, t)}`}
                  </span>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <strong>{t('termsLabel3')}:</strong>
                  <p style={{ whiteSpace: 'pre-line', marginTop: '8px' }}>
                    {contract.terms}
                  </p>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <strong>{t('safetyConditionsLabel')}:</strong>
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
                    <div>{t('ownerSignature')}:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.ownerId?.name}
                    </div>
                  </div>
                  <div>
                    <div>{t('driverSignature')}:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.driverSigned
                        ? contract.driverId?.name
                        : t('notSignedYet2')}
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
                  {t('generatedBy')} —{' '}
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
                        ? t('completingProgress')
                        : t('completeWorkBtn')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/attendance')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-sm font-medium text-gray-700">
                      {t('viewAttendanceBtn')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/payments')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">💰</div>
                    <div className="text-sm font-medium text-gray-700">
                      {t('makePaymentBtn2')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/complaints')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-red-300 hover:bg-red-50 transition-all col-span-2 md:col-span-1"
                  >
                    <div className="text-2xl mb-1">⚠️</div>
                    <div className="text-sm font-medium text-gray-700">
                      {t('complaintBtn2')}
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
