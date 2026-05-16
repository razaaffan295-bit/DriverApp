import { useState } from 'react'
import { optimizeImage } from '../utils/imageOptimize'

const OptimizedImage = ({
  src,
  alt = '',
  width = 400,
  style = {},
  className = '',
  fallback = '👤',
  ...props
}) => {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F3F4F6',
          color: '#9CA3AF',
          fontSize: '24px',
          ...style,
        }}
        className={className}
      >
        {fallback}
      </div>
    )
  }

  const optimizedSrc = optimizeImage(src, { width })

  return (
    <div
      style={{
        position: 'relative',
        ...style,
        overflow: 'hidden',
      }}
      className={className}
    >
      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'imgShimmer 1.5s infinite',
          }}
        />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
        {...props}
      />
      <style>{`
        @keyframes imgShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

export default OptimizedImage
