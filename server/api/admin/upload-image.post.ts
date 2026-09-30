import { promises as fs } from 'fs'
import path from 'path'
import formidable from 'formidable'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
])

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif'
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.AUTH_UNAUTHORIZED_ACCESS, '未授权访问')
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw createApiError(403, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '只有管理员可以上传图片')
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  try {
    await fs.access(uploadDir)
  } catch {
    await fs.mkdir(uploadDir, { recursive: true })
  }

  const form = formidable({
    uploadDir,
    keepExtensions: false,
    maxFileSize: MAX_FILE_SIZE,
    filter: ({ mimetype }) => ALLOWED_MIME.has(mimetype || '')
  })

  let files
  try {
    ;[, files] = await form.parse(event.node.req)
  } catch (error: any) {
    if (error?.code === 1009) {
      throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, `图片大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '图片上传失败，请重试')
  }

  const file = files.file?.[0]
  if (!file) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '请选择要上传的图片')
  }

  const ext = MIME_TO_EXT[file.mimetype || ''] || path.extname(file.originalFilename || '').slice(1) || 'png'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const filename = `logo-${timestamp}-${random}.${ext}`
  const targetPath = path.join(uploadDir, filename)

  await fs.rename(file.filepath, targetPath)

  return {
    success: true,
    url: `/uploads/${filename}`
  }
})
