import { NextRequest, NextResponse } from 'next/server'
import AWS from 'aws-sdk'

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

export async function POST(request: NextRequest) {
  try {
    const { s3Key } = await request.json()
    
    if (!s3Key) {
      return NextResponse.json({ error: 'S3 key required' }, { status: 400 })
    }

    // Generate presigned URL (valid for 1 hour)
    const signedUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Expires: 3600 // 1 hour
    })

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 })
  }
}