import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'

const formatExpiry = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const initialsFrom = (name) =>
  name
    ?.split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'D'

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

const DriverProfileModal = ({
  driver,
  driverProfileData,
  selectedApplication,
  applicationStatus,
  onClose,
  onAccept,
  onReject,
  acceptLoading,
}) => {
  const navigate = useNavigate()
  if (!driver) return null

  const name = driver.name || 'Driver'

  const avgRating = driverProfileData?.avgRating ?? 0
  const totalRatings = driverProfileData?.totalRatings ?? 0
  const ratings = driverProfileData?.ratings ?? []

  const status =
    applicationStatus ?? selectedApplication?.status
  const canMessage =
    !selectedApplication || status !== 'rejected'

  const documentsObj =
    driver?.documents || driver?.profile?.documents
  const driverProfile = documentsObj
    ? { documents: documentsObj }
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-full w-full transform flex-col bg-white shadow-2xl transition-transform md:w-96"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-semibold text-gray-800">
            Driver Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-green-100 text-2xl font-bold text-green-700">
              {driver.profilePhoto ? (
                <img
                  src={getThumbUrl(driver.profilePhoto)}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                initialsFrom(name)
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">
              {driver.location?.state}, {driver.location?.district}
            </p>
            {driver.phone && (
              <p className="text-sm text-gray-500">{driver.phone}</p>
            )}
            <div className="mt-3">
              {driver.isVerified ? (
                <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                  ✓ Verified
                </span>
              ) : (
                <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-500">
                  Not Verified
                </span>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 font-semibold text-gray-800">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {(driver.skills || []).length ? (
                driver.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Experience:</span>{' '}
              {driver.experience != null
                ? `${driver.experience} saal`
                : '—'}
            </p>
            <p>
              <span className="font-medium">License Type:</span>{' '}
              {driver.licenseType || '—'}
            </p>
            <p>
              <span className="font-medium">License Number:</span>{' '}
              {driver.licenseNumber || '—'}
            </p>
            <p>
              <span className="font-medium">License Expiry:</span>{' '}
              {formatExpiry(driver.licenseExpiry)}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="mb-1 font-semibold text-gray-800">About</h3>
            <p className="text-sm text-gray-600">
              {driver.about || '—'}
            </p>
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
                        {doc.label}
                      </span>
                    </a>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="mb-5 mt-6">
            <h4 className="mb-3 font-semibold text-gray-700">
              Rating
            </h4>

            <div className="mb-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold text-yellow-500">
                  {avgRating}
                </div>
                <div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-xl ${
                          star <=
                          Math.round(Number(avgRating))
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500">
                    {totalRatings} reviews
                  </div>
                </div>
              </div>
            </div>

            {ratings.length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-400">
                Abhi koi rating nahi
              </p>
            ) : (
              <div className="max-h-48 space-y-3 overflow-y-auto">
                {ratings.slice(0, 5).map((rating, i) => (
                  <div
                    key={rating._id || i}
                    className="rounded-xl border border-gray-100 bg-white p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-sm ${
                              star <= rating.score
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(rating.createdAt).toLocaleDateString(
                          'en-IN'
                        )}
                      </span>
                    </div>
                    {rating.review ? (
                      <p className="text-sm italic text-gray-600">
                        &quot;{rating.review}&quot;
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-400">
                      — {rating.ratedBy?.name || 'Owner'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="mb-1 font-semibold text-gray-800">
              Job History
            </h3>
            <p className="text-sm text-gray-500">
              Total jobs completed: 0
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 right-0 flex w-full flex-col gap-2 border-t border-gray-100 bg-white p-4 md:w-96 md:max-w-full">
          {canMessage ? (
            <button
              type="button"
              onClick={() => {
                const driverId =
                  driver?._id?.toString() ||
                  driver?.id?.toString()

                const jobId =
                  selectedApplication?.jobId?._id
                    ?.toString() ||
                  selectedApplication?.jobId?.toString() ||
                  null

                console.log('Message button:', {
                  driverId,
                  jobId,
                })

                if (!driverId) {
                  toast.error('Driver ID nahi mila')
                  return
                }
                onClose()
                setTimeout(() => {
                  if (jobId) {
                    navigate(
                      `/owner/messages?jobId=${jobId}&driverId=${driverId}`
                    )
                  } else {
                    navigate(
                      `/owner/messages?driverId=${driverId}`
                    )
                  }
                }, 200)
              }}
              className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Message Karo
            </button>
          ) : (
            <div className="w-full rounded-xl bg-gray-100 py-3 text-center text-sm text-gray-400">
              Application reject ho gayi — message nahi kar sakte
            </div>
          )}
          {selectedApplication?.status === 'pending' && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={acceptLoading}
                onClick={() => onAccept?.()}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {acceptLoading ? '…' : 'Accept Karo'}
              </button>
              {onReject && (
                <button
                  type="button"
                  disabled={acceptLoading}
                  onClick={() => onReject?.()}
                  className="flex-1 rounded-xl border border-red-300 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject Karo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverProfileModal
