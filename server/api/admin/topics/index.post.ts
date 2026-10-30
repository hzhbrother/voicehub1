/**
 * 管理端：创建专题
 */
import { db, topics } from '~/drizzle/db'

const ADMIN_ROLES = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, message: '只有管理员才能创建专题' })
  }

  const body = await readBody(event)

  if (!body.name || !String(body.name).trim()) {
    throw createError({ statusCode: 400, message: '专题名称不能为空' })
  }

  if (body.startTime && body.endTime && body.startTime >= body.endTime) {
    throw createError({ statusCode: 400, message: '开始时间必须早于结束时间' })
  }

  try {
    const result = await db
      .insert(topics)
      .values({
        name: String(body.name).trim(),
        description: body.description ? String(body.description) : null,
        cover: body.cover ? String(body.cover) : null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
        sortOrder: body.sortOrder ? Number(body.sortOrder) : 0,
        expected: body.expected ? Number(body.expected) : 0,
        accepted: 0
      })
      .returning()
    return result[0]
  } catch (error: any) {
    console.error('创建专题失败:', error)
    if (error.statusCode) throw error
    throw createError({ statusCode: 500, message: '创建专题失败' })
  }
})
