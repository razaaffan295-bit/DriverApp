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

export const savePDF = async (doc, filename) => {
  try {
    if (isNativeApp()) {
      const blob = doc.output('blob')
      const formData = new FormData()
      formData.append('pdf', blob, filename)

      const res = await API.post('/api/upload/pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data?.success && res.data?.url) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({
          url: res.data.url,
          presentationStyle: 'fullscreen',
        })
      } else {
        alert('PDF upload nahi hua. Dobara try karein.')
      }
    } else {
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
  } catch (e) {
    console.error('PDF error:', e)
    alert('PDF nahi khula. Dobara try karein.')
  }
}
