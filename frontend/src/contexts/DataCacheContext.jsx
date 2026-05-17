import { 
  createContext, 
  useContext, 
  useState, 
  useCallback 
} from 'react'

const DataCacheContext = createContext({})

export const DataCacheProvider = ({ children }) => {
  const [cache, setCache] = useState({})

  const getCachedData = useCallback((key) => {
    const entry = cache[key]
    if (!entry) return null
    
    // Cache expires after 60 seconds
    const age = Date.now() - entry.timestamp
    if (age > 60000) {
      return null
    }
    return entry.data
  }, [cache])

  const setCachedData = useCallback((key, data) => {
    setCache((prev) => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now(),
      },
    }))
  }, [])

  const clearCache = useCallback((key) => {
    if (key) {
      setCache((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      setCache({})
    }
  }, [])

  return (
    <DataCacheContext.Provider
      value={{
        getCachedData,
        setCachedData,
        clearCache,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  )
}

export const useDataCache = () => {
  const ctx = useContext(DataCacheContext)
  if (!ctx) {
    throw new Error(
      'useDataCache must be used within DataCacheProvider'
    )
  }
  return ctx
}
