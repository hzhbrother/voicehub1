/**
 * 管理端：专题详情 / 更新 / 部分更新 / 删除
 */
import { db, topics, songs } from '~/drizzle/db'
import { eq } from 'drizzle-orm'

const ADMIN_ROLES = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, message: '只有管理员才能管理专题' })
  }

  const id = parseInt(event.context.params?.id || '0')
  if (!id) {
    throw createError({ statusCode: 400, message: '专题 ID 不正确' })
  }

  const method = event.method

  if (method === 'GET') {
    const result = await db.select().from(topics).where(eq(topics.id, id)).limit(1)
    if (!result[0]) {
      throw createError({ statusCode: 404, message: '专题不存在' })
    }
    return result[0]
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody(event)
    const updateData: Record<string, any> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) throw createError({ statusCode: 400, message: '专题名称不能为空' })
      updateData.name = name
    }
    if (body.description !== undefined) updateData.description = body.description || null
    if (body.cover !== undefined) updateData.cover = body.cover || null
    if (body.startTime !== undefined) updateData.startTime = body.startTime || null
    if (body.endTime !== undefined) updateData.endTime = body.endTime || null
    if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled)
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder) || 0
    if (body.expected !== undefined) updateData.expected = Number(body.expected) || 0

    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      throw createError({ statusCode: 400, message: '开始时间必须早于结束时间' })
    }

    const result = await db.update(topics).set(updateData).where(eq(topics.id, id)).returning()
    if (!result[0]) {
      throw createError({ statusCode: 404, message: '专题不存在' })
    }
    return result[0]
  }

  if (method === 'DELETE') {
    // 删除专题时，把关联歌曲的 topicId 置空
    await db.update(songs).set({ topicId: null }).where(eq(songs.topicId, id))
    await db.delete(topics).where(eq(topics.id, id))
    return { message: '专题已删除' }
  }

  throw createError({ statusCode: 405, message: '不支持的请求方法' })
})
