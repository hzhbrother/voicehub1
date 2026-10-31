import { createError, defineEventHandler, getQuery } from 'h3'
import { db } from '~/drizzle/db'
import { users } from '~/drizzle/schema'
import { and, eq, ilike, inArray, ne, or } from 'drizzle-orm'
import { getSystemSettingsCached } from '~~/server/utils/system-settings-helper'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { checkDistributedRateLimit } from '~~/server/utils/rateLimiter'
import { getClientIP } from '~~/server/utils/ip-utils'
import { maskStudentNameForPicker } from '~~/server/utils/studentMask'

// 联合投稿候选人只包含普通用户与歌曲管理员，避免枚举后台账号
const SEARCHABLE_ROLES = ['USER', 'SONG_ADMIN']
const MAX_RESULTS = 5
const ADMIN_MAX_RESULTS = 20
const MAX_KEYWORD_LENGTH = 30
const SEARCH_RATE_LIMIT = 60
const SEARCH_RATE_WINDOW_MS = 60 * 1000
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SONG_ADMIN']

// PostgreSQL LIKE 的默认转义符为反斜杠，转义通配符可防止用 % 或 _ 批量拉取用户
const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&')

export default defineEventHandler(async (event) => {
  // 验证用户登录
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      message: '未登录'
    })
  }

  const query = getQuery(event)
  const { keyword } = query

  const settings = await getSystemSettingsCached()
  if (settings?.enableCollaborativeSubmission === false) {
    throw createError({
      statusCode: 403,
      message: '联合投稿功能已关闭'
    })
  }

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 1) {
    return {
      success: true,
      users: []
    }
  }

  const searchTerm = keyword.trim().slice(0, MAX_KEYWORD_LENGTH)

  for (const key of [`user:${user.id}`, `ip:${getClientIP(event)}`]) {
    const limit = await checkDistributedRateLimit(
      `users:search:${key}`,
      SEARCH_RATE_LIMIT,
      SEARCH_RATE_WINDOW_MS
    )
    if (!limit.isAllowed) {
      throw createApiError(
        429,
        SERVER_ERROR_CODES.COMMON_RATE_LIMITED_SECONDS,
        '搜索过于频繁，请稍后再试',
        { params: [60] }
      )
    }
  }

  try {
    const isAdmin = ADMIN_ROLES.includes(user.role)
    // 管理员可查看完整姓名与用户名，便于代他人投稿时准确识别人选；普通用户仍走脱敏
    const limit = isAdmin ? ADMIN_MAX_RESULTS : MAX_RESULTS

    const results = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        grade: users.grade,
        class: users.class
      })
      .from(users)
      .where(
        and(
          ne(users.id, user.id), // 排除自己
          eq(users.status, 'active'), // 仅搜索活跃用户
          inArray(users.role, SEARCHABLE_ROLES),
          or(
            ilike(users.name, `%${escapeLikePattern(searchTerm)}%`),
            ilike(users.username, `%${escapeLikePattern(searchTerm)}%`)
          )
        )
      )
      .limit(limit)

    return {
      success: true,
      users: results.map((u) => ({
        id: u.id,
        name: isAdmin ? u.name : maskStudentNameForPicker(u.name || ''),
        username: isAdmin ? u.username : null,
        grade: u.grade || null,
        class: u.class || null
      }))
    }
  } catch (error) {
    console.error('搜索用户失败:', error)
    throw createError({
      statusCode: 500,
      message: '搜索用户失败'
    })
  }
})
