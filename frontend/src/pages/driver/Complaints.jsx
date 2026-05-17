import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { getDriverActiveContract } from '../../api/contractAPI'
import { getMyComplaints } from '../../api/complaintAPI'

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

const DriverComplaints = () => {
  const { t } = useTranslation()

  const DRIVER_TYPES = [
    { value: 'payment_nahi_diya', label: t('paymentNotGiven') },
    { value: 'zyada_kaam', label: t('overwork') },
    { value: 'unsafe_conditions', label: t('unsafeConditions') },
    { value: 'misbehavior', label: t('misbehavior') },
    { value: 'other', label: t('other') },
  ]

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
        e.response?.data?.message || t('complaintLoadError')
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadContract = useCallback(async () => {
    setCLoading(true)
    try {
      const res = await getDriverActiveContract()
      setContract(res.data?.contract || null)
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('contractLoadError')
      )
    } finally {
      setCLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContract()
  }, [tab, loadMine, loadContract])

  const selectedUser = contract?.ownerId

  const handleSubmit = async () => {
    if (
      !contract ||
      !selectedUser ||
      !complaintType ||
      !description.trim()
    ) {
      toast.error(t('allFieldsRequired'))
      return
    }

    const againstUserId =
      selectedUser._id || selectedUser
    const againstIdStr =
      againstUserId != null ? String(againstUserId) : ''

    if (!againstIdStr) {
      toast.error(t('ownerIdMissing'))
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('againstUserId', againstIdStr)
      formData.append('type', complaintType)
      formData.append('description', description.trim())

      const jid =
        contract.jobId?._id || contract.jobId || ''
      if (jid) formData.append('jobId', String(jid))
      const cid = contract._id || ''
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

      toast.success(t('complaintSubmitted'))

      setDescription('')
      setComplaintType('')
      setEvidenceFiles(null)
      setTab('mine')
      await loadMine()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          t('complaintSubmitError')
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
              {t('myComplaints')}
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
              {t('newComplaint')}
            </button>
          </div>

          {tab === 'mine' ? (
            loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
              </div>
            ) : complaints.length === 0 ? (
              <p className="text-center text-gray-500">
                {t('noComplaints')}
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
                        {c.status === 'pending'
                          ? t('pending')
                          : c.status === 'under_review'
                            ? t('underReview')
                            : c.status === 'rejected'
                              ? t('rejected')
                              : c.status === 'resolved'
                                ? t('completed')
                                : c.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-900">
                      {t('againstLabel')}:{' '}
                      {c.againstUser?.name || 'Owner'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {c.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      {fmtDate(c.createdAt)}
                    </p>
                    {c.status === 'resolved' && c.adminNote ? (
                      <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-900">
                        {t('adminNote')}: {c.adminNote}
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
                            className="text-xs font-medium text-green-700 underline"
                          >
                            {t('proofLabel')} {i + 1}
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
                {t('againstOwner')}
              </p>
              {!owner ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {t('noActiveContract')}
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
                {t('complaint')}
              </label>
              <select
                value={complaintType}
                onChange={(e) =>
                  setComplaintType(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">
                  {t('complaintTypePlaceholder')}
                </option>
                {DRIVER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700">
                {t('description')}
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder={t('complaintDescPlaceholder')}
                className="w-full rounded-xl border border-gray-200 p-3 text-sm"
              />

              <div>
                <label className="text-sm font-medium text-gray-700">
                  {t('evidence')}
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
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
                  ? t('loading')
                  : t('submit')}
              </button>
            </form>
          )}
        </div>
    </div>
  )
}

export default DriverComplaints
