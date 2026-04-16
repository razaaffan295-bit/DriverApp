import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { getDriverDetail } from '../../api/ownerAPI'

const isPdf = (url) =>
  url &&
  (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('/pdf'))

const getThumbUrl = (url) => {
  if (!url) return ''
  if (url.includes('cloudinary.com')) {
    return url.replace(
      '/upload/',
      '/upload/w_200,h_200,c_fill,q_auto/'
    )
  }
  return url
}

const DriverDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      try {
        const res = await getDriverDetail(id)
        setData(res.data || null)
      } catch (e) {
        toast.error(e.response?.data?.message || t('driverLoadError'))
        setData(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const renderStars = (score) => {
    const s = Number(score) || 0
    return [1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        style={{
          color: star <= s ? '#EAB308' : '#D1D5DB',
          fontSize: '16px',
        }}
      >
        ★
      </span>
    ))
  }

  const {
    driver,
    profile,
    activeContract,
    contractHistory,
    ratings,
    avgRating,
    totalRatings,
    attendanceSummary,
    paymentSummary,
  } = data || {}

  const daysLeft = activeContract
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeContract.startDate).getTime() +
            Number(activeContract.duration || 0) * 24 * 60 * 60 * 1000 -
            Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : 0

  const messageUrl = (() => {
    const driverId = driver?._id || id
    const jobId = activeContract?.jobId?._id || activeContract?.jobId
    if (jobId) return `/owner/messages?jobId=${jobId}&driverId=${driverId}`
    return `/owner/messages?driverId=${driverId}`
  })()

  const driverProfile = profile

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-3xl px-4 py-6">
          <button type="button" onClick={() => navigate(-1)} className="text-gray-500 text-sm mb-4">
            {t('backBtn')}
          </button>

          {loading ? (
            <div
              className="flex justify-center py-16"
              role="status"
              aria-label={t('loading')}
            >
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : !driver ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
              {t('driverNotFound')}
            </div>
          ) : (
            <>
              <div
                className="bg-white rounded-2xl p-6 mb-6 border border-gray-100"
                aria-label={t('profile')}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-3xl font-bold text-blue-700">
                    {driver?.profilePhoto ? (
                      <img
                        src={getThumbUrl(driver.profilePhoto)}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ cursor: 'pointer' }}
                      />
                    ) : (
                      (driver?.name || 'D').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold text-gray-900 truncate">{driver?.name}</div>
                    <div className="text-gray-500">{driver?.phone}</div>
                    <div className="text-sm text-gray-500">
                      {driver?.location?.state || '—'}
                      {driver?.location?.district ? `, ${driver.location.district}` : ''}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {driver?.isVerified ? (
                        <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
                          ✓ {t('verifiedLabel')}
                        </span>
                      ) : null}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          activeContract ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {activeContract ? t('activeStatus') : t('noActiveJobLabel')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {renderStars(Math.round(Number(avgRating) || 0))}
                      <span className="text-sm text-gray-600">
                        {avgRating} ({totalRatings} {t('review')})
                      </span>
                    </div>
                  </div>
                </div>

                {(profile?.skills || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.skills.map((s) => (
                      <span key={s} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 text-sm text-gray-500">
                  {profile?.experience != null ? `${profile.experience} ${t('experienceText')}` : '—'}
                </div>
                <div className="text-sm text-gray-500">
                  {profile?.licenseType || '—'} — {profile?.licenseNumber || '—'}
                </div>

                {driverProfile?.documents &&
                Object.values(driverProfile.documents).some((v) => v) ? (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '16px',
                      background: '#F9FAFB',
                      borderRadius: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '12px',
                      }}
                    >
                      Documents
                    </h3>

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {[
                        {
                          key: 'license',
                          label: 'License',
                          url: driverProfile.documents.license,
                        },
                        {
                          key: 'aadhar',
                          label: 'Aadhar',
                          url: driverProfile.documents.aadhar,
                        },
                        {
                          key: 'photo',
                          label: 'Photo',
                          url: driverProfile.documents.photo,
                        },
                        {
                          key: 'other',
                          label: 'Other',
                          url: driverProfile.documents.other,
                        },
                      ]
                        .filter((d) => d.url)
                        .map((doc) => (
                          <a
                            key={doc.key}
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'none',
                            }}
                          >
                            {isPdf(doc.url) ? (
                              <div
                                style={{
                                  width: '70px',
                                  height: '70px',
                                  background: '#FEF2F2',
                                  borderRadius: '8px',
                                  border: '1px solid #FECACA',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '24px',
                                  }}
                                >
                                  📄
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#EF4444',
                                    fontWeight: '600',
                                  }}
                                >
                                  PDF
                                </span>
                              </div>
                            ) : (
                              <img
                                src={getThumbUrl(doc.url)}
                                alt={doc.label}
                                style={{
                                  width: '70px',
                                  height: '70px',
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                  border: '1px solid #E5E7EB',
                                }}
                              />
                            )}
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#6B7280',
                                fontWeight: '500',
                              }}
                            >
                              {doc.key === 'license'
                                ? t('licenseDoc')
                                : doc.key === 'aadhar'
                                  ? t('aadharDoc')
                                  : doc.key === 'photo'
                                    ? t('photoDoc')
                                    : t('otherDoc')}
                            </span>
                          </a>
                        ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(messageUrl)}
                    className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm"
                  >
                    {t('messageBtnLabel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/complaints')}
                    className="border border-red-300 text-red-500 px-4 py-2 rounded-xl text-sm"
                  >
                    {t('complaintBtnLabel')}
                  </button>
                </div>
              </div>

              {activeContract ? (
                <div
                  className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6"
                  aria-label={t('contract')}
                >
                  <div className="text-green-800 font-bold text-lg mb-4">
                    {t('workInProgress2')}
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <strong>{t('job')}:</strong> {activeContract.jobId?.title || '—'}
                    </div>
                    <div>
                      <strong>{t('vehicleLabel4')}:</strong> {activeContract.jobId?.vehicleId?.vehicleType || '—'} —{' '}
                      {activeContract.jobId?.vehicleId?.vehicleNumber || '—'}
                    </div>
                    <div>
                      <strong>{t('categoryLabel3')}:</strong> {activeContract.vehicleCategory || '—'}
                    </div>
                    <div>
                      <strong>{t('salaryLabel2')}:</strong>{' '}
                      {activeContract.salaryType === 'daily'
                        ? `₹${activeContract.salaryPerDay}/${t('perDay')}`
                        : activeContract.salaryType === 'monthly'
                          ? `₹${activeContract.salaryPerMonth}/${t('perMonth')}`
                          : `₹${activeContract.salaryPerHour}/${t('perHour')}`}
                    </div>
                    {activeContract.hasBhatta ? (
                      <div>
                        + ₹{activeContract.dailyBhatta} {t('bhatta')}/{t('perDay')}
                      </div>
                    ) : null}
                    <div>
                      <strong>{t('startDate')}:</strong> {formatDate(activeContract.startDate)}
                    </div>
                    <div>
                      <strong>{t('duration')}:</strong> {activeContract.duration} {t('days')}
                    </div>
                    <div className="font-semibold text-green-800">
                      {daysLeft} {t('daysLeftLabel')}
                    </div>
                  </div>

                  {attendanceSummary ? (
                    <div className="bg-white rounded-xl p-4 mt-4">
                      <div className="font-semibold text-gray-800">
                        {t('thisMonthAttendance')}:
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-green-50 p-3">
                          <div className="text-green-700 font-bold">
                            {attendanceSummary.presentDays} {t('days')}
                          </div>
                          <div className="text-xs text-gray-500">{t('presentLabel')}</div>
                        </div>
                        <div className="rounded-xl bg-red-50 p-3">
                          <div className="text-red-600 font-bold">
                            {attendanceSummary.absentDays} {t('days')}
                          </div>
                          <div className="text-xs text-gray-500">{t('absentLabel')}</div>
                        </div>
                        <div className="rounded-xl bg-yellow-50 p-3">
                          <div className="text-yellow-700 font-bold">
                            {attendanceSummary.halfDays} {t('days')}
                          </div>
                          <div className="text-xs text-gray-500">{t('halfDayLabel')}</div>
                        </div>
                        <div className="rounded-xl bg-blue-50 p-3">
                          <div className="text-blue-700 font-bold">₹{attendanceSummary.grossTotal}</div>
                          <div className="text-xs text-gray-500">{t('salaryLabel3')}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {paymentSummary ? (
                    <div className="bg-white rounded-xl p-4 mt-3 text-sm text-gray-700">
                      <div className="font-semibold text-gray-800">
                        {t('paymentsStatus')}:
                      </div>
                      <div className="mt-2">
                        {t('totalPaidLabel')}: <strong>₹{paymentSummary.totalPaid}</strong>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t('lastPaymentLabel')}: {formatDate(paymentSummary.lastPayment?.ownerPaidAt)}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/attendance')}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      📅 {t('attendance')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/owner/payments')}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      💰 {t('payments')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/owner/contracts/${activeContract._id}`)}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      📋 {t('viewContract')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const vid = activeContract.jobId?.vehicleId?._id
                        if (vid) navigate(`/owner/vehicles/${vid}`)
                        else toast.error(t('vehicleNotFound'))
                      }}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      🚗 {t('viewVehicleBtn')}
                    </button>
                  </div>
                </div>
              ) : null}

              {(ratings || []).length > 0 ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">
                    {t('ratings')}
                  </h2>
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-blue-700">{avgRating}</div>
                    <div className="mt-2">{renderStars(Math.round(Number(avgRating) || 0))}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {totalRatings} {t('review')}
                    </div>
                  </div>
                  {(ratings || []).map((r) => (
                    <div key={r._id} className="border-b pb-3 mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-gray-800">
                          {r.ratedBy?.name || 'User'}{' '}
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {r.ratedBy?.role || r.ratedByRole || '—'}
                          </span>
                        </div>
                        <div>{renderStars(Number(r.score) || 0)}</div>
                      </div>
                      {r.review ? <div className="mt-1 text-sm text-gray-700">{r.review}</div> : null}
                      {r.jobId?.title ? <div className="text-xs text-gray-500 mt-1">{r.jobId.title}</div> : null}
                      <div className="text-xs text-gray-400 mt-1">{formatDate(r.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(contractHistory || []).length > 0 ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">
                    {t('workHistoryLabel')}
                  </h2>
                  {contractHistory.map((c) => (
                    <div key={c._id} className="bg-gray-50 rounded-xl p-4 mb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{c.jobId?.title || '—'}</div>
                          <div className="text-sm text-gray-600">
                            {c.jobId?.vehicleType || 'Vehicle'} · {c.jobId?.vehicleId?.vehicleNumber || '—'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {t('startDate')}: {formatDate(c.startDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              c.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-500'
                            }`}
                          >
                            {c.status === 'completed' ? t('completeLabel') : t('resignLabel')}
                          </span>
                          <div className="mt-2 text-xs text-gray-400">
                            {c.duration} {t('days')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
    </div>
  )
}

export default DriverDetail

