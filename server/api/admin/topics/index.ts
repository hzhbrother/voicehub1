/**
 * 管理端：获取所有专题
 */
import { db, topics } from '~/drizzle/db'
import { asc, desc } from 'drizzle-orm'

const ADMIN_ROLES = ['SONG_ADMIN', 'ADMIN', 'SUPER_ADMIN']

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: '未授权访问' })
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, message: '只有管理员才能管理专题' })
  }

  try {
    const list = await db
      .select()
      .from(topics)
      .orderBy(desc(topics.enabled), asc(topics.sortOrder), asc(topics.startTime))
    return list
  } catch (error) {
    console.error('获取专题列表失败:', error)
    throw createError({ statusCode: 500, message: '获取专题列表失败' })
  }
})
