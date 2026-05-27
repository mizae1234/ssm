import { NextRequest, NextResponse } from 'next/server'
import { r2, BUCKET_NAME, PUBLIC_URL } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filename = searchParams.get('filename')
    const contentType = searchParams.get('contentType')
    const folder = searchParams.get('folder') || 'general'

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 })
    }

    // Sanitize filename to support English, digits, and Thai alphabets/vowels/tone marks
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_ก-๙]/g, '_')
    const uniqueName = `${uuidv4().substring(0, 8)}_${safeName}`
    const key = `${folder}/${uniqueName}`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    })

    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 })
    const publicUrl = `${PUBLIC_URL}/${key}`

    return NextResponse.json({ signedUrl, publicUrl, key })
  } catch (error: any) {
    console.error('[API] GET /api/upload/presigned error:', error)
    return NextResponse.json({ error: 'Failed to generate upload URL: ' + error.message }, { status: 500 })
  }
}
