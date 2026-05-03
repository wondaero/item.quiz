// Canvas로 이미지 압축 — 100KB 이하, WebP 포맷
export const compressImage = (file, maxKB = 100) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // 최대 1200px 제한
      const MAX_DIM = 1200
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      // 품질 이진 탐색으로 maxKB 이하 찾기
      let lo = 0.1, hi = 0.92, blob = null
      const tryQuality = (q) =>
        new Promise((res) => canvas.toBlob(res, 'image/webp', q))

      const search = async () => {
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2
          blob = await tryQuality(mid)
          if (blob.size <= maxKB * 1024) lo = mid
          else hi = mid
        }
        blob = await tryQuality(lo)
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
      }
      search().catch(reject)
    }
    img.onerror = reject
    img.src = url
  })
