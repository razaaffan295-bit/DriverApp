// Optimize Cloudinary image URLs
// Auto-compress, WebP format, smaller size
export const optimizeImage = (url, options = {}) => {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('cloudinary.com')) return url

  const {
    width = 400,
    quality = 'auto',
    format = 'auto',
  } = options

  // Insert transformation after /upload/
  const transformations = [
    `w_${width}`,
    `q_${quality}`,
    `f_${format}`,
    'c_limit',
  ].join(',')

  return url.replace(
    '/upload/',
    `/upload/${transformations}/`
  )
}

// Optimized image component
export const getImageProps = (src, size = 400) => ({
  src: optimizeImage(src, { width: size }),
  loading: 'lazy',
  decoding: 'async',
})

// Profile photo optimization (small size)
export const profilePhoto = (url) =>
  optimizeImage(url, { width: 200, quality: 'auto' })

// Thumbnail optimization (very small)
export const thumbnail = (url) =>
  optimizeImage(url, { width: 100, quality: 'auto:low' })

// Full size optimization (for viewing)
export const fullImage = (url) =>
  optimizeImage(url, { width: 1200, quality: 'auto:good' })

export default optimizeImage
