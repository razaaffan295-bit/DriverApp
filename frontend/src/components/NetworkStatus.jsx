import { useState, useEffect } from 'react'

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  )
  const [showOffline, setShowOffline] = useState(false)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOffline(false)
      setShowBackOnline(true)
      setTimeout(() => setShowBackOnline(false), 3000)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!showOffline && !showBackOnline) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: isOnline ? '#10B981' : '#EF4444',
        color: 'white',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: '600',
        zIndex: 9999,
        animation: 'slideDown 0.3s ease',
      }}
    >
      {isOnline
        ? '✅ Wapas online ho gaye!'
        : '⚠️ Internet connection nahi hai'}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default NetworkStatus
