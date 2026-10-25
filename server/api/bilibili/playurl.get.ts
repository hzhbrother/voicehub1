/**
 * Bilibili 播放链接获取接口
 * 优先 fnval=1 直链，失败回退 fnval=16 DASH，再回退 WBI 签名接口
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

// 安全调用 $fetch，即使 HTTP 非 2xx 也返回响应体，避免 ofetch 抛错丢失 B 站错误码
async function bilibiliFetch<T = any>(url: string, opts: Record<string, any>): Promise<T> {
  try {
    return await $fetch<T>(url, opts)
  } catch (err: any) {
    // ofetch 在非 2xx 时抛 FetchError，data 字段含响应体
    const data = err?.data || err?.response?._data
    if (data) return data as T
    throw err
  }
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

    if (!finalCid) {
      const resp1: any = await bilibiliFetch('https://api.bilibili.com/x/web-interface/view', {
        method: 'GET',
        params: { bvid },
        headers: BILIBILI_HEADERS,
        timeout: 10000,
        retry: false
      })

      if (resp1?.code === 0 && resp1?.data?.pages?.[0]?.cid) {
        finalCid = resp1.data.pages[0].cid
      } else {
        console.error('[Bilibili] CID 获取失败，bvid:', bvid, 'code:', resp1?.code, 'msg:', resp1?.message)
        throw new Error(resp1?.message || `获取 CID 失败（code=${resp1?.code}）`)
      }
    }

    const baseParams = {
      platform: 'html5',
      high_quality: 1,
      bvid,
      cid: finalCid
    }

    // 1. fnval=1 直链
    const resp2 = await bilibiliFetch<PlayUrlRes>('https://api.bilibili.com/x/player/playurl', {
      method: 'GET',
      params: { ...baseParams, fnval: 1 },
      headers: BILIBILI_HEADERS,
      timeout: 10000,
      retry: false
    })

    if (resp2.code === 0 && resp2.data?.durl?.length > 0) {
      return { url: resp2.data.durl[0].url, pay: false }
    }

    // 2. fnval=16 DASH
    const respDash = await bilibiliFetch<PlayUrlRes>('https://api.bilibili.com/x/player/playurl', {
      method: 'GET',
      params: { ...baseParams, fnval: 16 },
      headers: BILIBILI_HEADERS,
      timeout: 10000,
      retry: false
    })

    if (respDash.code === 0) {
      const audios = respDash.data?.dash?.audio || []
      if (audios.length > 0) {
        const best = audios.reduce((a, b) => (a.bandwidth > b.bandwidth ? a : b))
        return { url: best.baseUrl, pay: false }
      }
    }

    // 3. WBI 签名接口回退（部分视频需要签名才能取到播放地址）
    try {
      const wbiKey = await getBilibiliWbiKeys()
      const signedQuery = signBilibiliWbiRequest(
        { ...baseParams, fnval: 16 },
        wbiKey
      )
      const respWbi = await bilibiliFetch<PlayUrlRes>(
        `https://api.bilibili.com/x/player/wbi/playurl?${signedQuery}`,
        {
          method: 'GET',
          headers: BILIBILI_HEADERS,
          timeout: 10000,
          retry: false
        }
      )

      if (respWbi.code === 0) {
        if (respWbi.data?.durl?.length > 0) {
          return { url: respWbi.data.durl[0].url, pay: false }
        }
        const audios = respWbi.data?.dash?.audio || []
        if (audios.length > 0) {
          const best = audios.reduce((a, b) => (a.bandwidth > b.bandwidth ? a : b))
          return { url: best.baseUrl, pay: false }
        }
      }

      console.error('[Bilibili] WBI 回退失败，code:', respWbi?.code, 'msg:', respWbi?.message)
    } catch (wbiErr: any) {
      console.error('[Bilibili] WBI 签名请求异常:', wbiErr?.message || wbiErr)
    }

    // 汇总失败原因
    const codes = [resp2?.code, respDash?.code].filter((c) => c !== undefined && c !== 0)
    const msgs = [resp2?.message, respDash?.message].filter(Boolean)
    console.error('[Bilibili] 所有取链方式均失败，bvid:', bvid, 'codes:', codes, 'msgs:', msgs)
    throw new Error(
      `B站取链失败（codes: ${codes.join('/') || 'unknown'}，msgs: ${msgs.join('; ') || '无可用音频流'}）`
    )
  } catch (error: any) {
    const message = error?.message || '获取 Bilibili 音频链接失败'
    console.error('[Bilibili] playurl error:', message)
    throw createApiError(500, SERVER_ERROR_CODES.BILIBILI_PLAYURL_FAILED, message)
  }
})
