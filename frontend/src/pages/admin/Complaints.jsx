import { useEffect, useState, useCallback } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
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
import { STATES } from '../../utils/constants'
import {
  getAllComplaints,
  resolveComplaint,
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

const TYPE_STYLES = {
  part_chori: 'bg-red-100 text-red-700',
  payment_nahi_diya: 'bg-yellow-100 text-yellow-800',
  kaam_choda: 'bg-orange-100 text-orange-800',
  machine_damage: 'bg-amber-100 text-amber-800',
  attendance_fraud: 'bg-orange-100 text-orange-700',
  zyada_kaam: 'bg-amber-100 text-amber-900',
  unsafe_conditions: 'bg-red-50 text-red-800',
  misbehavior: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-700',
}

const TYPE_LABEL = {
  part_chori: 'Part Chori',
  payment_nahi_diya: 'Payment',
  kaam_choda: 'Kaam Choda',
  machine_damage: 'Machine Damage',
  attendance_fraud: 'Attendance Fraud',
  zyada_kaam: 'Zyada Kaam',
  unsafe_conditions: 'Unsafe',
  misbehavior: 'Misbehavior',
  other: 'Other',
}

const STATUS_BADGE = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-600',
}

const AdminComplaints = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState({
    status: '',
    state: '',
    search: '',
  })

  const [complaints, setComplaints] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [resolveId, setResolveId] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const [action, setAction] = useState('no_action')
  const [blockDays, setBlockDays] = useState(30)
  const [resolving, setResolving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: 1, limit: 100 }
      if (applied.status) params.status = applied.status
      if (applied.state) params.state = applied.state
      if (applied.search.trim()) params.search = applied.search.trim()
      const res = await getAllComplaints(params)
      setComplaints(res.data?.complaints ?? [])
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

  const applyFilters = () => {
    setApplied({
      status,
      state: stateFilter,
      search,
    })
  }

  const handleLogout = () => {
    clearAuth()
    navigate('/admin/login')
    toast.success('Logout ho gaye!')
  }

  const onActionChange = (v) => {
    setAction(v)
    if (v === 'blocked_30days') setBlockDays(30)
    if (v === 'blocked_90days') setBlockDays(90)
  }

  const submitResolve = async () => {
    if (!adminNote.trim()) {
      toast.error('Admin note zaroori hai')
      return
    }
    setResolving(true)
    try {
      await resolveComplaint({
        complaintId: resolveId,
        action,
        adminNote: adminNote.trim(),
        blockDays:
          action === 'blocked_30days' ||
          action === 'blocked_90days'
            ? blockDays
            : undefined,
      })
      toast.success('Complaint resolve ho gayi!')
      setResolveId(null)
      setAdminNote('')
      setAction('no_action')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Nahi hua'
      )
    } finally {
      setResolving(false)
    }
  }

  const truncate = (s, n) => {
    const t = String(s || '')
    return t.length <= n ? t : `${t.slice(0, n)}…`
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            end
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
          Complaints
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
              {[
                { id: '', label: 'Sab' },
                { id: 'pending', label: 'Pending' },
                { id: 'under_review', label: 'Under Review' },
                { id: 'resolved', label: 'Resolved' },
                { id: 'rejected', label: 'Rejected' },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setStatus(t.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium sm:text-sm ${
                    status === t.id
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3 sm:flex sm:gap-3">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:mt-0 sm:max-w-xs"
              >
                <option value="">Sab states</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description..."
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:mt-0"
              />
            </div>
            <button
              type="button"
              onClick={applyFilters}
              className="mt-3 rounded-xl bg-purple-700 px-6 py-2 text-sm font-semibold text-white"
            >
              Filter Lagao
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            {total} complaints
          </p>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {complaints.map((c) => {
                const isEx = expanded[c._id]
                const pending = c.status === 'pending'
                return (
                  <li
                    key={c._id}
                    className={`rounded-2xl border border-gray-100 bg-white p-5 ${
                      pending ? 'border-l-4 border-l-red-400' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            TYPE_STYLES[c.type] ||
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {TYPE_LABEL[c.type] || c.type}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            STATUS_BADGE[c.status] ||
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {fmtDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-800">
                      Complaint By:{' '}
                      <span className="font-medium">
                        {c.raisedBy?.name}
                      </span>{' '}
                      ({c.raisedBy?.role})
                    </p>
                    <p className="text-sm text-gray-800">
                      Khilaf:{' '}
                      <span className="font-medium">
                        {c.againstUser?.name}
                      </span>{' '}
                      ({c.againstUser?.role})
                    </p>
                    {c.jobId?.title ? (
                      <p className="text-sm text-gray-600">
                        Job: {c.jobId.title}
                      </p>
                    ) : null}
                    <p className="text-sm text-gray-600">
                      State: {c.location?.state || '—'}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      {isEx
                        ? c.description
                        : truncate(c.description, 100)}
                    </p>
                    {c.status === 'resolved' && c.adminNote ? (
                      <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-900">
                        Admin: {c.adminNote}
                      </p>
                    ) : null}
                    {c.evidence?.length ? (
                      <p className="mt-2 text-sm text-gray-600">
                        📎 {c.evidence.length} proof attached
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [c._id]: !prev[c._id],
                          }))
                        }
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700"
                      >
                        {isEx ? 'Chhupo' : 'Dekho'}
                      </button>
                      {pending ? (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveId(c._id)
                            setAdminNote('')
                            setAction('no_action')
                            setBlockDays(30)
                          }}
                          className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Resolve Karo
                        </button>
                      ) : null}
                    </div>

                    {resolveId === c._id ? (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4">
                        <label className="block text-sm font-medium text-gray-700">
                          Admin Note *
                        </label>
                        <textarea
                          rows={3}
                          value={adminNote}
                          onChange={(e) =>
                            setAdminNote(e.target.value)
                          }
                          placeholder="Kya action liya / kya hua..."
                          className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
                          required
                        />
                        <label className="mt-3 block text-sm font-medium text-gray-700">
                          Kya karenge?
                        </label>
                        <select
                          value={action}
                          onChange={(e) =>
                            onActionChange(e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="no_action">
                            Koi action nahi
                          </option>
                          <option value="warning">
                            Warning do
                          </option>
                          <option value="blocked_30days">
                            30 din block
                          </option>
                          <option value="blocked_90days">
                            90 din block
                          </option>
                          <option value="permanent_ban">
                            Permanent ban
                          </option>
                        </select>
                        {(action === 'blocked_30days' ||
                          action === 'blocked_90days') && (
                          <div className="mt-2">
                            <label className="text-xs text-gray-600">
                              Block days
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={blockDays}
                              onChange={(e) =>
                                setBlockDays(
                                  Number(e.target.value) || 30
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={resolving}
                          onClick={submitResolve}
                          className="mt-4 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {resolving ? '…' : 'Resolve Karo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolveId(null)}
                          className="mt-2 w-full text-sm text-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}

                    {isEx && c.evidence?.length ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {c.evidence.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border"
                          >
                            <img
                              src={url}
                              alt=""
                              className="h-28 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminComplaints
