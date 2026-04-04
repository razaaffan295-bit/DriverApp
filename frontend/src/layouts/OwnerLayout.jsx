import { useState, useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import API from '../api/axios'

const notifTypeIcon = (type) => {
  if (type === 'new_message') return '💬'
  if (type === 'payment_received') return '💰'
  if (type === 'application_accepted') return '✅'
  if (type === 'complaint_update') return '⚠️'
  if (type === 'trip_submitted' || type === 'trip_update') return '🚛'
  return '🔔'
}

const getNotifLink = (notif) => {
  if (notif?.link && String(notif.link).trim()) {
    return String(notif.link).trim()
  }
  switch (notif?.type) {
    case 'new_message':
      return '/owner/messages'
    case 'payment_received':
    case 'payment_request':
      return '/owner/payments'
    case 'new_application':
    case 'application_accepted':
    case 'application_rejected':
      return '/owner/applications'
    case 'complaint_update':
      return '/owner/complaints'
    case 'trip_submitted':
    case 'trip_update':
      return '/owner/trips'
    default:
      return '/owner/dashboard'
  }
}

const OwnerLayout = () => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const unreadDotColor = '#3B82F6'

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setNotifLoading(true)
      const res = await API.get('/api/notifications')
      const data = res.data
      if (data.success) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      if (!silent) setNotifLoading(false)
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await API.put('/api/notifications/read')
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchNotifications(false)
    const interval = setInterval(() => fetchNotifications(true), 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const toggleNotifPanel = () => {
    setShowNotif((prev) => {
      if (!prev) {
        markAllNotificationsRead()
      }
      return !prev
    })
  }

  const renderBellButton = (iconSize = '22px') => (
    <button
      type="button"
      onClick={toggleNotifPanel}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        position: 'relative',
      }}
      aria-label="Notifications"
    >
      <span style={{ fontSize: iconSize }}>🔔</span>
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: '#EF4444',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )

  const sidebarLinks = [
    { path: '/owner/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/owner/profile', label: 'Profile', icon: '👤' },
    { path: '/owner/vehicles', label: 'Meri Gadiyaan', icon: '🚛' },
    { path: '/owner/post-job', label: 'Job Post Karo', icon: '📝' },
    { path: '/owner/jobs', label: 'Meri Jobs', icon: '💼' },
    { path: '/owner/applications', label: 'Applications', icon: '📋' },
    { path: '/owner/messages', label: 'Messages', icon: '💬' },
    { path: '/owner/drivers', label: 'Mere Drivers', icon: '👥' },
    { path: '/owner/invite-driver', label: 'Driver Add Karo', icon: '➕' },
    { path: '/owner/attendance', label: 'Attendance', icon: '📅' },
    { path: '/owner/trips', label: 'Trip Requests', icon: '🔧' },
    { path: '/owner/payments', label: 'Payments', icon: '💰' },
    { path: '/owner/complaints', label: 'Complaints', icon: '⚠️' },
    { path: '/owner/ratings', label: 'Ratings', icon: '⭐' },
  ]

  const bottomLinks = [
    { path: '/owner/dashboard', icon: '🏠', label: 'Home' },
    { path: '/owner/applications', icon: '📋', label: 'Apply' },
    { path: '/owner/drivers', icon: '👥', label: 'Drivers' },
    { path: '/owner/profile', icon: '👤', label: 'Profile' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div>
      {/* ═══ DESKTOP SIDEBAR ═══ */}
      <div
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '256px',
          height: '100vh',
          background: 'white',
          borderRight: '1px solid #F3F4F6',
          zIndex: 30,
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '20px 16px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontWeight: '800',
              fontSize: '22px',
              color: '#1D4ED8',
            }}
          >
            DriverApp
          </span>
          {renderBellButton('20px')}
        </div>

        <nav style={{ padding: '8px', flex: 1 }}>
          {sidebarLinks.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '11px 16px',
                marginBottom: '2px',
                background: isActive(item.path) ? '#EFF6FF' : 'transparent',
                color: isActive(item.path) ? '#1D4ED8' : '#374151',
                fontWeight: isActive(item.path) ? '600' : '400',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div
          style={{
            padding: '8px',
            borderTop: '1px solid #F3F4F6',
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '11px 16px',
              background: '#FEF2F2',
              color: '#EF4444',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <span style={{ fontSize: '18px' }}>🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* ═══ MOBILE TOP BAR (md:hidden — no inline display:flex or it overrides hidden on desktop) ═══ */}
      <div
        className="flex md:hidden items-center justify-between"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'white',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 16px',
          zIndex: 40,
        }}
      >
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
          aria-label="Open menu"
        >
          <div
            style={{
              width: '22px',
              height: '2px',
              background: '#374151',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '22px',
              height: '2px',
              background: '#374151',
              borderRadius: '2px',
            }}
          />
          <div
            style={{
              width: '22px',
              height: '2px',
              background: '#374151',
              borderRadius: '2px',
            }}
          />
        </button>

        <span
          style={{
            fontWeight: '700',
            fontSize: '18px',
            color: '#1D4ED8',
          }}
        >
          DriverApp
        </span>

        {renderBellButton('22px')}
      </div>

      {/* ═══ MOBILE OVERLAY ═══ */}
      {open && (
        <div
          className="md:hidden"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 48,
          }}
        />
      )}

      {/* ═══ MOBILE SIDEBAR ═══ */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: open ? '0px' : '-280px',
          width: '270px',
          height: '100vh',
          background: 'white',
          zIndex: 49,
          overflowY: 'auto',
          transition: 'left 0.25s ease',
          boxShadow: open ? '4px 0 20px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <span style={{ fontWeight: '700', fontSize: '20px', color: '#1D4ED8' }}>
            DriverApp
          </span>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav style={{ padding: '8px' }}>
          {sidebarLinks.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '13px 16px',
                marginBottom: '2px',
                background: isActive(item.path) ? '#EFF6FF' : 'transparent',
                color: isActive(item.path) ? '#1D4ED8' : '#374151',
                fontWeight: isActive(item.path) ? '600' : '400',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '13px 16px',
              marginTop: '8px',
              background: '#FEF2F2',
              color: '#EF4444',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            <span style={{ fontSize: '18px' }}>🚪</span>
            Logout
          </button>
        </nav>
      </div>

      {/* ═══ MOBILE BOTTOM NAVBAR ═══ */}
      <div
        className="flex md:hidden items-center justify-around"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'white',
          borderTop: '1px solid #E5E7EB',
          zIndex: 40,
        }}
      >
        {bottomLinks.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive(item.path) ? '#1D4ED8' : '#9CA3AF',
              padding: '4px 8px',
            }}
          >
            <span style={{ fontSize: '22px' }}>{item.icon}</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: isActive(item.path) ? '600' : '400',
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ PAGE CONTENT ═══ */}
      <div
        className="md:ml-64"
        style={{ minHeight: '100vh', background: '#F0F4FF' }}
      >
        <div className="pt-14 pb-[60px] md:pt-0 md:pb-0">
          <Outlet />
        </div>
      </div>

      {showNotif && (
        <>
          <div
            role="presentation"
            onClick={() => setShowNotif(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
            }}
          />
          <div
            className="fixed z-[99] max-h-[400px] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-2xl bg-white shadow-lg max-md:right-4 max-md:top-14 md:left-4 md:top-16"
            style={{
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #F3F4F6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontWeight: '600',
                  fontSize: '16px',
                }}
              >
                Notifications
              </span>
              <button
                type="button"
                onClick={() => setShowNotif(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9CA3AF',
                }}
              >
                ✕
              </button>
            </div>

            {notifLoading ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                }}
              >
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
                Koi notification nahi
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setShowNotif(false)
                    navigate(getNotifLink(notif))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowNotif(false)
                      navigate(getNotifLink(notif))
                    }
                  }}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #F9FAFB',
                    cursor: 'pointer',
                    background: notif.isRead ? 'white' : '#EFF6FF',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontSize: '20px',
                      marginTop: '2px',
                    }}
                  >
                    {notifTypeIcon(notif.type)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: notif.isRead ? '400' : '600',
                        fontSize: '14px',
                        color: '#1F2937',
                        marginBottom: '4px',
                      }}
                    >
                      {notif.title}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        lineHeight: '1.4',
                      }}
                    >
                      {notif.message}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#9CA3AF',
                        marginTop: '4px',
                      }}
                    >
                      {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {!notif.isRead && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        background: unreadDotColor,
                        borderRadius: '50%',
                        marginTop: '6px',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default OwnerLayout

