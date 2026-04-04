import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { getDriverActiveContract } from '../../api/contractAPI'
import {
  getMyComplaints,
  createComplaint,
} from '../../api/complaintAPI'

const DRIVER_TYPES = [
  { value: 'payment_nahi_diya', label: 'Payment Nahi Di' },
  { value: 'zyada_kaam', label: 'Zyada Kaam Karaya' },
  { value: 'unsafe_conditions', label: 'Unsafe Conditions' },
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

const DriverComplaints = () => {
  const [tab, setTab] = useState('mine')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [contract, setContract] = useState(null)
  const [cLoading, setCLoading] = useState(false)
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
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContract = useCallback(async () => {
    setCLoading(true)
    try {
      const res = await getDriverActiveContract()
      setContract(res.data?.contract || null)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Contract load nahi hua'
      )
    } finally {
      setCLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContract()
  }, [tab, loadMine, loadContract])

  const selectedUser = contract?.ownerId

  const handleSubmit = async () => {
    console.log('Submit clicked')
    console.log('selectedUser:', selectedUser)
    console.log('complaintType:', complaintType)
    console.log('description:', description)

    if (
      !contract ||
      !selectedUser ||
      !complaintType ||
      !description.trim()
    ) {
      toast.error('Sab fields bharein')
      return
    }

    const againstUserId =
      selectedUser._id || selectedUser
    const againstIdStr =
      againstUserId != null ? String(againstUserId) : ''

    if (!againstIdStr) {
      toast.error('Owner ID nahi mili — contract check karein')
      return
    }

    try {
      setSubmitting(true)

      let evidence = []
      if (evidenceFiles?.length) {
        evidence = await readFilesAsDataUrls(evidenceFiles)
      }

      await createComplaint({
        againstUserId: againstIdStr,
        jobId:
          contract.jobId?._id ||
          contract.jobId ||
          null,
        contractId: contract._id || null,
        type: complaintType,
        description: description.trim(),
        evidence,
      })

      toast.success('Complaint darj ho gayi!')

      setDescription('')
      setComplaintType('')
      setEvidenceFiles(null)
      setTab('mine')
      await loadMine()
    } catch (err) {
      console.error('Complaint error:', err)
      toast.error(
        err.response?.data?.message ||
          'Complaint nahi gayi. Dobara try karein.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const owner = contract?.ownerId

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                tab === 'mine'
                  ? 'bg-green-700 text-white'
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
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Nayi Complaint
            </button>
          </div>

          {tab === 'mine' ? (
            loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
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
                      Khilaf: {c.againstUser?.name || 'Owner'}
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
          ) : cLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSubmit()
              }}
              className="space-y-4"
            >
              <p className="text-sm font-medium text-gray-800">
                Kiske khilaf (Owner)
              </p>
              {!owner ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Abhi koi active / signed contract nahi — pehle job join
                  karein.
                </p>
              ) : (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="font-semibold text-gray-900">
                    {owner.name}
                  </p>
                  <p className="text-sm text-gray-600">{owner.phone}</p>
                  {contract.jobId?.title ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Job: {contract.jobId.title}
                    </p>
                  ) : null}
                </div>
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
                {DRIVER_TYPES.map((t) => (
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
                  Proof (optional)
                </label>
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
                type="button"
                onClick={() => void handleSubmit()}
                disabled={
                  !contract ||
                  !selectedUser ||
                  !complaintType ||
                  !description.trim() ||
                  submitting
                }
                className={`w-full rounded-2xl py-4 font-semibold text-base text-white transition-all ${
                  !contract ||
                  !selectedUser ||
                  !complaintType ||
                  !description.trim() ||
                  submitting
                    ? 'cursor-not-allowed bg-green-300'
                    : 'cursor-pointer bg-green-700 hover:bg-green-800'
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

export default DriverComplaints
