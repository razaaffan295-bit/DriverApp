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
  getMyComplaints,
  createComplaint,
} from '../../api/complaintAPI'

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

const OWNER_TYPES = [
  { value: 'part_chori', label: 'Part Chori' },
  { value: 'kaam_choda', label: 'Kaam Beech Mein Choda' },
  { value: 'machine_damage', label: 'Machine Ko Nuksan' },
  { value: 'attendance_fraud', label: 'Attendance Fraud' },
  { value: 'misbehavior', label: 'Misbehavior' },
  { value: 'other', label: 'Koi Aur' },
]

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-600',
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const readFilesAsDataUrls = (fileList) =>
  Promise.all(
    [...fileList].map(
      (f) =>
        new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result || ''))
          r.onerror = reject
          r.readAsDataURL(f)
        })
    )
  )

const OwnerComplaints = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState('mine')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [pickLoading, setPickLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [complaintType, setComplaintType] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const profileNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') !== 'vehicles'
  const vehiclesNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') === 'vehicles'
  const placeholderNav = () => {
    navigate('/owner/profile')
  }

  const loadMine = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyComplaints()
      setComplaints(res.data?.complaints ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContracts = useCallback(async () => {
    setPickLoading(true)
    try {
      const res = await getOwnerContracts()
      const raw = res.data?.contracts || []
      const filtered = raw.filter((c) =>
        ['active', 'completed', 'signed'].includes(c.status)
      )
      const map = new Map()
      for (const c of filtered) {
        const id = c.driverId?._id || c.driverId
        if (!id) continue
        const key = String(id)
        if (!map.has(key)) map.set(key, c)
      }
      setContracts([...map.values()])
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Contracts load nahi hue'
      )
    } finally {
      setPickLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContracts()
  }, [tab, loadMine, loadContracts])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logout ho gaye!')
  }

  const handleSubmit = async () => {
    if (
      !selectedUser ||
      !complaintType ||
      !description.trim()
    ) {
      toast.error('Sab fields bharein')
      return
    }

    try {
      setSubmitting(true)

      let evidence = []
      if (evidenceFiles?.length) {
        evidence = await readFilesAsDataUrls(evidenceFiles)
      }

      await createComplaint({
        againstUserId:
          selectedUser.driverId?._id ||
          selectedUser.driverId,
        jobId:
          selectedUser.jobId?._id ||
          selectedUser.jobId ||
          null,
        contractId: selectedUser._id || null,
        type: complaintType,
        description: description.trim(),
        evidence,
      })

      toast.success(
        'Complaint darj ho gayi! Admin review karega.'
      )

      setDescription('')
      setComplaintType('')
      setSelectedUser(null)
      setEvidenceFiles(null)
      setTab('mine')

      loadMine()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Complaint nahi gayi'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                tab === 'mine'
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Meri Complaints
            </button>
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                tab === 'new'
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Nayi Complaint
            </button>
          </div>

          {tab === 'mine' ? (
            loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              </div>
            ) : complaints.length === 0 ? (
              <p className="text-center text-gray-500">
                Koi complaint nahi
              </p>
            ) : (
              <ul className="space-y-4">
                {complaints.map((c) => (
                  <li
                    key={c._id}
                    className="rounded-2xl border border-gray-100 bg-white p-5"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
                        {c.type}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_STYLE[c.status] ||
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      Khilaf:{' '}
                      {c.againstUser?.name || 'Driver'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {c.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {fmtDate(c.createdAt)}
                    </p>
                    {c.status === 'resolved' && c.adminNote ? (
                      <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-900">
                        Admin: {c.adminNote}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : pickLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-gray-800">
                Kiske khilaf complaint karni hai?
              </p>
              {contracts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Koi hired driver nahi mila — pehle contract active /
                  complete karein.
                </p>
              ) : (
                <ul className="space-y-2">
                  {contracts.map((c) => {
                    const d = c.driverId
                    const active =
                      selectedUser &&
                      String(selectedUser._id) === String(c._id)
                    return (
                      <li key={c._id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUser(c)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-100 bg-white'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">
                            {d?.name || 'Driver'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {d?.phone} · {c.jobId?.title}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              <label className="block text-sm font-medium text-gray-700">
                Complaint Type
              </label>
              <select
                value={complaintType}
                onChange={(e) =>
                  setComplaintType(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Type chunein…</option>
                {OWNER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Kya hua? Detail mein likhein..."
                className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              />

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Proof Upload Karo (optional)
                </label>
                <p className="text-xs text-gray-500">
                  Photos ya screenshots — multiple select
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setEvidenceFiles(e.target.files)
                  }
                  className="mt-2 w-full text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={
                  !selectedUser ||
                  !complaintType ||
                  !description.trim() ||
                  submitting
                }
                className={`w-full rounded-2xl py-4 font-semibold text-base text-white transition-all ${
                  !selectedUser ||
                  !complaintType ||
                  !description.trim() ||
                  submitting
                    ? 'cursor-not-allowed bg-blue-300'
                    : 'cursor-pointer bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {submitting
                  ? 'Bhej raha hai...'
                  : 'Complaint Darj Karein'}
              </button>
            </form>
          )}
        </div>
    </div>
  )
}

export default OwnerComplaints
