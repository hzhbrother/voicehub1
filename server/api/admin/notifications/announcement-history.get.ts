import { desc, sql } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { canSendSystemNotification } from '~~/server/utils/important-notification-policy'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

/**
 * 首页公告发布历史。每次发布一条记录，不存在按用户展开的已读明细，
 * 因此这里只做倒序列表，不分页明细。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能查看公告历史')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以查看公告历史'
    )
  }

  const query = getQuery(event)
  const parsedLimit = parseInt(String(query.limit || ''), 10)
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT

  try {
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(announcementHistory)
        .orderBy(desc(announcementHistory.createdAt), desc(announcementHistory.id))
        .limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(announcementHistory)
    ])

    return {
      announcements: rows.map((row) => ({
        id: row.id,
        content: row.content,
        senderId: row.senderId,
        senderName: row.senderName,
        senderUsername: row.senderUsername,
        broadcastToGroups: row.broadcastToGroups,
        createdAt: row.createdAt
      })),
      total: Number(totalRows[0]?.count ?? 0)
    }
  } catch (error) {
    console.error('读取公告发布历史失败:', error)
    throw createApiError(
      500,
      SERVER_ERROR_CODES.NOTIFICATION_HISTORY_FETCH_FAILED,
      '读取公告发布历史失败'
    )
  }
})
