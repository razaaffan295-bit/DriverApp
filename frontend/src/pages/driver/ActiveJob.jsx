import { useState, useEffect } from 'react'
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
      toast.success('Sign kar diya! Kaam shuru ho gaya!')
      await fetchContract()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Sign nahi hua'
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
      toast.error('Reason likhein')
      return
    }
    if (!resignForm.lastWorkingDate) {
      toast.error('Date chunein')
      return
    }
    setResigning(true)
    try {
      await requestResign({
        reason: resignForm.reason.trim(),
        lastWorkingDate: resignForm.lastWorkingDate,
      })
      toast.success(
        'Resign request bhej di! Owner approve karega.'
      )
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
        err.response?.data?.message || 'Nahi hua'
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

  const salary = Number(contract?.salaryPerDay) || 0
  const duration = Number(contract?.duration) || 0
  const totalKamayi = salary * duration

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl p-4 md:p-6 pb-8">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div
                className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin"
                aria-hidden
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
                          🚪 Aapka Kaam Khatam Ho Gaya
                        </h2>
                        <p className="text-sm text-gray-400 mb-6">
                          Resign approve ho gayi thi
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                          <button
                            type="button"
                            onClick={() => navigate('/driver/jobs')}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700"
                          >
                            Naya Kaam Dhundho
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/driver/applications')}
                            className="border border-green-400 text-green-600 px-6 py-3 rounded-xl font-medium hover:bg-green-50"
                          >
                            Meri Applications Dekho
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold text-gray-700 mb-2">
                        Abhi koi active kaam nahi hai
                      </h2>
                      <p className="text-gray-400 text-sm mb-6">
                        Jobs dhundho aur apply karo
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/driver/jobs')}
                        className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700"
                      >
                        Jobs Dhundho
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
                        Joining Letter Aaya Hai!
                      </div>
                      <div className="text-sm text-yellow-600">
                        Padh ke sign karein — tabhi kaam shuru
                        hoga
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        Job Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Job
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.title || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Vehicle
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.vehicleType || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Salary
                          </span>
                          <span className="font-bold text-green-700">
                            ₹{salary}/din
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Duration
                          </span>
                          <span className="font-medium">
                            {duration} din
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Start Date
                          </span>
                          <span className="font-medium text-right">
                            {formatDate(contract.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Total Kamayi
                          </span>
                          <span className="font-bold text-green-700">
                            ₹{totalKamayi}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        Owner Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Naam
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.name || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Location
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.location?.state ||
                              '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Kaam ki Jagah
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
                      📋 Joining Letter
                    </h3>

                    <div className="bg-gray-50 rounded-xl p-5 font-mono text-sm text-gray-700 leading-relaxed">
                      <div className="text-center font-bold text-base mb-4 font-sans">
                        JOINING LETTER
                      </div>
                      <div className="mb-3">
                        <strong>Date:</strong>{' '}
                        {formatDate(contract.createdAt)}
                      </div>
                      <div className="mb-3">
                        <strong>Owner:</strong>{' '}
                        {contract.ownerId?.name}
                      </div>
                      <div className="mb-3">
                        <strong>Driver:</strong>{' '}
                        {contract.driverId?.name || user?.name}
                      </div>
                      <div className="mb-3">
                        <strong>Kaam:</strong>{' '}
                        {contract.jobId?.title} —{' '}
                        {contract.jobId?.vehicleType}
                      </div>
                      <div className="mb-3">
                        <strong>Location:</strong>{' '}
                        {contract.workLocation}
                      </div>
                      <div className="mb-3">
                        <strong>Start Date:</strong>{' '}
                        {formatDate(contract.startDate)}
                      </div>
                      <div className="mb-3">
                        <strong>Duration:</strong> {duration}{' '}
                        din
                      </div>
                      <div className="mb-3">
                        <strong>Salary:</strong> ₹{salary}/din
                      </div>
                      <div className="mb-3">
                        <strong>Total Kamayi:</strong> ₹
                        {totalKamayi}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <strong>Shartein:</strong>
                        <div className="mt-2 whitespace-pre-line font-sans">
                          {contract.terms}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <strong>Safety Conditions:</strong>
                        <div className="mt-2 whitespace-pre-line font-sans">
                          {contract.safetyConditions}
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <div className="text-gray-500 mb-2">
                            Owner Signature:
                          </div>
                          <div className="font-bold font-sans">
                            {contract.ownerId?.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-2">
                            Driver Signature:
                          </div>
                          <div className="text-gray-400 italic font-sans">
                            Abhi sign nahi kiya
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
                        ? 'Sign ho raha hai...'
                        : '✅ Sign Karo aur Kaam Shuru Karein'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toast('Abhi decline feature available nahi hai')
                      }
                      className="px-6 py-4 border border-red-300 text-red-500 rounded-2xl font-medium shrink-0"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {contract && contract.driverSigned && (
                <div>
                  {resignStatus ? (
                    <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="font-semibold text-yellow-900">
                        ⏳ Resign Request Pending
                      </p>
                      <p className="mt-1 text-sm text-yellow-800">
                        Owner ke approve karne ka wait hai
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        Last Working Date:{' '}
                        {formatDate(
                          resignStatus.lastWorkingDate
                        )}
                      </p>
                      <p className="text-sm text-gray-700">
                        Reason: {resignStatus.reason}
                      </p>
                    </div>
                  ) : null}
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">✅</span>
                      <div>
                        <div className="font-bold text-green-800 text-lg">
                          Kaam Chal Raha Hai!
                        </div>
                        <div className="text-sm text-green-600">
                          {getDaysRemaining()} din baaki hain
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-bold text-green-700">
                        ₹{totalKamayi}
                      </div>
                      <div className="text-xs text-green-600">
                        Total Kamayi
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        Job Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Job
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.title || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Vehicle
                          </span>
                          <span className="font-medium text-right">
                            {contract.jobId?.vehicleType || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Salary
                          </span>
                          <span className="font-bold text-green-700">
                            ₹{salary}/din
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Duration
                          </span>
                          <span className="font-medium">
                            {duration} din
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Start Date
                          </span>
                          <span className="font-medium text-right">
                            {formatDate(contract.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Signed On
                          </span>
                          <span className="font-medium text-green-600 text-right">
                            {formatDate(contract.driverSignedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-semibold text-gray-700 mb-3">
                        Owner Details
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Naam
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.name || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Location
                          </span>
                          <span className="font-medium text-right">
                            {contract.ownerId?.location?.state ||
                              '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500 shrink-0">
                            Kaam ki Jagah
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
                        📋 Signed Joining Letter
                      </h3>
                      {contract.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="no-print border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-xl"
                        >
                          Joining Letter PDF Download
                        </button>
                      )}
                    </div>
                    <div className="print-area bg-gray-50 rounded-xl p-5 font-mono text-sm text-gray-700 leading-relaxed mt-4">
                      <div className="text-center font-bold text-base mb-4 font-sans">
                        JOINING LETTER
                      </div>
                      <div className="mb-2">
                        <strong>Date:</strong>{' '}
                        {formatDate(contract.createdAt)}
                      </div>
                      <div className="mb-2">
                        <strong>Owner:</strong>{' '}
                        {contract.ownerId?.name}
                      </div>
                      <div className="mb-2">
                        <strong>Driver:</strong>{' '}
                        {contract.driverId?.name || user?.name}
                      </div>
                      <div className="mb-2">
                        <strong>Kaam:</strong>{' '}
                        {contract.jobId?.title} —{' '}
                        {contract.jobId?.vehicleType}
                      </div>
                      <div className="mb-2">
                        <strong>Location:</strong>{' '}
                        {contract.workLocation}
                      </div>
                      <div className="mb-2">
                        <strong>Start Date:</strong>{' '}
                        {formatDate(contract.startDate)}
                      </div>
                      <div className="mb-2">
                        <strong>Salary:</strong> ₹{salary}/din
                      </div>
                      <div className="mb-2">
                        <strong>Duration:</strong> {duration}{' '}
                        din
                      </div>
                      <div className="mb-2">
                        <strong>Total Kamayi:</strong> ₹
                        {totalKamayi}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <strong>Shartein:</strong>
                        <div className="mt-1 whitespace-pre-line font-sans">
                          {contract.terms}
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <strong>Safety Conditions:</strong>
                        <div className="mt-1 whitespace-pre-line font-sans">
                          {contract.safetyConditions}
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div>
                          <div className="text-gray-500 mb-1">
                            Owner Signature:
                          </div>
                          <div className="font-bold text-green-700 font-sans">
                            ✓ {contract.ownerId?.name}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">
                            Driver Signature:
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
                        Attendance
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
                        Payment
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
                        Complaint
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
                        Resign
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
                Resign Request Bhejo
              </h2>
              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                ⚠️ Resign approve hone ke baad aap is kaam
                se hat jayenge aur naya kaam dhundh sakte
                hain.
              </div>
              <form onSubmit={submitResign} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Aakhri Din Kab Kaam Karenge?
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
                    Resign Kyun Kar Rahe Ho?
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
                    placeholder="Reason batayein..."
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resigning}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {resigning
                    ? 'Bhej raha hai...'
                    : 'Resign Request Bhejo'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResignModal(false)}
                  className="mt-2 w-full rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        ) : null}
    </div>
  )
}

export default ActiveJob
