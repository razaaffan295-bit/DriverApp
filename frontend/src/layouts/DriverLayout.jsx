import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const NOTIF_API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:5000'

const DriverLayout = () => {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  useEffect(() => {
    const fetchNotifs = async (withSpinner) => {
      try {
        if (withSpinner) setNotifLoading(true)
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(
          `${NOTIF_API_BASE}/api/notifications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        const data = await res.json()
        if (data.success) {
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (withSpinner) setNotifLoading(false)
      }
    }
    fetchNotifs(true)
    const interval = setInterval(
      () => fetchNotifs(false), 30000
    )
    return () => clearInterval(interval)
  }, [])

  const markRead = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await fetch(
        `${NOTIF_API_BASE}/api/notifications/read`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setUnreadCount(0)
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      )
    } catch (err) {
      console.error(err)
    }
  }

  const getNotifIcon = (type) => {
    if (type === 'new_message') return '💬'
    if (type === 'payment_received') return '💰'
    if (type === 'application_accepted') return '✅'
    if (type === 'complaint_update') return '⚠️'
    if (type === 'new_application') return '🎯'
    return '🔔'
  }

  const BellButton = () => (
    <button
      type="button"
      onClick={() => {
        setShowNotif((prev) => {
          if (!prev) markRead()
          return !prev
        })
      }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        position: 'relative',
        fontSize: '22px',
        lineHeight: 1,
      }}
    >
      🔔
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: '#EF4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
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
    { path: '/driver/dashboard',
      label: 'Dashboard', icon: '🏠' },
    { path: '/driver/profile',
      label: 'Mera Profile', icon: '👤' },
    { path: '/driver/jobs',
      label: 'Jobs Dhundho', icon: '💼' },
    { path: '/driver/applications',
      label: 'Applications', icon: '📋' },
    { path: '/driver/active-job',
      label: 'Active Kaam', icon: '🔧' },
    { path: '/driver/messages',
      label: 'Messages', icon: '💬' },
    { path: '/driver/attendance',
      label: 'Attendance', icon: '📅' },
    { path: '/driver/trips',
      label: 'Trip Records', icon: '🚛' },
    { path: '/driver/payments',
      label: 'Earnings', icon: '💰' },
    { path: '/driver/complaints',
      label: 'Complaints', icon: '⚠️' },
    { path: '/driver/ratings',
      label: 'Ratings', icon: '⭐' },
    { path: '/driver/invites',
      label: 'Kaam Ke Offers', icon: '🎯' },
  ]

  const bottomLinks = [
    { path: '/driver/dashboard',
      icon: '🏠', label: 'Home' },
    { path: '/driver/jobs',
      icon: '💼', label: 'Jobs' },
    { path: '/driver/active-job',
      icon: '🔧', label: 'Kaam' },
    { path: '/driver/profile',
      icon: '👤', label: 'Profile' },
  ]

  const isActive = (path) =>
    location.pathname === path

  return (
    <div>

      {/* DESKTOP SIDEBAR */}
      <div
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed',
          left: 0, top: 0,
          width: '256px',
          height: '100vh',
          background: 'white',
          borderRight: '1px solid #F3F4F6',
          zIndex: 30,
          overflowY: 'auto',
        }}
      >
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontWeight: '800',
            fontSize: '22px',
            color: '#16A34A',
          }}>
            DriverApp
          </span>
          <BellButton />
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
                background: isActive(item.path)
                  ? '#F0FDF4' : 'transparent',
                color: isActive(item.path)
                  ? '#16A34A' : '#374151',
                fontWeight: isActive(item.path)
                  ? '600' : '400',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{
          padding: '8px',
          borderTop: '1px solid #F3F4F6',
        }}>
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
            <span style={{ fontSize: '18px' }}>
              🚪
            </span>
            Logout
          </button>
        </div>
      </div>

      {/* MOBILE TOP BAR */}
      <div
        className="flex md:hidden items-center justify-between"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
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
        >
          <div style={{ width: '22px',
            height: '2px',
            background: '#374151',
            borderRadius: '2px' }} />
          <div style={{ width: '22px',
            height: '2px',
            background: '#374151',
            borderRadius: '2px' }} />
          <div style={{ width: '22px',
            height: '2px',
            background: '#374151',
            borderRadius: '2px' }} />
        </button>

        <span style={{
          fontWeight: '700',
          fontSize: '18px',
          color: '#16A34A',
        }}>
          DriverApp
        </span>

        <BellButton />
      </div>

      {/* NOTIFICATION DROPDOWN */}
      {showNotif && (
        <>
          <div
            onClick={() => setShowNotif(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
              background: 'transparent',
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '60px',
              right: '8px',
              width: '300px',
              maxHeight: '400px',
              background: 'white',
              borderRadius: '16px',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.15)',
              zIndex: 999,
              overflowY: 'auto',
              border: '1px solid #F3F4F6',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1,
            }}>
              <span style={{
                fontWeight: '700',
                fontSize: '15px',
                color: '#111827',
              }}>
                🔔 Notifications
              </span>
              <button
                onClick={() =>
                  setShowNotif(false)}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            {notifLoading ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#9CA3AF',
              }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#9CA3AF',
              }}>
                <div style={{
                  fontSize: '36px',
                  marginBottom: '8px',
                }}>
                  🔔
                </div>
                <div style={{ fontSize: '14px' }}>
                  Koi notification nahi
                </div>
              </div>
            ) : (
              notifications.map((notif, i) => (
                <div
                  key={notif._id || i}
                  onClick={() => {
                    setShowNotif(false)
                    if (notif.link) {
                      navigate(notif.link)
                    }
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom:
                      i < notifications.length - 1
                      ? '1px solid #F9FAFB'
                      : 'none',
                    cursor: notif.link
                      ? 'pointer' : 'default',
                    background: notif.isRead
                      ? 'white' : '#F0FDF4',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{
                    fontSize: '18px',
                    marginTop: '1px',
                    flexShrink: 0,
                  }}>
                    {getNotifIcon(notif.type)}
                  </span>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: notif.isRead
                        ? '500' : '700',
                      fontSize: '13px',
                      color: '#111827',
                      marginBottom: '3px',
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      lineHeight: '1.4',
                    }}>
                      {notif.message}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                      marginTop: '4px',
                    }}>
                      {new Date(notif.createdAt)
                        .toLocaleDateString(
                          'en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                    </div>
                  </div>

                  {!notif.isRead && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      background: '#16A34A',
                      borderRadius: '50%',
                      marginTop: '4px',
                      flexShrink: 0,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* MOBILE OVERLAY */}
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

      {/* MOBILE SIDEBAR */}
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
          boxShadow: open
            ? '4px 0 20px rgba(0,0,0,0.1)'
            : 'none',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #F3F4F6',
        }}>
          <span style={{
            fontWeight: '700',
            fontSize: '20px',
            color: '#16A34A',
          }}>
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
                background: isActive(item.path)
                  ? '#F0FDF4' : 'transparent',
                color: isActive(item.path)
                  ? '#16A34A' : '#374151',
                fontWeight: isActive(item.path)
                  ? '600' : '400',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '18px' }}>
                {item.icon}
              </span>
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
            <span style={{ fontSize: '18px' }}>
              🚪
            </span>
            Logout
          </button>
        </nav>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div
        className="flex md:hidden items-center justify-around"
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
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
              color: isActive(item.path)
                ? '#16A34A' : '#9CA3AF',
              padding: '4px 8px',
            }}
          >
            <span style={{ fontSize: '22px' }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: isActive(item.path)
                ? '600' : '400',
            }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* PAGE CONTENT */}
      <div className="min-h-screen md:ml-64">
        <div className="pt-14 pb-[60px] md:pt-0 md:pb-0">
          <Outlet />
        </div>
      </div>

    </div>
  )
}

export default DriverLayout
