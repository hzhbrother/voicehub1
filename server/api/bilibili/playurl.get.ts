/**
 * Bilibili 播放链接获取接口
 * 代码参考 https://github.com/rio4raki/Bilibili-audio-extraction 优化
 * 采用 platform=html5 获取对浏览器 <audio> 标签兼容性最好的直链
 * 同时转发客户端 IP，解决海外服务器获取到错误 CDN 节点导致访问慢的问题
 */
import { defineEventHandler, getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getClientIP } from '~~/server/utils/ip-utils'

interface DashAudioItem {
  id: number
  baseUrl: string
  bandwidth: number
}

interface PlayUrlRes {
  code: number
  message: string
  data: {
    durl?: { url: string }[]
    dash?: {
      audio?: DashAudioItem[]
    }
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bvid = query.id as string
  const cid = query.cid as string

  if (!bvid) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少 id 参数')
  }

  // 提取客户端真实 IP，用于转发给 Bilibili 接口，以便分配最快 CDN 节点
  const clientIp = getClientIP(event)

  const headers: Record<string, string> = {
    Cookie: 'buvid3=0',
    Referer: 'https://www.bilibili.com/',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  if (clientIp !== 'unknown') {
    headers['X-Forwarded-For'] = clientIp
    headers['X-Real-IP'] = clientIp
    headers['Client-IP'] = clientIp
  }

  try {
    let finalCid = cid

    if (!finalCid) {
      const target_url = 'https://api.bilibili.com/x/web-interface/view'
      const resp1: any = await $fetch(target_url, {
        method: 'GET',
        params: { bvid },
        headers,
        timeout: 10000
      })

      if (resp1?.code !== 0 || !resp1?.data?.pages?.[0]?.cid) {
        console.error('[Bilibili] CID 获取失败，响应:', JSON.stringify(resp1).slice(0, 300))
        // 降级：去掉 Cookie 重试，部分场景 Cookie 反而触发风控
        try {
          const fallback: any = await $fetch(target_url, {
            method: 'GET',
            params: { bvid },
            headers: {
              Referer: 'https://www.bilibili.com/',
              'User-Agent': headers['User-Agent']
            },
            timeout: 10000
          })
          if (fallback?.data?.pages?.[0]?.cid) {
            finalCid = fallback.data.pages[0].cid
          } else {
            console.error('[Bilibili] 降级请求仍无 CID，响应:', JSON.stringify(fallback).slice(0, 300))
            throw new Error(fallback?.message || '获取 CID 失败')
          }
        } catch (fallbackErr: any) {
          throw new Error(`获取 CID 失败: ${fallbackErr?.message || '未知错误'}`)
        }
      } else {
        finalCid = resp1.data.pages[0].cid
      }
    }

    const target_url2 = 'https://api.bilibili.com/x/player/playurl'

    // 优先使用 fnval=1（progressive，durl 直链，浏览器 <audio> 兼容性最好）
    const resp2 = await $fetch<PlayUrlRes>(target_url2, {
      method: 'GET',
      params: {
        fnval: 1,
        platform: 'html5',
        high_quality: 1,
        bvid,
        cid: finalCid
      },
      headers,
      timeout: 10000
    })

    if (resp2.code !== 0) {
      throw new Error(`B站接口返回错误 ${resp2.code}: ${resp2.message || '未知错误'}`)
    }

    // progressive 直链
    if (resp2.data?.durl?.length > 0) {
      const url = resp2.data.durl[0].url
      return { url, pay: false }
    }

    // 回退 fnval=16（DASH），取码率最高的音频流
    const respDash = await $fetch<PlayUrlRes>(target_url2, {
      method: 'GET',
      params: {
        fnval: 16,
        platform: 'html5',
        high_quality: 1,
        bvid,
        cid: finalCid
      },
      headers,
      timeout: 10000
    })

    if (respDash.code !== 0) {
      throw new Error(`B站 DASH 接口返回错误 ${respDash.code}: ${respDash.message || '未知错误'}`)
    }

    const audios = respDash.data?.dash?.audio || []
    if (audios.length > 0) {
      const best = audios.reduce((a, b) => (a.bandwidth > b.bandwidth ? a : b))
      return { url: best.baseUrl, pay: false }
    }

    console.error('[Bilibili] 无可用音频流，progressive 响应:', JSON.stringify(resp2).slice(0, 300))
    throw new Error('视频无可用音频流（可能为付费/地区限制/仅画面）')
  } catch (error: any) {
    console.error('[Bilibili] playurl error:', error?.message || error)
    throw createApiError(500, SERVER_ERROR_CODES.BILIBILI_PLAYURL_FAILED, error.message || '获取 Bilibili 音频链接失败')
  }
})
