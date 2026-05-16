const shimmerStyle = {
  background:
    'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '8px',
}

const ShimmerCSS = () => (
  <style>{`
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `}</style>
)

// Basic skeleton box
export const SkeletonBox = ({
  width = '100%',
  height = '20px',
  style = {},
}) => (
  <>
    <ShimmerCSS />
    <div
      style={{
        ...shimmerStyle,
        width,
        height,
        ...style,
      }}
    />
  </>
)

// Card skeleton - for list items
export const SkeletonCard = () => (
  <>
    <ShimmerCSS />
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '16px',
        marginBottom: '12px',
        border: '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            ...shimmerStyle,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              ...shimmerStyle,
              height: '14px',
              width: '60%',
              marginBottom: '8px',
            }}
          />
          <div
            style={{
              ...shimmerStyle,
              height: '12px',
              width: '40%',
            }}
          />
        </div>
      </div>
      <div
        style={{
          ...shimmerStyle,
          height: '12px',
          width: '100%',
          marginBottom: '6px',
        }}
      />
      <div
        style={{
          ...shimmerStyle,
          height: '12px',
          width: '80%',
        }}
      />
    </div>
  </>
)

// List skeleton - multiple cards
export const SkeletonList = ({ count = 3 }) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
)

// Dashboard stats skeleton
export const SkeletonStats = ({ count = 4 }) => (
  <>
    <ShimmerCSS />
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid #F3F4F6',
          }}
        >
          <div
            style={{
              ...shimmerStyle,
              height: '28px',
              width: '50%',
              marginBottom: '8px',
            }}
          />
          <div
            style={{
              ...shimmerStyle,
              height: '14px',
              width: '70%',
            }}
          />
        </div>
      ))}
    </div>
  </>
)

// Profile skeleton
export const SkeletonProfile = () => (
  <>
    <ShimmerCSS />
    <div
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            ...shimmerStyle,
            width: '80px',
            height: '80px',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            ...shimmerStyle,
            height: '18px',
            width: '60%',
          }}
        />
        <div
          style={{
            ...shimmerStyle,
            height: '14px',
            width: '40%',
          }}
        />
      </div>
    </div>
  </>
)

// Page skeleton - full page loading
export const SkeletonPage = () => (
  <div style={{ padding: '16px' }}>
    <SkeletonStats count={3} />
    <SkeletonList count={4} />
  </div>
)

export default SkeletonCard
