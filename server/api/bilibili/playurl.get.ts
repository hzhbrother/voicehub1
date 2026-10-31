/**
 * Bilibili 播放链接获取接口
 * 取链顺序：fnval=1 直链 → fnval=16 DASH → WBI 签名接口 → fnval=4048 全格式
 * CID 获取：x/web-interface/view → x/player/pagelist 回退
 */
import { defineEventHandler, getQuery } from 'h3'
import { createApiError } from '~~/server/utils/apiError'
import { SERVER_ERROR_CODES } from '~~/server/config/constants'
import { getBilibiliWbiKeys, signBilibiliWbiRequest } from '~~/server/utils/bilibiliWbi'

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

const BILIBILI_HEADERS: Record<string, string> = {
  Cookie: 'buvid3=0',
  Referer: 'https://www.bilibili.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

// 安全调用 $fetch，即使 HTTP 非 2xx 也返回响应体
async function bilibiliFetch<T = any>(url: string, opts: Record<string, any>): Promise<T> {
  try {
    return await $fetch<T>(url, opts)
  } catch (err: any) {
    const data = err?.data || err?.response?._data
    if (data) return data as T
    throw err
  }
}

// 从响应中提取可用音频 URL（durl 或 dash audio）
function extractAudioUrl(resp: PlayUrlRes): string | null {
  if (resp?.code !== 0) return null
  if (resp.data?.durl?.length > 0) return resp.data.durl[0].url
  const audios = resp.data?.dash?.audio || []
  if (audios.length > 0) {
    const best = audios.reduce((a, b) => (a.bandwidth > b.bandwidth ? a : b))
    return best.baseUrl
  }
  return null
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bvid = query.id as string
  const cid = query.cid as string

  if (!bvid) {
    throw createApiError(400, SERVER_ERROR_CODES.COMMON_INVALID_PARAMS, '缺少 id 参数')
  }

  try {
    let finalCid = cid

    // 获取 CID
    if (!finalCid) {
      // 方式1: x/web-interface/view
      const respView: any = await bilibiliFetch('https://api.bilibili.com/x/web-interface/view', {
        method: 'GET',
        params: { bvid },
        headers: BILIBILI_HEADERS,
        timeout: 10000,
        retry: false
      })

      if (respView?.code === 0 && respView?.data?.pages?.[0]?.cid) {
        finalCid = respView.data.pages[0].cid
      } else {
        // 方式2: x/player/pagelist 回退
        console.warn('[Bilibili] view 接口取 CID 失败，尝试 pagelist，code:', respView?.code, 'msg:', respView?.message)
        const respPage: any = await bilibiliFetch('https://api.bilibili.com/x/player/pagelist', {
          method: 'GET',
          params: { bvid },
          headers: BILIBILI_HEADERS,
          timeout: 10000,
          retry: false
        })

        if (respPage?.code === 0 && respPage?.data?.[0]?.cid) {
          finalCid = respPage.data[0].cid
        } else {
          console.error('[Bilibili] 所有 CID 获取方式均失败，view code:', respView?.code, 'pagelist code:', respPage?.code)
          throw new Error(`获取 CID 失败（view: ${respView?.code || 'err'}，pagelist: ${respPage?.code || 'err'}）`)
        }
      }
    }

    const baseParams = {
      platform: 'html5',
      high_quality: 1,
      bvid,
      cid: finalCid
    }

    const attempts: Array<{ name: string; fn: () => Promise<PlayUrlRes> }> = [
      {
        name: 'fnval=1',
        fn: () => bilibiliFetch<PlayUrlRes>('https://api.bilibili.com/x/player/playurl', {
          method: 'GET',
          params: { ...baseParams, fnval: 1 },
          headers: BILIBILI_HEADERS,
          timeout: 10000,
          retry: false
        })
      },
      {
        name: 'fnval=16',
        fn: () => bilibiliFetch<PlayUrlRes>('https://api.bilibili.com/x/player/playurl', {
          method: 'GET',
          params: { ...baseParams, fnval: 16 },
          headers: BILIBILI_HEADERS,
          timeout: 10000,
          retry: false
        })
      },
      {
        name: 'wbi',
        fn: async () => {
          const wbiKey = await getBilibiliWbiKeys()
          const signedQuery = signBilibiliWbiRequest({ ...baseParams, fnval: 16 }, wbiKey)
          return bilibiliFetch<PlayUrlRes>(`https://api.bilibili.com/x/player/wbi/playurl?${signedQuery}`, {
            method: 'GET',
            headers: BILIBILI_HEADERS,
            timeout: 10000,
            retry: false
          })
        }
      },
      {
        name: 'fnval=4048',
        fn: () => bilibiliFetch<PlayUrlRes>('https://api.bilibili.com/x/player/playurl', {
          method: 'GET',
          params: { ...baseParams, fnval: 4048, fnver: 0, fourk: 1 },
          headers: BILIBILI_HEADERS,
          timeout: 10000,
          retry: false
        })
      }
    ]

    const errors: string[] = []
    for (const attempt of attempts) {
      try {
        const resp = await attempt.fn()
        const url = extractAudioUrl(resp)
        if (url) {
          return { url, pay: false }
        }
        errors.push(`${attempt.name}: code=${resp?.code}, msg=${resp?.message || '无音频流'}`)
      } catch (err: any) {
        errors.push(`${attempt.name}: ${err?.message || String(err)}`)
      }
    }

    console.error('[Bilibili] 所有取链方式均失败，bvid:', bvid, 'errors:', errors)
    throw new Error(`B站取链失败: ${errors.join(' | ')}`)
  } catch (error: any) {
    const message = error?.message || '获取 Bilibili 音频链接失败'
    console.error('[Bilibili] playurl error:', message)
    throw createApiError(500, SERVER_ERROR_CODES.BILIBILI_PLAYURL_FAILED, message)
  }
})
