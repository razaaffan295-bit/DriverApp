import { useEffect, useState, useCallback } from 'react'
import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser, setAuth, getToken } from '../../utils/helpers'
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import API from '../../api/axios'
import {
  getOwnerProfile,
  updateOwnerProfile,
  addVehicle,
  getVehicles,
  deleteVehicle,
} from '../../api/ownerAPI'

const OwnerProfile = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab =
    searchParams.get('tab') === 'vehicles' ? 'vehicles' : 'details'

  const setTab = (tab) => {
    if (tab === 'vehicles') setSearchParams({ tab: 'vehicles' })
    else setSearchParams({})
  }

  const [profile, setProfile] = useState({
    companyName: '',
    about: '',
  })
  const [user, setUser] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    vehicleType: '',
    vehicleNumber: '',
    vehicleModel: '',
    state: '',
    district: '',
  })
  const [loading, setLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [addVehicleLoading, setAddVehicleLoading] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [name, setName] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [districtVal, setDistrictVal] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, vRes] = await Promise.all([
        getOwnerProfile(),
        getVehicles(),
      ])
      const u = pRes.data?.user
      const prof = pRes.data?.profile
      setUser(u)
      setProfile({
        companyName: prof?.companyName ?? '',
        about: prof?.about ?? '',
      })
      setName(u?.name ?? '')
      setStateVal(u?.location?.state ?? '')
      setDistrictVal(u?.location?.district ?? '')
      setVehicles(vRes.data?.vehicles ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Data load nahi ho paya. Dobara try karein.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getUser()) return
    loadData()
  }, [loadData])

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O'

  const displayPhoto = user?.profilePhoto

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Sirf image file chuniye')
      e.target.value = ''
      return
    }
    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await API.post(
        '/api/owner/profile/photo',
        formData
      )

      if (res.data?.success) {
        toast.success('Photo upload ho gayi!')
        const url = res.data.photo
        setUser((u) =>
          u ? { ...u, profilePhoto: url } : u
        )
        const stored = getUser()
        if (stored) {
          setAuth(getToken(), {
            ...stored,
            profilePhoto: url,
          })
        }
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          'Photo upload nahi hui'
      )
    }
    e.target.value = ''
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name?.trim()) {
      toast.error('Naam zaroori hai')
      return
    }
    setSaveLoading(true)
    try {
      const payload = {
        name: name.trim(),
        companyName: profile.companyName,
        about: profile.about,
        state: stateVal,
        district: districtVal,
      }

      const { data } = await updateOwnerProfile(payload)
      const nextUser = {
        ...data.user,
        isProfileComplete: data.profile?.isProfileComplete ?? true,
      }
      setUser(nextUser)
      setAuth(getToken(), nextUser)
      setPhotoDataUrl(null)
      toast.success('Profile save ho gaya!')
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Save nahi ho paya. Dobara try karein.'
      )
    } finally {
      setSaveLoading(false)
    }
  }

  const handleVehicleSubmit = async (e) => {
    e.preventDefault()
    if (!vehicleForm.vehicleType) {
      toast.error('Vehicle type chuniye')
      return
    }
    if (!vehicleForm.state || !vehicleForm.district?.trim()) {
      toast.error('State aur district zaroori hain')
      return
    }
    setAddVehicleLoading(true)
    try {
      await addVehicle({
        vehicleType: vehicleForm.vehicleType,
        vehicleNumber: vehicleForm.vehicleNumber.trim().toUpperCase(),
        vehicleModel: vehicleForm.vehicleModel.trim(),
        state: vehicleForm.state,
        district: vehicleForm.district.trim(),
      })
      toast.success('Gadi add ho gayi!')
      setVehicleForm({
        vehicleType: '',
        vehicleNumber: '',
        vehicleModel: '',
        state: '',
        district: '',
      })
      setShowAddForm(false)
      const vRes = await getVehicles()
      setVehicles(vRes.data?.vehicles ?? [])
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Gadi add nahi ho payi.'
      )
    } finally {
      setAddVehicleLoading(false)
    }
  }

  const handleDeleteVehicle = async (id) => {
    setDeleteId(id)
    try {
      await deleteVehicle(id)
      toast.success('Gadi hata di gayi')
      const vRes = await getVehicles()
      setVehicles(vRes.data?.vehicles ?? [])
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Delete nahi ho paya.'
      )
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="p-4 md:p-6">
          {loading && (
            <p className="mb-4 text-sm text-gray-500">Loading...</p>
          )}

          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap border-b border-gray-100">
              <button
                type="button"
                onClick={() => setTab('details')}
                className={`cursor-pointer px-4 py-4 text-sm font-medium sm:px-6 ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-700 text-blue-700'
                    : 'text-gray-500'
                }`}
              >
                Meri Details
              </button>
              <button
                type="button"
                onClick={() => setTab('vehicles')}
                className={`cursor-pointer px-4 py-4 text-sm font-medium sm:px-6 ${
                  activeTab === 'vehicles'
                    ? 'border-b-2 border-blue-700 text-blue-700'
                    : 'text-gray-500'
                }`}
              >
                Meri Gadiyaan
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'details' && (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-50">
                      {displayPhoto ? (
                        <img
                          src={displayPhoto}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-blue-800">
                          {initials}
                        </span>
                      )}
                    </div>
                    <label className="mt-3 cursor-pointer">
                      <span className="inline-block rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                        Photo Change Karein
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Naam <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Phone
                      </label>
                      <input
                        type="text"
                        disabled
                        value={user?.phone ?? ''}
                        className="input-field w-full cursor-not-allowed bg-gray-100 text-gray-600"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={profile.companyName}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            companyName: e.target.value,
                          }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        About
                      </label>
                      <textarea
                        rows={3}
                        value={profile.about}
                        onChange={(e) =>
                          setProfile((p) => ({ ...p, about: e.target.value }))
                        }
                        className="input-field w-full resize-y"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        State
                      </label>
                      <select
                        value={stateVal}
                        onChange={(e) => setStateVal(e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="">State chuniye</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        District
                      </label>
                      <input
                        type="text"
                        value={districtVal}
                        onChange={(e) => setDistrictVal(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="btn-primary min-h-[44px] disabled:opacity-60"
                  >
                    {saveLoading ? 'Saving...' : 'Profile Save Karein'}
                  </button>
                </form>
              )}

              {activeTab === 'vehicles' && (
                <div>
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">
                      Meri Gadiyaan
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowAddForm((v) => !v)}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      + Nayi Gadi Add Karein
                    </button>
                  </div>

                  {showAddForm && (
                    <form
                      onSubmit={handleVehicleSubmit}
                      className="mb-6 rounded-2xl bg-blue-50 p-4 sm:p-6"
                    >
                      <h3 className="mb-4 font-semibold text-gray-800">
                        Nayi Gadi Add Karein
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Vehicle Type
                          </label>
                          <select
                            value={vehicleForm.vehicleType}
                            onChange={(e) =>
                              setVehicleForm((f) => ({
                                ...f,
                                vehicleType: e.target.value,
                              }))
                            }
                            className="input-field w-full"
                            required
                          >
                            <option value="">Vehicle type chuniye</option>
                            {VEHICLE_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Vehicle Number
                          </label>
                          <input
                            type="text"
                            value={vehicleForm.vehicleNumber}
                            onChange={(e) =>
                              setVehicleForm((f) => ({
                                ...f,
                                vehicleNumber: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="BR01AB1234"
                            className="input-field w-full uppercase"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Vehicle Model
                          </label>
                          <input
                            type="text"
                            value={vehicleForm.vehicleModel}
                            onChange={(e) =>
                              setVehicleForm((f) => ({
                                ...f,
                                vehicleModel: e.target.value,
                              }))
                            }
                            placeholder="JCB 3DX"
                            className="input-field w-full"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            State
                          </label>
                          <select
                            value={vehicleForm.state}
                            onChange={(e) =>
                              setVehicleForm((f) => ({
                                ...f,
                                state: e.target.value,
                              }))
                            }
                            className="input-field w-full"
                            required
                          >
                            <option value="">State chuniye</option>
                            {STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            District
                          </label>
                          <input
                            type="text"
                            value={vehicleForm.district}
                            onChange={(e) =>
                              setVehicleForm((f) => ({
                                ...f,
                                district: e.target.value,
                              }))
                            }
                            className="input-field w-full"
                            required
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={addVehicleLoading}
                          className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                          {addVehicleLoading ? 'Adding...' : 'Gadi Add Karein'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {vehicles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="text-gray-600">
                        Abhi koi gadi add nahi ki
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                      >
                        + Nayi Gadi Add Karein
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {vehicles.map((v) => {
                        const hasDriver =
                          v.assignedDriver != null &&
                          (typeof v.assignedDriver === 'object'
                            ? v.assignedDriver
                            : null)
                        const driverName =
                          hasDriver && v.assignedDriver?.name
                            ? v.assignedDriver.name
                            : null
                        return (
                          <li
                            key={v._id}
                            className="rounded-2xl border border-gray-100 bg-white p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                            onClick={() => navigate(`/owner/vehicles/${v._id}`)}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                {v.vehicleType}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900">
                                  {v.vehicleNumber || '—'}
                                </span>
                                <span className="text-gray-400">→</span>
                              </div>
                            </div>
                            <p className="mt-3 text-sm text-gray-600">
                              <span className="font-medium text-gray-700">
                                Model:
                              </span>{' '}
                              {v.vehicleModel || '—'}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium text-gray-700">
                                Location:
                              </span>{' '}
                              {v.location?.state || '—'},{' '}
                              {v.location?.district || '—'}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium text-gray-700">
                                Driver:
                              </span>{' '}
                              {driverName || 'Driver assigned nahi'}
                            </p>
                            {!v.assignedDriver && (
                              <button
                                type="button"
                                disabled={deleteId === v._id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteVehicle(v._id)
                                }}
                                className="mt-3 text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                              >
                                {deleteId === v._id ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}

export default OwnerProfile
