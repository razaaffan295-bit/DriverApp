import { useEffect, useState, useCallback } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
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
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import {
  getUsers,
  blockUser,
  unblockUser,
  verifyUser,
} from '../../api/adminAPI'

const sidebarInactive =
  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-purple-100/90 hover:bg-white/10'
const sidebarActive =
  'flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white'

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const AdminUsers = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const roleFromUrl =
    searchParams.get('role') === 'owner' ||
    searchParams.get('role') === 'driver'
      ? searchParams.get('role')
      : ''

  const [stateFilter, setStateFilter] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState({
    role: roleFromUrl,
    state: '',
    vehicleType: '',
    search: '',
  })

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [blockTarget, setBlockTarget] = useState(null)
  const [blockDuration, setBlockDuration] = useState('30')
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page: 1,
        limit: 50,
      }
      if (applied.role) params.role = applied.role
      if (applied.state) params.state = applied.state
      if (applied.vehicleType) params.vehicleType = applied.vehicleType
      if (applied.search.trim()) params.search = applied.search.trim()

      const res = await getUsers(params)
      setUsers(res.data?.users ?? [])
      setTotal(res.data?.total ?? 0)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setApplied((prev) => ({ ...prev, role: roleFromUrl }))
  }, [roleFromUrl])

  const applyFilters = () => {
    setApplied({
      role: roleFromUrl,
      state: stateFilter,
      vehicleType,
      search,
    })
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
    toast.success('Logout ho gaye!')
  }

  const onBlock = async () => {
    if (!blockTarget || !blockReason.trim()) {
      toast.error('Reason likhein')
      return
    }
    setBlocking(true)
    try {
      const body = {
        userId: blockTarget._id,
        reason: blockReason.trim(),
      }
      if (blockDuration === '30') body.blockDays = 30
      else if (blockDuration === '90') body.blockDays = 90
      await blockUser(body)
      toast.success('User block ho gaya!')
      setBlockTarget(null)
      setBlockReason('')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Block nahi hua'
      )
    } finally {
      setBlocking(false)
    }
  }

  const onUnblock = async (userId) => {
    try {
      await unblockUser({ userId })
      toast.success('User unblock ho gaya!')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Nahi hua'
      )
    }
  }

  const onVerify = async (userId) => {
    try {
      await verifyUser({ userId })
      toast.success('User verify ho gaya!')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Nahi hua'
      )
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F5F3FF' }}
    >
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
            end
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Saare Users
          </NavLink>
          <NavLink
            to="/admin/users?role=owner"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Owners
          </NavLink>
          <NavLink
            to="/admin/users?role=driver"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Drivers
          </NavLink>
          <Link to="/admin/dashboard" className={sidebarInactive}>
            <MdWork className="h-5 w-5 shrink-0" />
            Jobs
          </Link>
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
          <Link to="/admin/subscriptions" className={sidebarInactive}>
            <MdAttachMoney className="h-5 w-5 shrink-0" />
            Revenue
          </Link>
        </nav>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-64 md:px-6">
        <h1 className="text-lg font-semibold text-gray-800">
          Users
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
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/users')}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  !roleFromUrl
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Sab
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/admin/users?role=owner')
                }
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  roleFromUrl === 'owner'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/admin/users?role=driver')
                }
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  roleFromUrl === 'driver'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Driver
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  State
                </label>
                <select
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Sab</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Sab</option>
                  {VEHICLE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Naam ya phone..."
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={applyFilters}
              className="mt-4 w-full rounded-xl bg-purple-700 py-2.5 text-sm font-semibold text-white sm:w-auto sm:px-8"
            >
              Filter Lagao
            </button>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {total} users mile
          </p>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {users.map((u) => {
                const initials =
                  u.name
                    ?.split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || '?'
                return (
                  <li
                    key={u._id}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-800">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {u.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {u.phone}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.role === 'owner'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        <p className="mt-1 text-xs text-gray-500">
                          {u.location?.state},{' '}
                          {u.location?.district}
                        </p>
                        <p className="text-xs text-gray-400">
                          Join: {fmtDate(u.createdAt)}
                        </p>
                        {u.vehicles?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {u.vehicles.map((v) => (
                              <span
                                key={`${v._id}-${v.vehicleNumber}`}
                                className="rounded-md bg-gray-100 px-2 py-0.5 text-xs"
                              >
                                {v.vehicleType}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {u.driverProfile?.skills?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {u.driverProfile.skills.map((sk) => (
                              <span
                                key={sk}
                                className="rounded-md bg-gray-100 px-2 py-0.5 text-xs"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.isBlocked
                              ? 'bg-red-100 text-red-600'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {u.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                        {u.isVerified ? (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!u.isVerified && u.role !== 'admin' ? (
                          <button
                            type="button"
                            onClick={() => onVerify(u._id)}
                            className="rounded-lg bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700"
                          >
                            Verify Karo
                          </button>
                        ) : null}
                        {!u.isBlocked && u.role !== 'admin' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setBlockTarget(u)
                              setBlockDuration('30')
                              setBlockReason('')
                            }}
                            className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-500"
                          >
                            Block Karo
                          </button>
                        ) : null}
                        {u.isBlocked ? (
                          <button
                            type="button"
                            onClick={() => onUnblock(u._id)}
                            className="rounded-lg bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                          >
                            Unblock Karo
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      {blockTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              User ko Block Karo
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {blockTarget.name}
            </p>
            <p className="mt-4 text-sm font-medium text-gray-700">
              Block Duration
            </p>
            <div className="mt-2 space-y-2">
              {[
                { id: '30', label: '30 din' },
                { id: '90', label: '90 din' },
                { id: 'perm', label: 'Permanent ban' },
              ].map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="bd"
                    checked={blockDuration === o.id}
                    onChange={() => setBlockDuration(o.id)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Reason
            </label>
            <textarea
              rows={3}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Block karne ki wajah..."
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={blocking}
                onClick={onBlock}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {blocking ? '…' : 'Block Karo'}
              </button>
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AdminUsers
