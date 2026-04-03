import { useState, useEffect, useCallback } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  MdDashboard,
  MdDirectionsCar,
  MdPostAdd,
  MdAssignment,
  MdGroups,
  MdCalendarMonth,
  MdPayments,
  MdWarning,
  MdStar,
  MdSettings,
  MdHome,
  MdWork,
  MdPerson,
  MdChat,
} from 'react-icons/md'
import { clearAuth } from '../../utils/helpers'
import { getOwnerContracts } from '../../api/contractAPI'
import {
  getResignRequests,
  handleResign,
} from '../../api/resignAPI'

const navInactive =
  'flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50'
const navActive =
  'flex items-center gap-3 px-6 py-3 text-sm font-medium border-r-2 border-blue-700 bg-blue-50 text-blue-700'

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/owner/dashboard', Icon: MdDashboard },
  { id: 'profile', label: 'Profile', to: '/owner/profile', Icon: MdPerson },
  {
    id: 'vehicles',
    label: 'Meri Gadiyaan',
    to: '/owner/profile?tab=vehicles',
    Icon: MdDirectionsCar,
  },
  { id: 'post-job', label: 'Job Post Karo', to: '/owner/post-job', Icon: MdPostAdd },
  { id: 'my-jobs', label: 'Meri Jobs', to: '/owner/jobs', Icon: MdWork },
  { id: 'applications', label: 'Applications', to: '/owner/applications', Icon: MdAssignment },
  { id: 'messages', label: 'Messages', to: '/owner/messages', Icon: MdChat },
  { id: 'drivers', label: 'Mere Drivers', to: '/owner/drivers', Icon: MdGroups },
  { id: 'attendance', label: 'Attendance', to: '/owner/attendance', Icon: MdCalendarMonth },
  { id: 'payments', label: 'Payments', to: '/owner/payments', Icon: MdPayments },
  { id: 'complaints', label: 'Complaints', to: '/owner/complaints', Icon: MdWarning },
  { id: 'ratings', label: 'Ratings', to: '/owner/ratings', Icon: MdStar },
  { id: 'settings', label: 'Settings', Icon: MdSettings },
]

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const MyDrivers = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [resigns, setResigns] = useState([])
  const [handlingId, setHandlingId] = useState(null)
  const [actionId, setActionId] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [actionText, setActionText] = useState('')

  const profileNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') !== 'vehicles'
  const vehiclesNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') === 'vehicles'

  const placeholderNav = () => {
    // no placeholder toasts in navigation
  }

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
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [])

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

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logout ho gaye!')
  }

  const onSubmitAction = async () => {
    if (!actionId || !actionType) return
    if (actionType === 'rejected' && !actionText.trim()) {
      toast.error('Reject karne ki wajah likhein')
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
          ? 'Resign approve ho gayi!'
          : 'Resign reject kar di'
      )
      setActionId(null)
      setActionType(null)
      setActionText('')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Nahi hua'
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
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : activeContracts.length === 0 ? (
            <p className="text-center text-gray-500">
              Koi active driver / contract nahi
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
                        🚪 {d?.name || 'Driver'} ne Resign
                        Kiya!
                      </p>
                      <p className="mt-2 text-sm text-gray-700">
                        Last Working Date:{' '}
                        {fmtDate(pending.lastWorkingDate)}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        Reason: {pending.reason}
                      </p>
                      {actionId === pending._id ? (
                        <div className="mt-4">
                          <label className="text-sm font-medium text-gray-700">
                            {actionType === 'approved'
                              ? 'Koi message driver ko...'
                              : 'Reject karne ki wajah...'}
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
                              ? 'Approve Karo'
                              : 'Reject Karo'}
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
                            Cancel
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
                              : 'Approve Karo'}
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
                            Reject Karo
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div
                    className="rounded-2xl border border-gray-100 bg-white p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
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
                          {d?.name || 'Driver'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {d?.phone}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {c.jobId?.title} ·{' '}
                          {c.jobId?.vehicleType}
                        </p>
                        <p className="text-xs text-gray-500">
                          Start Date: {fmtDate(c.startDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Status: {c.status} · ₹
                          {c.salaryPerDay}/din · {c.duration}{' '}
                          din
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
                Purane Resign Requests
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
                          {r.driverId?.name || 'Driver'}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Last working date: {fmtDate(r.lastWorkingDate)}
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
                        Owner response: {r.ownerResponse}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-gray-400">
                        Owner response: —
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
