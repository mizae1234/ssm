async function compressImageIfNeeded(file: File): Promise<File> {
  // Skip compression for non-images and animated gifs
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      
      const MAX_WIDTH = 2048
      const MAX_HEIGHT = 2048
      let { width, height } = img

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width)
          width = MAX_WIDTH
        } else {
          width = Math.round((width * MAX_HEIGHT) / height)
          height = MAX_HEIGHT
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          // Preserve filename but change extension to .jpg since it is compressed to jpeg
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
          const newName = `${nameWithoutExt}.jpg`
          
          const compressedFile = new File([blob], newName, {
            type: 'image/jpeg',
            lastModified: Date.now()
          })

          console.log(`[Upload Compress] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
          resolve(compressedFile)
        },
        'image/jpeg',
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file) // Fallback on error
    }

    img.src = objectUrl
  })
}

export async function uploadToR2(file: File, folder: string): Promise<string> {
  console.log(`[Upload] Starting upload process for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) into folder: ${folder}`);

  // 1. Compress image if applicable (skip for company logos and signatures to preserve format/transparency/quality)
  let fileToUpload = file
  const isSpecialFile = folder.includes('logo') || folder.includes('signature')
  if (!isSpecialFile) {
    try {
      console.log('[Upload] Checking image compression...');
      fileToUpload = await compressImageIfNeeded(file)
    } catch (err) {
      console.error('[Upload] Image compression failed, uploading original', err)
    }
  } else {
    console.log('[Upload] Skipping image compression for special file (logo/signature)');
  }

  // 2. Validate file size (max 10MB)
  const maxBytes = 10 * 1024 * 1024
  if (fileToUpload.size > maxBytes) {
    console.error('[Upload] File size exceeds 10MB limit:', fileToUpload.size);
    throw new Error('ขนาดไฟล์เกินกำหนด (สูงสุด 10MB)')
  }

  // 3. Fetch the presigned upload URL from our Next.js API endpoint
  console.log('[Upload] Requesting presigned URL from API...');
  const params = new URLSearchParams()
  params.set('filename', fileToUpload.name)
  params.set('contentType', fileToUpload.type)
  params.set('folder', folder)

  const resUrl = await fetch(`/api/upload/presigned?${params.toString()}`)
  if (!resUrl.ok) {
    const errorData = await resUrl.json().catch(() => ({}))
    console.error('[Upload] Failed to fetch presigned URL:', errorData);
    throw new Error(errorData.error || 'ไม่สามารถขออัปโหลด URL ได้')
  }

  const { signedUrl, publicUrl } = await resUrl.json()
  console.log('[Upload] Presigned URL generated successfully. Public URL will be:', publicUrl);

  // 4. Upload the file directly to Cloudflare R2 via PUT request with server-side fallback on failure or timeout (e.g., CORS/Network block)
  try {
    console.log('[Upload] Attempting direct PUT upload to R2...');
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.warn('[Upload] Direct upload timed out after 5s, aborting...');
      controller.abort()
    }, 5000)

    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': fileToUpload.type,
      },
      body: fileToUpload,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!uploadRes.ok) {
      throw new Error(`Direct upload returned status ${uploadRes.status}`)
    }

    console.log('[Upload] Direct PUT upload succeeded!');
    return publicUrl
  } catch (error) {
    console.warn('[Upload] Direct R2 upload failed or timed out, falling back to server-side upload. Error:', error)

    // Fallback: Upload via server-side POST API
    console.log('[Upload] Attempting server-side fallback upload POST /api/upload...');
    const formData = new FormData()
    formData.append('file', fileToUpload)
    formData.append('folder', folder)

    const fallbackRes = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!fallbackRes.ok) {
      const errorData = await fallbackRes.json().catch(() => ({}))
      console.error('[Upload] Server-side fallback upload failed:', errorData);
      throw new Error(errorData.error || 'การอัปโหลดไฟล์ล้มเหลวทั้งช่องทางตรงและเซิร์ฟเวอร์')
    }

    const data = await fallbackRes.json()
    console.log('[Upload] Server-side fallback upload succeeded! Public URL:', data.publicUrl);
    return data.publicUrl
  }
}
