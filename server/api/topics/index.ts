/**
 * 公开专题列表：返回当前启用且在有效期内的专题
 */
import { db, eq, topics } from '~/drizzle/db'
import { and, or, isNull, lte, gt } from 'drizzle-orm'
import { getBeijingTimeISOString } from '~/utils/timeUtils'

export default defineEventHandler(async () => {
  try {
    const now = getBeijingTimeISOString()
    const list = await db
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.enabled, true),
          or(isNull(topics.startTime), lte(topics.startTime, now)),
          or(isNull(topics.endTime), gt(topics.endTime, now))
        )
      )
      .orderBy(topics.sortOrder)
    return list
  } catch (error) {
    console.error('获取专题列表失败:', error)
    throw createError({ statusCode: 500, message: '获取专题列表失败' })
  }
})
