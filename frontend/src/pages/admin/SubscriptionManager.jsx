import { useEffect, useState, useCallback } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  MdDashboard,
  MdPeople,
  MdWork,
  MdWarning,
  MdSubscriptions,
  MdAttachMoney,
  MdLogout,
} from 'react-icons/md'
import { clearAuth } from '../../utils/helpers'
import {
  getFreeTrialUsers,
  requireSubscription,
  extendFreeTrial,
  setPermanentFree,
  removePermanentFree,
} from '../../api/adminSubscriptionAPI'

const sidebarInactive =
  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-purple-100/90 hover:bg-white/10'
const sidebarActive =
  'flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white'

const CATEGORY_BADGE = {
  permanent_free: 'bg-purple-100 text-purple-800',
  paid: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  expiring: 'bg-orange-100 text-orange-700',
  expiring_soon: 'bg-yellow-100 text-yellow-800',
  free: 'bg-blue-100 text-blue-700',
}

const CATEGORY_LABEL = {
  permanent_free: '♾️ Permanent Free',
  paid: '✅ Paid',
  expired: '❌ Expired',
  expiring: '🔴 Expiring',
  expiring_soon: '🟡 Expiring Soon',
  free: '🟢 Free Trial',
}

const SubscriptionManager = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showDaysModal, setShowDaysModal] = useState(null)
  const [daysInput, setDaysInput] = useState('5')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFreeTrialUsers()
      setUsers(res.data?.users || [])
    } catch (e) {
      toast.error(e.response?.data?.message || 'Load nahi hua')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
    toast.success('Logout ho gaye!')
  }

  const handleRequire = async (userId, days) => {
    setActionId(userId)
    try {
      await requireSubscription(userId, Number(days))
      toast.success(`Subscription required — ${days} din deadline`)
      setShowDaysModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Nahi hua')
    } finally {
      setActionId(null)
    }
  }

  const handleExtend = async (userId) => {
    setActionId(userId)
    try {
      await extendFreeTrial(userId, 15)
      toast.success('15 din extend kiya!')
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Nahi hua')
    } finally {
      setActionId(null)
    }
  }

  const handlePermanentFree = async (userId) => {
    setActionId(userId)
    try {
      await setPermanentFree(userId)
      toast.success('Permanent free set kiya!')
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Nahi hua')
    } finally {
      setActionId(null)
    }
  }

  const handleRemovePermanentFree = async (userId) => {
    setActionId(userId)
    try {
      await removePermanentFree(userId)
      toast.success('Permanent free hataya!')
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Nahi hua')
    } finally {
      setActionId(null)
    }
  }

  const filtered = users.filter((u) => {
    const matchFilter = filter === 'all' || u.category === filter
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search)
    return matchFilter && matchSearch
  })

  const stats = {
    total: users.length,
    free: users.filter((u) => u.category === 'free').length,
    expiringSoon: users.filter(
      (u) => u.category === 'expiring_soon' || u.category === 'expiring'
    ).length,
    expired: users.filter((u) => u.category === 'expired').length,
    paid: users.filter((u) => u.category === 'paid').length,
    permanentFree: users.filter(
      (u) => u.category === 'permanent_free'
    ).length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3FF' }}>
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-gradient-to-b from-violet-900 to-purple-950 shadow-xl md:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <span className="text-lg font-bold text-white">
            Admin Panel
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdDashboard className="h-5 w-5 shrink-0" />
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Users
          </NavLink>
          <NavLink
            to="/admin/complaints"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdWarning className="h-5 w-5 shrink-0" />
            Complaints
          </NavLink>
          <NavLink
            to="/admin/subscriptions"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdSubscriptions className="h-5 w-5 shrink-0" />
            Subscriptions
          </NavLink>
          <NavLink
            to="/admin/subscription-manager"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdAttachMoney className="h-5 w-5 shrink-0" />
            Subscription Manager
          </NavLink>
        </nav>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-64 md:px-6">
        <h1 className="text-lg font-semibold text-gray-800">
          Subscription Manager
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-800 sm:inline">
            DriverApp Admin
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm font-medium text-red-600"
          >
            <MdLogout className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="min-h-screen pb-24 pt-16 md:ml-64 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-6">

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {[
              { label: 'Total', value: stats.total, color: 'bg-gray-50' },
              { label: 'Free Trial', value: stats.free, color: 'bg-blue-50' },
              { label: 'Expiring', value: stats.expiringSoon, color: 'bg-yellow-50' },
              { label: 'Expired', value: stats.expired, color: 'bg-red-50' },
              { label: 'Paid', value: stats.paid, color: 'bg-green-50' },
              { label: 'Perm Free', value: stats.permanentFree, color: 'bg-purple-50' },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl ${s.color} p-3 text-center`}
              >
                <p className="text-xl font-bold text-gray-900">
                  {s.value}
                </p>
                <p className="text-xs text-gray-600">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { id: 'all', label: 'All' },
                { id: 'free', label: '🟢 Free Trial' },
                { id: 'expiring_soon', label: '🟡 Expiring Soon' },
                { id: 'expiring', label: '🔴 Expiring' },
                { id: 'expired', label: '❌ Expired' },
                { id: 'paid', label: '✅ Paid' },
                { id: 'permanent_free', label: '♾️ Perm Free' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                    filter === f.id
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <p className="mb-3 text-sm text-gray-600">
            {filtered.length} users
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((u) => (
                <div
                  key={u._id}
                  className="rounded-2xl border border-gray-100 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {u.name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.role === 'owner'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            CATEGORY_BADGE[u.category]
                          }`}
                        >
                          {CATEGORY_LABEL[u.category]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {u.phone}
                      </p>
                      <p className="text-xs text-gray-400">
                        Joined {u.daysSinceJoin} days ago
                        {u.daysLeft > 0
                          ? ` · ${u.daysLeft} days left in trial`
                          : ' · Trial ended'}
                      </p>
                      {u.subscriptionDeadline && (
                        <p className="text-xs text-red-500">
                          Deadline:{' '}
                          {new Date(
                            u.subscriptionDeadline
                          ).toLocaleDateString('en-IN')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {u.isPermanentFree ? (
                        <button
                          type="button"
                          disabled={actionId === u._id}
                          onClick={() =>
                            handleRemovePermanentFree(u._id)
                          }
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 disabled:opacity-50"
                        >
                          Remove Perm Free
                        </button>
                      ) : (
                        <>
                          {!u.isSubscribed && (
                            <button
                              type="button"
                              disabled={actionId === u._id}
                              onClick={() => {
                                setShowDaysModal(u._id)
                                setDaysInput('5')
                              }}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Require Sub
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={actionId === u._id}
                            onClick={() => handleExtend(u._id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            +15 Days Free
                          </button>
                          <button
                            type="button"
                            disabled={actionId === u._id}
                            onClick={() =>
                              handlePermanentFree(u._id)
                            }
                            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Perm Free
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {showDaysModal === u._id && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-4">
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Kitne din mein deadline set karein?
                      </p>
                      <div className="flex gap-2">
                        {[3, 5, 7, 10].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDaysInput(String(d))}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                              daysInput === String(d)
                                ? 'bg-purple-700 text-white'
                                : 'bg-white border border-gray-200 text-gray-600'
                            }`}
                          >
                            {d} din
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={daysInput}
                          onChange={(e) =>
                            setDaysInput(e.target.value)
                          }
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={actionId === u._id}
                          onClick={() =>
                            handleRequire(u._id, daysInput)
                          }
                          className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDaysModal(null)}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default SubscriptionManager

