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
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
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
  const [selectedComplaint, setSelectedComplaint] =
    useState(null)
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
        e.response?.data?.message || t('complaintsLoadError')
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
    toast.success(t('logoutSuccess'))
  }

  const onActionChange = (v) => {
    setAction(v)
    if (v === 'blocked_30days') setBlockDays(30)
    if (v === 'blocked_90days') setBlockDays(90)
  }

  const submitResolve = async () => {
    if (!adminNote.trim()) {
      toast.error(t('adminNoteRequired'))
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
      toast.success(t('complaintResolved'))
      setResolveId(null)
      setAdminNote('')
      setAction('no_action')
      load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('resolveError')
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
    <div
      style={{ minHeight: '100vh', background: '#F5F3FF' }}
    >
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-gradient-to-b from-violet-900 to-purple-950 shadow-xl md:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <span className="text-lg font-bold text-white">
            {t('adminPanel')}
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
            {t('dashboard')}
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('allUsers')}
          </NavLink>
          <NavLink
            to="/admin/users?role=owner"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('owners')}
          </NavLink>
          <NavLink
            to="/admin/users?role=driver"
            className={sidebarInactive}
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            {t('drivers')}
          </NavLink>
          <Link to="/admin/dashboard" className={sidebarInactive}>
            <MdWork className="h-5 w-5 shrink-0" />
            {t('jobs2')}
          </Link>
          <NavLink
            to="/admin/complaints"
            end
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdWarning className="h-5 w-5 shrink-0" />
            {t('complaints2')}
          </NavLink>
          <NavLink
            to="/admin/subscriptions"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdSubscriptions className="h-5 w-5 shrink-0" />
            {t('subscriptions2')}
          </NavLink>
          <Link to="/admin/subscriptions" className={sidebarInactive}>
            <MdAttachMoney className="h-5 w-5 shrink-0" />
            {t('revenue')}
          </Link>
          <NavLink
            to="/admin/subscription-manager"
            className={({ isActive }) =>
              isActive ? sidebarActive : sidebarInactive
            }
          >
            <MdPeople className="h-5 w-5 shrink-0" />
            Sub Manager
          </NavLink>
        </nav>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:left-64 md:px-6">
        <h1 className="text-lg font-semibold text-gray-800">
          {t('complaintsTitle')}
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
            {t('logoutBtn')}
          </button>
        </div>
      </header>

      <main className="min-h-screen pb-24 pt-16 md:ml-64 md:pb-8">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {[
                { id: '', label: t('allFilter') },
                { id: 'pending', label: t('pending') },
                { id: 'under_review', label: t('underReview') },
                { id: 'resolved', label: t('resolvedLabel') },
                { id: 'rejected', label: t('rejectedLabel2') },
              ].map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setStatus(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium sm:text-sm ${
                    status === tab.id
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-3 sm:flex sm:gap-3">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm sm:mt-0 sm:max-w-xs"
              >
                <option value="">{t('allStates')}</option>
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
              {t('applyFilter')}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            {total} {t('complaintsFound')}
          </p>

          {loading ? (
            <div className="mt-10 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-700 border-t-transparent" />
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {complaints.map((c) => {
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
                      {t('complaintBy')}:{' '}
                      <span className="font-medium">
                        {c.raisedBy?.name}
                      </span>{' '}
                      ({c.raisedBy?.role})
                    </p>
                    <p className="text-sm text-gray-800">
                      {t('againstLabel2')}:{' '}
                      <span className="font-medium">
                        {c.againstUser?.name}
                      </span>{' '}
                      ({c.againstUser?.role})
                    </p>
                    {c.jobId?.title ? (
                      <p className="text-sm text-gray-600">
                        {t('jobLabel2')}: {c.jobId.title}
                      </p>
                    ) : null}
                    <p className="text-sm text-gray-600">
                      {t('stateLabel3')}: {c.location?.state || '—'}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      {truncate(c.description, 100)}
                    </p>
                    {c.status === 'resolved' && c.adminNote ? (
                      <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-900">
                        {t('adminNoteLabel')}: {c.adminNote}
                      </p>
                    ) : null}
                    {c.evidence?.length ? (
                      <p className="mt-2 text-sm text-gray-600">
                        📎 {c.evidence.length} {t('proofAttached')}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedComplaint(c)}
                        className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700"
                      >
                        {t('viewBtn2')}
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
                          {t('resolveBtn')}
                        </button>
                      ) : null}
                    </div>

                    {resolveId === c._id ? (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4">
                        <label className="block text-sm font-medium text-gray-700">
                          {t('adminNoteLabel')} *
                        </label>
                        <textarea
                          rows={3}
                          value={adminNote}
                          onChange={(e) =>
                            setAdminNote(e.target.value)
                          }
                          placeholder={t('adminNotePlaceholder')}
                          className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
                          required
                        />
                        <label className="mt-3 block text-sm font-medium text-gray-700">
                          {t('actionLabel')}
                        </label>
                        <select
                          value={action}
                          onChange={(e) =>
                            onActionChange(e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="no_action">
                            {t('noAction')}
                          </option>
                          <option value="warning">
                            {t('giveWarning')}
                          </option>
                          <option value="blocked_30days">
                            {t('block30days')}
                          </option>
                          <option value="blocked_90days">
                            {t('block90days')}
                          </option>
                          <option value="permanent_ban">
                            {t('permanentBan')}
                          </option>
                        </select>
                        {(action === 'blocked_30days' ||
                          action === 'blocked_90days') && (
                          <div className="mt-2">
                            <label className="text-xs text-gray-600">
                              {t('blockDaysLabel')}
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
                          {resolving ? '…' : t('resolveBtnLabel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolveId(null)}
                          className="mt-2 w-full text-sm text-gray-500"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>

      {selectedComplaint && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                }}
              >
                {t('complaintDetail')}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  background: '#F3F4F6',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {TYPE_LABEL[selectedComplaint.type] ||
                  selectedComplaint.type}
              </span>
              <span
                style={{
                  background: '#FEF3C7',
                  color: '#D97706',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {selectedComplaint.status}
              </span>
            </div>

            <div
              style={{
                background: '#F9FAFB',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                    }}
                  >
                    {t('complaintBy')}
                  </p>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827',
                    }}
                  >
                    {selectedComplaint.raisedBy?.name}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#6B7280',
                    }}
                  >
                    {selectedComplaint.raisedBy?.phone}
                  </p>
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#DBEAFE',
                      color: '#1D4ED8',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}
                  >
                    {selectedComplaint.raisedByRole ||
                      selectedComplaint.raisedBy?.role}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                    }}
                  >
                    {t('againstLabel2')}
                  </p>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#111827',
                    }}
                  >
                    {selectedComplaint.againstUser?.name}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#6B7280',
                    }}
                  >
                    {selectedComplaint.againstUser?.phone}
                  </p>
                </div>
              </div>
            </div>

            {selectedComplaint.jobId ? (
              <div
                style={{
                  marginBottom: '16px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: '#9CA3AF',
                    marginBottom: '4px',
                  }}
                >
                  {t('jobLabel2')}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#374151',
                  }}
                >
                  {typeof selectedComplaint.jobId === 'object'
                    ? selectedComplaint.jobId?.title
                    : String(selectedComplaint.jobId)}
                </p>
              </div>
            ) : null}

            <div
              style={{
                marginBottom: '16px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  color: '#9CA3AF',
                  marginBottom: '4px',
                }}
              >
                {t('descriptionLabel2')}
              </p>
              <p
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  lineHeight: '1.6',
                  background: '#F9FAFB',
                  padding: '12px',
                  borderRadius: '10px',
                }}
              >
                {selectedComplaint.description}
              </p>
            </div>

            {selectedComplaint.evidence?.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#9CA3AF',
                    marginBottom: '8px',
                  }}
                >
                  {t('evidenceLabel')} ({selectedComplaint.evidence.length})
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {selectedComplaint.evidence.map((img, i) => (
                    <a
                      key={i}
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={img}
                        alt={`evidence ${i + 1}`}
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          cursor: 'pointer',
                        }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <p
              style={{
                fontSize: '12px',
                color: '#9CA3AF',
                marginBottom: '16px',
              }}
            >
              {new Date(
                selectedComplaint.createdAt
              ).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>

            {selectedComplaint.status === 'resolved' &&
            selectedComplaint.adminNote ? (
              <div
                style={{
                  background: '#F0FDF4',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '16px',
                }}
              >
                <p
                  style={{
                    fontSize: '12px',
                    color: '#16A34A',
                    fontWeight: '600',
                    marginBottom: '4px',
                  }}
                >
                  {t('adminNoteLabel')}:
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#166534',
                  }}
                >
                  {selectedComplaint.adminNote}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setSelectedComplaint(null)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#F3F4F6',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                color: '#374151',
              }}
            >
              {t('closeBtn2')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminComplaints
