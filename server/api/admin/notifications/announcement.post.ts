import { eq } from 'drizzle-orm'
import { db } from '~/drizzle/db'
import { announcementHistory, systemSettings } from '~/drizzle/schema'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import {
  canSendSystemNotification,
  NOTIFICATION_CONTENT_MAX_LENGTH,
  createNotificationSenderSnapshot
} from '~~/server/utils/important-notification-policy'
import { enqueueAstrbotGroupEvent } from '~~/server/services/astrbotGroupService'

/**
 * 发布首页公告。
 *
 * 与「发送通知」共用同一个发布入口，但公告只写 SystemSettings.announcement，
 * 不生成任何用户级通知，因此不会触发弹窗提醒；发布记录单独写入
 * AnnouncementHistory，供发送历史里的「首页公告」分类查看。
 */
export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createApiError(401, SERVER_ERROR_CODES.NOTIFICATION_AUTH_REQUIRED, '需要登录才能发布公告')
  }

  if (!canSendSystemNotification(user.role)) {
    throw createApiError(
      403,
      SERVER_ERROR_CODES.NOTIFICATION_ADMIN_REQUIRED,
      '只有管理员可以发布公告'
    )
  }

  const body = await readBody<Record<string, unknown> | null>(event)
  const rawContent = typeof body?.content === 'string' ? body.content : ''
  const content = rawContent.trim()

  if (!content) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '公告内容不能为空')
  }
  if (content.length > NOTIFICATION_CONTENT_MAX_LENGTH) {
    throw createApiError(
      400,
      SERVER_ERROR_CODES.COMMON_INVALID_PARAMS,
      `公告内容不能超过 ${NOTIFICATION_CONTENT_MAX_LENGTH} 个字符`
    )
  }
  if (body?.broadcast !== undefined && typeof body?.broadcast !== 'boolean') {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '群聊转发标记必须是布尔值')
  }
  const broadcastToGroups = body?.broadcast === true
  const sender = createNotificationSenderSnapshot(user)

  const [existing] = await db.select({ id: systemSettings.id }).from(systemSettings).limit(1)
  if (existing) {
    await db
      .update(systemSettings)
      .set({ announcement: content, updatedAt: new Date() })
      .where(eq(systemSettings.id, existing.id))
  } else {
    await db.insert(systemSettings).values({ announcement: content })
  }

  await db.insert(announcementHistory).values({
    content,
    senderId: sender.senderId,
    senderName: sender.senderName,
    senderUsername: sender.senderUsername,
    broadcastToGroups
  })

  // 群聊转发失败不影响公告发布结果，与通知发送保持同一处置口径
  if (broadcastToGroups) {
    try {
      await enqueueAstrbotGroupEvent('systemNotice', '站点公告', content)
    } catch (error) {
      console.error('转发站点公告到群聊失败:', error)
    }
  }

  return {
    success: true,
    content,
    broadcastToGroups
  }
})
