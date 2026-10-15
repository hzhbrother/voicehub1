import { db } from '~/drizzle/db'
import { songs } from '~/drizzle/schema'
import { eq } from 'drizzle-orm'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'

// 允许更换音源的角色（管理员 + 投稿人）
const ADMIN_ROLES = ['ADMIN', 'SONG_ADMIN', 'SUPER_ADMIN']

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createApiError(401, 'AUTH_UNAUTHORIZED_ACCESS', '未授权访问')
  }

  const songId = parseInt(getRouterParam(event, 'id'))
  if (!songId) {
    throw createApiError(400, SERVER_ERROR_CODES.SONG_INVALID_ID, 'Invalid song ID')
  }

  const body = await readBody(event)
  const { musicPlatform, musicId, cover, playUrl, durationSeconds } = body

  if (!musicPlatform || !musicId) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '音源平台与ID不能为空')
  }

  const existing = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
  const song = existing[0]
  if (!song) {
    throw createApiError(404, 'SONG_NOT_FOUND', '歌曲不存在')
  }

  // 权限校验：管理员或投稿人本人
  const isAdmin = ADMIN_ROLES.includes(user.role)
  const isRequester = song.requesterId === user.id
  if (!isAdmin && !isRequester) {
    throw createApiError(403, 'COMMON_INSUFFICIENT_PERMISSION', '仅管理员或投稿人可更换音源')
  }

  const updateData: Partial<typeof songs.$inferInsert> = {
    musicPlatform,
    musicId
  }

  // 平台或ID变化时清空缓存的音源数据，避免残留旧平台信息
  if (musicPlatform !== song.musicPlatform || musicId !== song.musicId) {
    updateData.musicSourceData = null
  }

  if (cover !== undefined) updateData.cover = cover || null
  if (playUrl !== undefined) updateData.playUrl = playUrl || null
  if (durationSeconds !== undefined && durationSeconds !== null) {
    const d = Number(durationSeconds)
    if (Number.isFinite(d) && d >= 0 && d <= 7200) {
      updateData.durationSeconds = d
    }
  }

  const updated = await db
    .update(songs)
    .set(updateData)
    .where(eq(songs.id, songId))
    .returning()

  return {
    success: true,
    song: updated[0]
  }
})
