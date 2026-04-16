import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  getDriverActiveContract,
  getDriverContracts,
  signContract,
} from '../../api/contractAPI'
import {
  getResignRequests,
  requestResign,
} from '../../api/resignAPI'

const ActiveJob = () => {
  const { t } = useTranslation()

  const getSalaryDisplay = (contract) => {
    if (!contract) return '₹0'
    const cat = contract.vehicleCategory
    const type = contract.salaryType

    if (cat === 'transport') {
      return `₹${contract.salaryPerMonth || 0}/${t('perMonth2')}`
    }
    if (type === 'hourly') {
      return `₹${contract.salaryPerHour || 0}/${t('perHour2')}`
    }
    if (type === 'monthly') {
      return `₹${contract.salaryPerMonth || 0}/${t('perMonth2')}`
    }
    return `₹${contract.salaryPerDay || 0}/${t('perDay2')}`
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
      return t('hourlyBasis')
    }
    return (contract.salaryPerDay || 0) * dur
  }

  const contractSalaryTypeLabel = (c) => {
    if (!c) return '—'
    if (c.vehicleCategory === 'transport') return t('monthlyTransport')
    if (c.salaryType === 'hourly') return t('perHourLabel')
    if (c.salaryType === 'monthly') return t('perMonthLabel')
    if (c.salaryType === 'daily') return t('perDayLabel')
    return String(c.salaryType || '—')
  }
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [user, setUser] = useState(null)
  const [showResignModal, setShowResignModal] =
    useState(false)
  const [resignForm, setResignForm] = useState({
    reason: '',
    lastWorkingDate: '',
  })
  const [resigning, setResigning] = useState(false)
  const [resignStatus, setResignStatus] =
    useState(null)
  const [terminatedContract, setTerminatedContract] =
    useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    fetchContract()
  }, [])

  useEffect(() => {
    if (contract) {
      setTerminatedContract(null)
    }
  }, [contract])

  useEffect(() => {
    if (
      !contract?._id ||
      !contract.driverSigned ||
      contract.status !== 'active'
    ) {
      setResignStatus(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await getResignRequests()
        const list = res.data?.resigns || []
        const p = list.find(
          (r) =>
            r.status === 'pending' &&
            String(r.contractId?._id || r.contractId) ===
              String(contract._id)
        )
        if (!cancelled) setResignStatus(p || null)
      } catch {
        if (!cancelled) setResignStatus(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [contract?._id, contract?.driverSigned, contract?.status])

  const fetchContract = async () => {
    try {
      setLoading(true)
      const res = await getDriverActiveContract()
      const active = res.data.contract ?? null
      setContract(active)
      if (!active) {
        try {
          const allRes = await getDriverContracts()
          const list = allRes.data?.contracts || []
          const terminated = list
            .filter((c) => c?.status === 'terminated')
            .sort((a, b) => {
              const ta = new Date(a?.updatedAt || a?.createdAt || 0).getTime()
              const tb = new Date(b?.updatedAt || b?.createdAt || 0).getTime()
              return tb - ta
            })[0]
          setTerminatedContract(terminated || null)
        } catch {
          setTerminatedContract(null)
        }
      } else {
        setTerminatedContract(null)
      }
    } catch (err) {
      console.error(err)
      setContract(null)
      setTerminatedContract(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSign = async () => {
    if (!contract?._id) return
    try {
      setSigning(true)
      await signContract(contract._id)
      toast.success(t('contractSignedSuccess'))
      await fetchContract()
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('signError')
      )
    } finally {
      setSigning(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const minResignDate = (() => {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    return t.toISOString().slice(0, 10)
  })()

  const submitResign = async (e) => {
    e.preventDefault()
    if (!resignForm.reason.trim()) {
      toast.error(t('reasonRequired'))
      return
    }
    if (!resignForm.lastWorkingDate) {
      toast.error(t('dateRequired'))
      return
    }
    setResigning(true)
    try {
      await requestResign({
        reason: resignForm.reason.trim(),
        lastWorkingDate: resignForm.lastWorkingDate,
      })
      toast.success(t('resignRequestSent'))
      setShowResignModal(false)
      setResignForm({ reason: '', lastWorkingDate: '' })
      const res = await getResignRequests()
      const list = res.data?.resigns || []
      const p = list.find(
        (r) =>
          r.status === 'pending' &&
          contract?._id &&
          String(r.contractId?._id || r.contractId) ===
            String(contract._id)
      )
      setResignStatus(p || null)
      window.location.reload()
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('resignError')
      )
    } finally {
      setResigning(false)
    }
  }

  const getDaysRemaining = () => {
    if (!contract?.startDate || !contract?.duration) return 0
    const start = new Date(contract.startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + Number(contract.duration))
    const today = new Date()
    const diff = Math.ceil(
      (end - today) / (1000 * 60 * 60 * 24)
    )
    return Math.max(0, diff)
  }

  const duration = Number(contract?.duration) || 0

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="mx-auto max-w-4xl p-4 md:p-6 pb-8">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div
                className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin"
                aria-label={t('loading')}
              />
            </div>
          ) : (
            <>
              {!contract && (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <div className="text-5xl mb-4">🔧</div>
                  {terminatedContract ? (
                    <>
                      <div className="bg-gray-50 rounded-2xl p-6 text-center">
                        <h2 className="text-xl font-semibold text-gray-600">
                          🚪 {t('workEnded2')}
                        </h2>
                        <p className="text-sm text-gray-400 mb-6">
                          {t('resignApproved')}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                          <button
                            type="button"
                            onClick={() => navigate('/driver/jobs')}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700"
                          >
                            {t('findJobs')}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/driver/applications')}
                            className="border border-green-400 text-green-600 px-6 py-3 rounded-xl font-medium hover:bg-green-50"
                          >
                            {t('viewMyApplications')}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-gray-700 mb-2">
                        {t('noActiveJob')}
                      </h2>
                      <p className="text-gray-400 text-sm mb-6">
                        {t('searchAndApply')}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/driver/jobs')}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700"
                      >
                        {t('findJobs')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {contract && !contract.driverSigned && (
                <div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <div className="font-semibold text-yellow-800">
                        {t('joiningLetterReceived')}
                      </div>
                      <div className="text-sm text-yellow-600">
                        {t('readAndSign')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        {t('jobDetailsTitle')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('jobLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.title || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('vehicleLabel2')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.vehicleType || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('salaryTypeLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contractSalaryTypeLabel(contract)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('rateLabel')}
                          </span>
                          <span className="font-bold text-green-700">
                            {getSalaryDisplay(contract)}
                          </span>
                        </div>
                        {contract.hasBhatta &&
                          contract.dailyBhatta > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-500 shrink-0">
                                {t('dailyBhattaLabel2')}
                              </span>
                              <span className="font-medium text-right">
                                ₹{contract.dailyBhatta}/{t('perDay2')}
                              </span>
                            </div>
                          )}
                        {contract.hasHourlyBonus &&
                          contract.salaryPerHour > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-500 shrink-0">
                                {t('hourlyBonusLabel2')}
                              </span>
                              <span className="font-medium text-right">
                                ₹{contract.salaryPerHour}/{t('perHour2')}
                              </span>
                            </div>
                          )}
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('durationLabel3')}
                          </span>
                          <span className="font-medium">
                            {duration} {t('days')}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('startDateLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {formatDate(contract.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('totalEarningsLabel')}
                          </span>
                          <span className="font-bold text-green-700">
                            {typeof getTotalKamayi(contract) ===
                            'string'
                              ? getTotalKamayi(contract)
                              : `₹${getTotalKamayi(contract)}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        {t('ownerDetailsTitle')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('nameLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.name || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('locationLabel2')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.location?.state ||
                              '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('workPlaceLabel')}
                          </span>
                          <span className="font-medium text-right max-w-[60%] break-words">
                            {contract.workLocation || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                    <h3 className="font-semibold text-gray-800 mb-4 text-lg border-b pb-3">
                      📋 {t('contract')}
                    </h3>

                    <div className="bg-gray-50 rounded-xl p-5 font-mono text-sm text-gray-700 leading-relaxed">
                      <div className="text-center font-bold text-base mb-4 font-sans">
                        {t('joiningLetterContract').toUpperCase()}
                      </div>
                      <div className="mb-3">
                        <strong>{t('dateLabel')}:</strong>{' '}
                        {formatDate(contract.createdAt)}
                      </div>
                      <div className="mb-3">
                        <strong>{t('ownerLabel')}:</strong>{' '}
                        {contract.ownerId?.name}
                      </div>
                      <div className="mb-3">
                        <strong>{t('driverLabel')}:</strong>{' '}
                        {contract.driverId?.name || user?.name}
                      </div>
                      <div className="mb-3">
                        <strong>{t('workLabel')}:</strong>{' '}
                        {contract.jobId?.title} —{' '}
                        {contract.jobId?.vehicleType}
                      </div>
                      <div className="mb-3">
                        <strong>{t('locationLabel2')}:</strong>{' '}
                        {contract.workLocation}
                      </div>
                      <div className="mb-3">
                        <strong>{t('startDateLabel')}:</strong>{' '}
                        {formatDate(contract.startDate)}
                      </div>
                      <div className="mb-3">
                        <strong>{t('durationLabel3')}:</strong> {duration}{' '}
                        {t('days')}
                      </div>
                      <div className="mb-3">
                        <strong>{t('salaryTypeLabel')}:</strong>{' '}
                        {contractSalaryTypeLabel(contract)}
                      </div>
                      <div className="mb-3">
                        <strong>{t('rateLabel')}:</strong>{' '}
                        {getSalaryDisplay(contract)}
                      </div>
                      {contract.hasBhatta &&
                        contract.dailyBhatta > 0 && (
                          <div className="mb-3">
                            <span>
                              <strong>{t('dailyBhattaLabel2')}:</strong>
                            </span>{' '}
                            <span>
                              ₹{contract.dailyBhatta}/{t('perDay2')}
                            </span>
                          </div>
                        )}
                      {contract.hasHourlyBonus &&
                        contract.salaryPerHour > 0 && (
                          <div className="mb-3">
                            <span>
                              <strong>{t('hourlyBonusLabel2')}:</strong>
                            </span>{' '}
                            <span>
                              ₹{contract.salaryPerHour}/{t('perHour2')}
                            </span>
                          </div>
                        )}
                      <div className="mb-3">
                        <strong>{t('totalEarningsLabel')}:</strong>{' '}
                        {typeof getTotalKamayi(contract) ===
                        'string'
                          ? getTotalKamayi(contract)
                          : `₹${getTotalKamayi(contract)}`}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <strong>{t('termsLabel2')}:</strong>
                        <div className="mt-2 whitespace-pre-line font-sans">
                          {contract.terms}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <strong>{t('safetyConditions')}:</strong>
                        <div className="mt-2 whitespace-pre-line font-sans">
                          {contract.safetyConditions}
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <div className="text-gray-500 mb-2">
                            {t('ownerSignature')}:
                          </div>
                          <div className="font-bold font-sans">
                            {contract.ownerId?.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-2">
                            {t('driverSignature')}:
                          </div>
                          <div className="text-gray-400 italic font-sans">
                            {t('notSignedYet')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={handleSign}
                      disabled={signing}
                      className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-semibold text-base hover:bg-green-700 disabled:opacity-50"
                    >
                      {signing
                        ? t('signingProgress')
                        : t('signAndStart')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast(t('declineNotAvailable'))
                      }
                      className="px-6 py-4 border border-red-300 text-red-500 rounded-2xl font-medium shrink-0"
                    >
                      {t('declineBtn')}
                    </button>
                  </div>
                </div>
              )}

              {contract && contract.driverSigned && (
                <div>
                  {resignStatus ? (
                    <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="font-semibold text-yellow-900">
                        {t('resignPending')}
                      </p>
                      <p className="mt-1 text-sm text-yellow-800">
                        {t('waitingOwnerApproval')}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        {t('lastWorkingDate')}:{' '}
                        {formatDate(
                          resignStatus.lastWorkingDate
                        )}
                      </p>
                      <p className="text-sm text-gray-700">
                        {t('reasonLabel')}: {resignStatus.reason}
                      </p>
                    </div>
                  ) : null}
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">✅</span>
                      <div>
                        <div className="font-bold text-green-800 text-lg">
                          {t('workInProgressTitle')}
                        </div>
                        <div className="text-sm text-green-600">
                          {getDaysRemaining()} {t('daysRemaining')}
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-bold text-green-700">
                        {typeof getTotalKamayi(contract) ===
                        'string'
                          ? getTotalKamayi(contract)
                          : `₹${getTotalKamayi(contract)}`}
                      </div>
                      <div className="text-xs text-green-600">
                        {t('totalEarningsLabel')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        {t('jobDetailsTitle')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('jobLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.title || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('vehicleLabel2')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.vehicleType || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('salaryTypeLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contractSalaryTypeLabel(contract)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('rateLabel')}
                          </span>
                          <span className="font-bold text-green-700">
                            {getSalaryDisplay(contract)}
                          </span>
                        </div>
                        {contract.hasBhatta &&
                          contract.dailyBhatta > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-500 shrink-0">
                                {t('dailyBhattaLabel2')}
                              </span>
                              <span className="font-medium text-right">
                                ₹{contract.dailyBhatta}/{t('perDay2')}
                              </span>
                            </div>
                          )}
                        {contract.hasHourlyBonus &&
                          contract.salaryPerHour > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-500 shrink-0">
                                {t('hourlyBonusLabel2')}
                              </span>
                              <span className="font-medium text-right">
                                ₹{contract.salaryPerHour}/{t('perHour2')}
                              </span>
                            </div>
                          )}
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('durationLabel3')}
                          </span>
                          <span className="font-medium">
                            {duration} {t('days')}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('startDateLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {formatDate(contract.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('signedOnLabel')}
                          </span>
                          <span className="font-medium text-green-600 text-right">
                            {formatDate(contract.driverSignedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        {t('ownerDetailsTitle')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('nameLabel')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.name || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('locationLabel2')}
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.location?.state ||
                              '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            {t('workPlaceLabel')}
                          </span>
                          <span className="font-medium text-right max-w-[60%] break-words">
                            {contract.workLocation || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                    <div className="no-print flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-semibold text-gray-800 text-lg">
                        📋 {t('contract')}
                      </h3>
                      {contract.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="no-print border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-xl"
                        >
                          {t('viewContract')}
                        </button>
                      )}
                    </div>
                    <div className="print-area bg-gray-50 rounded-xl p-5 font-mono text-sm text-gray-700 leading-relaxed mt-4">
                      <div className="text-center font-bold text-base mb-4 font-sans">
                        {t('joiningLetterContract').toUpperCase()}
                      </div>
                      <div className="mb-2">
                        <strong>{t('dateLabel')}:</strong>{' '}
                        {formatDate(contract.createdAt)}
                      </div>
                      <div className="mb-2">
                        <strong>{t('ownerLabel')}:</strong>{' '}
                        {contract.ownerId?.name}
                      </div>
                      <div className="mb-2">
                        <strong>{t('driverLabel')}:</strong>{' '}
                        {contract.driverId?.name || user?.name}
                      </div>
                      <div className="mb-2">
                        <strong>{t('workLabel')}:</strong>{' '}
                        {contract.jobId?.title} —{' '}
                        {contract.jobId?.vehicleType}
                      </div>
                      <div className="mb-2">
                        <strong>{t('locationLabel2')}:</strong>{' '}
                        {contract.workLocation}
                      </div>
                      <div className="mb-2">
                        <strong>{t('startDateLabel')}:</strong>{' '}
                        {formatDate(contract.startDate)}
                      </div>
                      <div className="mb-2">
                        <strong>{t('durationLabel3')}:</strong> {duration}{' '}
                        {t('days')}
                      </div>
                      <div className="mb-2">
                        <strong>{t('salaryTypeLabel')}:</strong>{' '}
                        {contractSalaryTypeLabel(contract)}
                      </div>
                      <div className="mb-2">
                        <strong>{t('rateLabel')}:</strong>{' '}
                        {getSalaryDisplay(contract)}
                      </div>
                      {contract.hasBhatta &&
                        contract.dailyBhatta > 0 && (
                          <div className="mb-2">
                            <span>
                              <strong>{t('dailyBhattaLabel2')}:</strong>
                            </span>{' '}
                            <span>
                              ₹{contract.dailyBhatta}/{t('perDay2')}
                            </span>
                          </div>
                        )}
                      {contract.hasHourlyBonus &&
                        contract.salaryPerHour > 0 && (
                          <div className="mb-2">
                            <span>
                              <strong>{t('hourlyBonusLabel2')}:</strong>
                            </span>{' '}
                            <span>
                              ₹{contract.salaryPerHour}/{t('perHour2')}
                            </span>
                          </div>
                        )}
                      <div className="mb-2">
                        <strong>{t('totalEarningsLabel')}:</strong>{' '}
                        {typeof getTotalKamayi(contract) ===
                        'string'
                          ? getTotalKamayi(contract)
                          : `₹${getTotalKamayi(contract)}`}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <strong>{t('termsLabel2')}:</strong>
                        <div className="mt-1 whitespace-pre-line font-sans">
                          {contract.terms}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <strong>{t('safetyConditions')}:</strong>
                        <div className="mt-1 whitespace-pre-line font-sans">
                          {contract.safetyConditions}
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <div className="text-gray-500 mb-1">
                            {t('ownerSignature')}:
                          </div>
                          <div className="font-bold text-green-700 font-sans">
                            ✓ {contract.ownerId?.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">
                            {t('driverSignature')}:
                          </div>
                          <div className="font-bold text-green-700 font-sans">
                            ✓{' '}
                            {contract.driverId?.name ||
                              user?.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDate(contract.driverSignedAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/driver/attendance')
                      }
                      className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-green-400 hover:bg-green-50 transition-all"
                    >
                      <div className="text-2xl mb-1">📅</div>
                      <div className="text-sm font-medium text-gray-700">
                        {t('attendance')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/driver/payments')
                      }
                      className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-green-400 hover:bg-green-50 transition-all"
                    >
                      <div className="text-2xl mb-1">💰</div>
                      <div className="text-sm font-medium text-gray-700">
                        {t('payments')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/driver/complaints')
                      }
                      className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-red-300 hover:bg-red-50 transition-all"
                    >
                      <div className="text-2xl mb-1">⚠️</div>
                      <div className="text-sm font-medium text-gray-700">
                        {t('complaintBtn')}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!resignStatus && contract?.status === 'active') setShowResignModal(true)
                      }}
                      disabled={Boolean(resignStatus) || contract?.status !== 'active'}
                      className="bg-white border border-red-200 rounded-2xl p-4 text-center hover:bg-red-50 transition-all"
                    >
                      <div className="text-2xl mb-1">🚪</div>
                      <div className="text-sm font-medium text-red-500">
                        {t('resignBtn')}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {showResignModal ? (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-20">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold text-red-600">
                {t('resignModalTitle')}
              </h2>
              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                ⚠️ {t('resignWarning')}
              </div>
              <form onSubmit={submitResign} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('lastWorkingDayLabel')}
                  </label>
                  <input
                    type="date"
                    required
                    min={minResignDate}
                    value={resignForm.lastWorkingDate}
                    onChange={(e) =>
                      setResignForm((f) => ({
                        ...f,
                        lastWorkingDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('resignReasonLabel')}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={resignForm.reason}
                    onChange={(e) =>
                      setResignForm((f) => ({
                        ...f,
                        reason: e.target.value,
                      }))
                    }
                    placeholder={t('resignReasonPlaceholder')}
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resigning}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {resigning
                    ? t('sendingProgress')
                    : t('sendResignRequest')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResignModal(false)}
                  className="mt-2 w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
                >
                  {t('cancel')}
                </button>
              </form>
            </div>
          </div>
        ) : null}
    </div>
  )
}

export default ActiveJob
