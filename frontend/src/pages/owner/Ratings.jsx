import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { getOwnerContracts } from '../../api/contractAPI'
import { getMyRatings, giveRating } from '../../api/ratingAPI'

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const StarDisplay = ({ score, size = 'text-lg' }) => {
  const n = Math.round(Number(score) || 0)
  return (
    <span className={`text-yellow-400 ${size}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{i <= n ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

const OwnerRatings = () => {
  const [tab, setTab] = useState('mine')
  const [loading, setLoading] = useState(true)
  const [contractsLoading, setContractsLoading] = useState(false)
  const [received, setReceived] = useState([])
  const [given, setGiven] = useState([])
  const [avgScore, setAvgScore] = useState('0')
  const [totalRatings, setTotalRatings] = useState(0)
  const [contracts, setContracts] = useState([])
  const [scoresByContract, setScoresByContract] = useState({})
  const [reviewsByContract, setReviewsByContract] = useState({})
  const [starPick, setStarPick] = useState({})
  const [starHover, setStarHover] = useState({})
  const [reviewDrafts, setReviewDrafts] = useState({})
  const [submittingId, setSubmittingId] = useState(null)

  const loadMine = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyRatings()
      const rec = res.data?.received ?? []
      const giv = res.data?.given ?? []
      setReceived(rec)
      setGiven(giv)
      setAvgScore(String(res.data?.avgScore ?? '0'))
      setTotalRatings(res.data?.totalRatings ?? 0)

      const sc = {}
      const rv = {}
      for (const r of giv) {
        const cid = r.contractId
          ? String(r.contractId._id || r.contractId)
          : null
        if (cid) {
          sc[cid] = r.score
          rv[cid] = r.review || ''
        }
      }
      setScoresByContract(sc)
      setReviewsByContract(rv)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContracts = useCallback(async () => {
    setContractsLoading(true)
    try {
      const res = await getOwnerContracts()
      const list = (res.data?.contracts || []).filter((c) =>
        ['active', 'completed', 'terminated'].includes(c.status)
      )
      setContracts(list)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Contracts nahi mile'
      )
    } finally {
      setContractsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'mine') loadMine()
    else loadContracts()
  }, [tab, loadMine, loadContracts])

  const breakdown = useMemo(() => {
    const b = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const r of received) {
      const s = Math.min(5, Math.max(1, Math.round(Number(r.score))))
      b[s] += 1
    }
    return b
  }, [received])

  const maxBreak = useMemo(
    () => Math.max(1, ...Object.values(breakdown)),
    [breakdown]
  )

  const submitRating = async (contract, score, reviewText) => {
    const driver = contract.driverId
    const did = driver?._id || driver
    if (!did || !score) return
    setSubmittingId(String(contract._id))
    try {
      await giveRating({
        ratedToId: did,
        jobId: contract.jobId?._id || contract.jobId,
        contractId: contract._id,
        score,
        review: reviewText || '',
      })
      toast.success('Rating de di!')
      const id = String(contract._id)
      setStarPick((p) => ({ ...p, [id]: 0 }))
      setReviewDrafts((r) => ({ ...r, [id]: '' }))
      await loadMine()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Rating nahi gayi'
      )
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
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
              Meri Ratings
            </button>
            <button
              type="button"
              onClick={() => setTab('give')}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                tab === 'give'
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Rating Do
            </button>
          </div>

          {tab === 'mine' ? (
            loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="mb-6 rounded-2xl bg-blue-50 p-6 text-center">
                  <p className="text-sm text-blue-800">
                    Average rating
                  </p>
                  <p className="text-5xl font-bold text-blue-700">
                    {avgScore}
                  </p>
                  <div className="mt-2 flex justify-center">
                    <StarDisplay
                      score={avgScore}
                      size="text-3xl"
                    />
                  </div>
                  <p className="mt-2 text-sm text-blue-900">
                    {totalRatings} reviews
                  </p>
                </div>

                <div className="mb-6 space-y-2 rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-xs font-semibold text-gray-600">
                    Star breakdown
                  </p>
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-8 text-gray-600">
                        {s}★
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-yellow-400"
                          style={{
                            width: `${(breakdown[s] / maxBreak) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-6 text-right text-gray-500">
                        {breakdown[s]}
                      </span>
                    </div>
                  ))}
                </div>

                <h3 className="mb-3 font-semibold text-gray-800">
                  Reviews
                </h3>
                {received.length === 0 ? (
                  <p className="text-center text-gray-500">
                    Abhi koi rating nahi mili
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {received.map((r) => {
                      const by = r.ratedBy
                      const initials =
                        by?.name
                          ?.split(/\s+/)
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'D'
                      return (
                        <li
                          key={r._id}
                          className="rounded-2xl border border-gray-100 bg-white p-5"
                        >
                          <div className="flex gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900">
                                {by?.name || 'Driver'}
                              </p>
                              <StarDisplay
                                score={r.score}
                                size="text-xl"
                              />
                              {r.review ? (
                                <p className="mt-2 text-sm text-gray-700">
                                  {r.review}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-gray-500">
                                Job:{' '}
                                {r.jobId?.title || '—'} ·{' '}
                                {r.jobId?.vehicleType || '—'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {fmtDate(r.createdAt)}
                              </p>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <h3 className="mb-3 mt-8 font-semibold text-gray-800">
                  Maine Diye Hue Ratings
                </h3>
                {given.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Abhi koi rating nahi di
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {given.map((r) => (
                      <li
                        key={r._id}
                        className="rounded-xl border border-gray-100 bg-white p-3 text-sm"
                      >
                        <span className="font-medium">
                          {r.ratedTo?.name}
                        </span>
                        :{' '}
                        <StarDisplay score={r.score} /> ·{' '}
                        {r.jobId?.title}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          ) : contractsLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm font-medium text-gray-800">
                Jinhe rate karna hai:
              </p>
              {contracts.length === 0 ? (
                <p className="text-gray-500">
                  Koi active / complete / terminate contract nahi
                </p>
              ) : (
                contracts.map((c) => {
                  const d = c.driverId
                  const cid = String(c._id)
                  const done = scoresByContract[cid]
                  const sel =
                    starHover[cid] ||
                    starPick[cid] ||
                    0
                  const savedReview =
                    reviewsByContract[cid] ?? ''
                  return (
                    <div
                      key={c._id}
                      className="mb-4 rounded-2xl border border-gray-100 bg-white p-5"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
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
                          <p className="text-sm text-gray-600">
                            {c.jobId?.title} ·{' '}
                            {c.jobId?.vehicleType}
                          </p>
                          <p className="text-xs text-gray-500">
                            {c.duration} din · start{' '}
                            {fmtDate(c.startDate)} · ₹
                            {c.salaryPerDay}/din
                          </p>
                        </div>
                      </div>

                      {done ? (
                        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm">
                          <p>
                            Aapne {done} ★ diya{' '}
                            <StarDisplay score={done} />
                          </p>
                          {savedReview ? (
                            <p className="mt-1 text-gray-700">
                              {savedReview}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="mt-4 flex gap-1">
                            {[1, 2, 3, 4, 5].map((s) => {
                              const active = sel >= s
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  className={`text-3xl transition-colors ${
                                    active
                                      ? 'text-yellow-400'
                                      : 'text-gray-300 hover:text-yellow-300'
                                  }`}
                                  onMouseEnter={() =>
                                    setStarHover((h) => ({
                                      ...h,
                                      [cid]: s,
                                    }))
                                  }
                                  onMouseLeave={() =>
                                    setStarHover((h) => {
                                      const n = { ...h }
                                      delete n[cid]
                                      return n
                                    })
                                  }
                                  onClick={() =>
                                    setStarPick((p) => ({
                                      ...p,
                                      [cid]: s,
                                    }))
                                  }
                                >
                                  ★
                                </button>
                              )
                            })}
                          </div>
                          <textarea
                            rows={3}
                            placeholder="Review likhein (optional)..."
                            className="mt-3 w-full rounded-xl border border-gray-200 p-3 text-sm"
                            value={reviewDrafts[cid] ?? ''}
                            onChange={(e) =>
                              setReviewDrafts((r) => ({
                                ...r,
                                [cid]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={
                              !sel ||
                              submittingId === cid
                            }
                            onClick={() =>
                              submitRating(
                                c,
                                sel,
                                reviewDrafts[cid] || ''
                              )
                            }
                            className="mt-3 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                          >
                            {submittingId === cid
                              ? '…'
                              : 'Rating Do'}
                          </button>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
    </div>
  )
}

export default OwnerRatings
