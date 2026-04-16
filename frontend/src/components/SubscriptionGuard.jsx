import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { checkSubscription } from '../api/subscriptionAPI'
import { getUser } from '../utils/helpers'

const EXEMPT_PATHS = [
  '/subscription',
  '/login',
  '/signup',
  '/',
  '/admin/login',
]

const SubscriptionGuard = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [daysLeft, setDaysLeft] = useState(null)
  const user = getUser()

  const POPUP_KEY = 'sub_popup_dismissed'

  const wasPopupDismissedToday = () => {
    try {
      const val = sessionStorage.getItem(POPUP_KEY)
      if (!val) return false
      return true
    } catch {
      return false
    }
  }

  const markPopupDismissed = () => {
    try {
      sessionStorage.setItem(
        POPUP_KEY, 
        new Date().toDateString()
      )
    } catch {}
  }

  useEffect(() => {
    const check = async () => {
      try {
        if (!user) {
          setChecked(true)
          return
        }

        if (user.role === 'admin') {
          setChecked(true)
          return
        }

        const isExempt =
          EXEMPT_PATHS.includes(location.pathname) ||
          location.pathname.startsWith('/admin')

        if (isExempt) {
          setChecked(true)
          return
        }

        const res = await checkSubscription()
        const data = res.data

        // Permanent free or active subscription
        if (data.isActive) {
          setChecked(true)
          setShowPopup(false)
          return
        }

        // Deadline passed - hard redirect
        if (
          data.subscriptionRequired &&
          data.deadlinePassed
        ) {
          navigate('/subscription', { replace: true })
          return
        }

        // Subscription required but deadline not passed
        // Show popup warning
        if (data.subscriptionRequired) {
          const deadline = new Date(data.subscriptionDeadline)
          const now = new Date()
          const days = Math.ceil(
            (deadline - now) / (24 * 60 * 60 * 1000)
          )
          setDaysLeft(days)
          if (!wasPopupDismissedToday()) {
            setShowPopup(true)
          }
          setChecked(true)
          return
        }

        setChecked(true)
      } catch (e) {
        setChecked(true)
      }
    }

    check()
  }, [location.pathname])

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      {children}
      {showPopup && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'white',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            border: '2px solid #EF4444',
            maxWidth: '360px',
            width: 'calc(100% - 32px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <p style={{ fontWeight: '700', color: '#111827', fontSize: '14px' }}>
              Subscription Required
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPopup(false)
                markPopupDismissed()
              }}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#9CA3AF',
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            {daysLeft !== null && daysLeft > 0
              ? `Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} left! Subscribe to continue.`
              : 'Your free trial has ended. Please subscribe.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/subscription')}
            style={{
              background: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '10px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Subscribe Now →
          </button>
        </div>
      )}
    </>
  )
}

export default SubscriptionGuard

