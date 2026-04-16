import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { getOwnerContracts } from '../../api/contractAPI'
import { getMyComplaints } from '../../api/complaintAPI'

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
  const { t } = useTranslation()

  const OWNER_TYPES = [
    { value: 'part_chori', label: t('partTheft') },
    { value: 'kaam_choda', label: t('leftWorkMidway') },
    { value: 'machine_damage', label: t('machineDamage') },
    { value: 'attendance_fraud', label: t('attendanceFraud') },
    { value: 'misbehavior', label: t('misbehavior') },
    { value: 'other', label: t('other') },
  ]

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
      toast.error(e.response?.data?.message || t('loadError2'))
    } finally {
      setLoading(false)
    }
  }, [t])

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
      toast.error(
        e.response?.data?.message || t('contractsLoadError2')
      )
    } finally {
      setCLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContracts()
  }, [tab, loadMine, loadContracts])

  const handleSubmit = async () => {
    if (!selectedContract) {
      toast.error(t('driverRequired'))
      return
    }
    if (!complaintType) {
      toast.error(t('typeRequired'))
      return
    }
    if (!description.trim()) {
      toast.error(t('descriptionRequired'))
      return
    }
    const againstUserId =
      selectedContract.driverId?._id ||
      selectedContract.driverId
    if (!againstUserId) {
      toast.error(t('driverIdMissing2'))
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

      toast.success(t('ownerComplaintSubmitted'))
      setDescription('')
      setComplaintType('')
      setSelectedContract(null)
      setEvidenceFiles(null)
      setTab('mine')
      await loadMine()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        t('ownerComplaintError')
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
            {t('myComplaintsTab')}
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
            {t('newComplaintTab')}
          </button>
        </div>

        {tab === 'mine' ? (
          loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
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
                      {c.status === 'pending' ? t('pending') : c.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {t('againstLabel')}: {c.againstUser?.name || 'Driver'}
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
                          className="text-xs font-medium text-blue-700 underline"
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">
              {t('whoToComplainAbout')}
            </p>

            {contracts.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {t('noHiredDriver')}
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
              {t('complaintTypeLabel')}
            </label>
            <select
              value={complaintType}
              onChange={(e) => setComplaintType(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">{t('complaintTypePlaceholder')}</option>
              {OWNER_TYPES.map((ot) => (
                <option key={ot.value} value={ot.value}>
                  {ot.label}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700">
              {t('description')}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                ? t('loading')
                : t('submit')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default OwnerComplaints
