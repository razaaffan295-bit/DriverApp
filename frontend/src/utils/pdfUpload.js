import API from '../api/axios'

export const isNativeApp = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      window.Capacitor !== undefined &&
      window.Capacitor.isNativePlatform() === true
    )
  } catch (e) {
    return false
  }
}

export const generateAndOpenPDF = async (
  type,
  data,
  filename
) => {
  try {
    const res = await API.post(
      '/api/upload/generate-pdf',
      { type, data }
    )
    if (res.data?.success && res.data?.url) {
      const { Browser } = await import(
        '@capacitor/browser'
      )
      await Browser.open({
        url: res.data.url,
        presentationStyle: 'fullscreen',
      })
    } else {
      alert('PDF generate nahi hua. Dobara try karein.')
    }
  } catch (e) {
    console.error('PDF error:', e)
    const msg = e?.response?.data?.message
      || e?.message
      || 'Unknown error'
    alert(`PDF nahi khula: ${msg}`)
  }
}

export const savePDF = (doc, filename) => {
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
