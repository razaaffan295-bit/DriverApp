import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { getOwnerContracts } from '../../api/contractAPI'
import { getMyComplaints } from '../../api/complaintAPI'

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
  d ? new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '-'

const OwnerComplaints = () => {
  const [tab, setTab] = useState('mine')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [contracts, setContracts] = useState([])
  const [cLoading, setCLoading] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [complaintType, setComplaintType] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadMine = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyComplaints()
      setComplaints(res.data?.complaints ?? [])
    } catch (e) {
      toast.error(e.response?.data?.message || 'Load nahi hua')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContracts = useCallback(async () => {
    setCLoading(true)
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
      const list = [...map.values()]
      setContracts(list)
      if (list.length > 0) {
        setSelectedContract(list[0])
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Contracts load nahi hue')
    } finally {
      setCLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContracts()
  }, [tab, loadMine, loadContracts])

  const handleSubmit = async () => {
    if (!selectedContract) {
      toast.error('Driver chunein')
      return
    }
    if (!complaintType) {
      toast.error('Type chunein')
      return
    }
    if (!description.trim()) {
      toast.error('Description likhein')
      return
    }
    const againstUserId =
      selectedContract.driverId?._id ||
      selectedContract.driverId
    if (!againstUserId) {
      toast.error('Driver ID nahi mila')
      return
    }
    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append(
        'againstUserId',
        String(againstUserId)
      )
      formData.append('type', complaintType)
      formData.append('description', description.trim())

      const jid =
        selectedContract.jobId?._id ||
        selectedContract.jobId ||
        ''
      if (jid) formData.append('jobId', String(jid))
      const cid = selectedContract._id || ''
      if (cid) formData.append('contractId', String(cid))

      if (evidenceFiles?.length) {
        ;[...evidenceFiles].forEach((f) => {
          formData.append('evidence', f)
        })
      }

      await API.post('/api/complaints', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      toast.success('Complaint darj ho gayi!')
      setDescription('')
      setComplaintType('')
      setSelectedContract(null)
      setEvidenceFiles(null)
      setTab('mine')
      await loadMine()
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
    <div style={{ minHeight: '100vh', background: '#F0F4FF' }}>
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
                    Khilaf: {c.againstUser?.name || 'Driver'}
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
                  {Array.isArray(c.evidence) &&
                  c.evidence.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.evidence.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-blue-700 underline"
                        >
                          Proof {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : cLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">
              Kiske khilaf complaint karni hai?
            </p>

            {contracts.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Koi hired driver nahi mila
              </p>
            ) : (
              <ul className="space-y-2">
                {contracts.map((c) => {
                  const d = c.driverId
                  const isActive =
                    selectedContract &&
                    String(selectedContract._id) === String(c._id)
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedContract(c)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-100 bg-white'
                        }`}
                      >
                        <span style={{
                          display: 'block',
                          fontWeight: '600',
                          color: '#111827',
                          fontSize: '14px',
                          pointerEvents: 'none'
                        }}>
                          {d?.name || 'Driver'}
                        </span>
                        <span style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#9CA3AF',
                          marginTop: '2px',
                          pointerEvents: 'none'
                        }}>
                          {d?.phone} · {c.jobId?.title}
                        </span>
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
              onChange={(e) => setComplaintType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Type chunein...</option>
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kya hua? Detail mein likhein..."
              className="w-full rounded-xl border border-gray-200 p-3 text-sm"
            />

            <div>
              <label className="text-sm font-medium text-gray-700">
                Proof (optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => setEvidenceFiles(e.target.files)}
                className="mt-2 w-full text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                !selectedContract ||
                !complaintType ||
                !description.trim() ||
                submitting
              }
              className={`w-full rounded-2xl py-4 font-semibold text-base text-white transition-all ${
                !selectedContract ||
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
          </div>
        )}
      </div>
    </div>
  )
}

export default OwnerComplaints
