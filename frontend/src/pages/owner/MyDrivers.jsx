import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { getOwnerContracts } from '../../api/contractAPI'
import {
  getResignRequests,
  handleResign,
} from '../../api/resignAPI'

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const MyDrivers = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [resigns, setResigns] = useState([])
  const [handlingId, setHandlingId] = useState(null)
  const [actionId, setActionId] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [actionText, setActionText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, rRes] = await Promise.all([
        getOwnerContracts(),
        getResignRequests(),
      ])
      const list = (cRes.data?.contracts || []).filter((c) =>
        ['active', 'signed', 'completed', 'terminated'].includes(
          c.status
        )
      )
      setContracts(list)
      setResigns(rRes.data?.resigns || [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('myDriversLoadError')
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const pendingByContract = useCallback(
    (contractId) =>
      resigns.find(
        (r) =>
          r.status === 'pending' &&
          String(r.contractId?._id || r.contractId) ===
            String(contractId)
      ),
    [resigns]
  )

  const onSubmitAction = async () => {
    if (!actionId || !actionType) return
    if (actionType === 'rejected' && !actionText.trim()) {
      toast.error(t('rejectReasonRequired'))
      return
    }
    setHandlingId(actionId)
    try {
      await handleResign({
        resignId: actionId,
        action: actionType,
        response: actionText.trim(),
      })
      toast.success(
        actionType === 'approved'
          ? t('resignApprovedMsg')
          : t('resignRejectedMsg')
      )
      setActionId(null)
      setActionType(null)
      setActionText('')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('resignHandleError')
      )
    } finally {
      setHandlingId(null)
    }
  }

  const activeContracts = contracts.filter((c) =>
    ['active', 'signed'].includes(c.status)
  )

  const historyResigns = resigns.filter((r) =>
    ['approved', 'rejected'].includes(r.status)
  )

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
      aria-label={t('myDrivers')}
    >
        <div className="mx-auto max-w-2xl px-4 py-6">
          {loading ? (
            <div
              className="flex justify-center py-16"
              role="status"
              aria-label={t('loading')}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : activeContracts.length === 0 ? (
            <p className="text-center text-gray-500">
              {t('noData')}
            </p>
          ) : (
            activeContracts.map((c) => {
              const d = c.driverId
              const pending = pendingByContract(c._id)
              return (
                <div key={c._id} className="mb-6">
                  {pending ? (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-5">
                      <p className="font-semibold text-red-900">
                        🚪 {d?.name || t('driver')}{' '}
                        {t('driverResigned')}
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        {t('lastWorkingDateLabel')}:{' '}
                        {fmtDate(pending.lastWorkingDate)}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {t('reasonLabel3')}: {pending.reason}
                      </p>
                      {actionId === pending._id ? (
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">
                            {actionType === 'approved'
                              ? t('messageToDriver')
                              : t('rejectReasonLabel2')}
                          </label>
                          <textarea
                            rows={3}
                            value={actionText}
                            onChange={(e) =>
                              setActionText(e.target.value)
                            }
                            className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
                          />
                          <button
                            type="button"
                            disabled={
                              handlingId === pending._id
                            }
                            onClick={onSubmitAction}
                            className={`mt-2 w-full rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                              actionType === 'approved'
                                ? 'bg-green-600'
                                : 'bg-red-600'
                            }`}
                          >
                            {actionType === 'approved'
                              ? t('approveResignBtn')
                              : t('rejectResignBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionId(null)
                              setActionType(null)
                              setActionText('')
                            }}
                            className="mt-2 w-full text-sm text-gray-500"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              handlingId === pending._id
                            }
                            onClick={() =>
                              (setActionId(pending._id),
                              setActionType('approved'),
                              setActionText(''))
                            }
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {handlingId === pending._id
                              ? '…'
                              : t('approveResignBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionId(pending._id)
                              setActionType('rejected')
                              setActionText('')
                            }}
                            className="rounded-xl border border-red-400 px-4 py-2 text-sm font-medium text-red-500"
                          >
                            {t('rejectResignBtn')}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div
                    className="rounded-2xl border border-gray-100 bg-white p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                    aria-label={t('contract')}
                    onClick={() => navigate(`/owner/driver-detail/${c.driverId?._id || c.driverId}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                        {d?.name
                          ?.split(/\s+/)
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'D'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {d?.name || t('driver')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {d?.phone}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {c.jobId?.title} ·{' '}
                          {c.jobId?.vehicleType}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('startDateLabel3')}: {fmtDate(c.startDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t('status')}:{' '}
                          {c.status === 'active' ? t('active') : c.status} ·{' '}
                          {c.salaryType === 'monthly'
                            ? `₹${c.salaryPerMonth || 0}/${t('perMonth')}`
                            : c.salaryType === 'hourly'
                              ? `₹${c.salaryPerHour || 0}/${t('perHour')}`
                              : `₹${c.salaryPerDay || 0}/${t('perDay')}`} ·{' '}
                          {c.duration} {t('days')}
                        </p>
                      </div>
                    </div>
                      <div className="text-gray-400 text-lg">→</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}

          {!loading && historyResigns.length > 0 ? (
            <div className="mt-10">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">
                {t('oldResignRequests')}
              </h2>
              <div className="space-y-3">
                {historyResigns.map((r) => (
                  <div
                    key={r._id}
                    className="rounded-2xl border border-gray-100 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {r.driverId?.name || t('driver')}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {t('lastWorkingDateLabel2')}: {fmtDate(r.lastWorkingDate)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          r.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    {r.ownerResponse ? (
                      <p className="mt-2 text-sm text-gray-700">
                        {t('ownerResponseLabel')}: {r.ownerResponse}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400">
                        {t('ownerResponseLabel')}: —
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
    </div>
  )
}

export default MyDrivers
