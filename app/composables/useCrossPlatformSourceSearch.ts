import { useMusicSources } from './useMusicSources'
import { usePlatformConfig } from './usePlatformConfig'
import { getPlatformDisplayName } from '~/utils/platforms'
import { useLocale } from '~/utils/locale'

export interface SourceSearchCandidate {
  id: string | number
  title: string
  artist: string
  album?: string
  cover?: string
  duration?: number
  musicPlatform: string
  musicId: string
  playUrl?: string
  sourceInfo?: Record<string, any>
  platformName: string
  matchScore: number
  matchReason: string
}

/** 归一化匹配文本：小写、去标点空白、feat 标记 */
const normalize = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/\b(?:feat|ft)\.?\s*/gi, '')
    .replace(/[&＆]/g, 'and')
    .replace(/[、;，,/|()（）·・\s\-_'"`~!?？！.。《》【】\[\]{}^*@#$%+=\\]+/g, '')

const splitArtists = (value?: string): string[] =>
  String(value || '')
    .split(/[、&＆;，,/|·・]+/g)
    .map((a) => normalize(a))
    .filter(Boolean)

/** 候选与原歌曲的匹配打分（分越高越优） */
const scoreCandidate = (
  candidate: { title?: string; artist?: string; album?: string; duration?: number },
  track: { title: string; artist: string; album?: string; duration?: number }
): { score: number; reason: string } => {
  const trackTitle = normalize(track.title || '')
  const candTitle = normalize(candidate.title || '')
  const trackArtists = splitArtists(track.artist)
  const candArtists = splitArtists(candidate.artist)

  let score = 0
  const reasons: string[] = []

  // 标题
  if (trackTitle && candTitle) {
    if (candTitle === trackTitle) {
      score += 10
      reasons.push('标题完全一致')
    } else if (candTitle.includes(trackTitle) || trackTitle.includes(candTitle)) {
      score += 4
      reasons.push('标题相近')
    }
  }

  // 歌手
  if (trackArtists.length && candArtists.length) {
    const exact = trackArtists.some((a) => candArtists.includes(a))
    if (exact) {
      score += 5
      reasons.push('歌手一致')
    } else {
      const contains = trackArtists.some((a) =>
        candArtists.some((c) => a.length >= 2 && (c.includes(a) || a.includes(c)))
      )
      if (contains) {
        score += 2
        reasons.push('歌手相近')
      }
    }
  } else if (!trackArtists.length) {
    // 原歌曲无歌手信息时不扣分
    score += 1
  }

  // 专辑
  if (track.album && candidate.album) {
    if (normalize(track.album) === normalize(candidate.album)) {
      score += 2
      reasons.push('专辑一致')
    }
  }

  // 时长接近（±8 秒）
  if (typeof track.duration === 'number' && typeof candidate.duration === 'number') {
    if (Math.abs(track.duration - candidate.duration) <= 8000) {
      score += 3
      reasons.push('时长接近')
    }
  }

  return { score, reason: reasons.join('、') || '跨平台搜索结果' }
}

export const useCrossPlatformSourceSearch = () => {
  const { searchSongs } = useMusicSources()
  const { enabledPlatforms } = usePlatformConfig()
  const { currentLocale, siteConfig } = useLocale()

  /**
   * 在除当前平台外的已启用平台中搜索同一首歌的可播放音源。
   * @param track 当前播放失败的歌曲信息
   * @param excludePlatform 当前歌曲所在平台，从候选源中排除
   */
  const searchAlternatives = async (
    track: { title: string; artist: string; album?: string; duration?: number },
    excludePlatform: string
  ): Promise<SourceSearchCandidate[]> => {
    const keyword = `${track.title} ${track.artist}`.trim()
    if (!keyword) return []

    // 候选平台：已启用且排除当前平台；B站源不参与候选
    const candidatePlatforms = enabledPlatforms.value.filter(
      (p) => p !== excludePlatform && p !== 'bilibili'
    )

    if (candidatePlatforms.length === 0) return []

    const all: SourceSearchCandidate[] = []

    for (const platform of candidatePlatforms) {
      try {
        const result = await searchSongs({
          keywords: keyword,
          platform,
          type: 1,
          limit: 8
        })

        if (!result.success || !Array.isArray(result.data)) continue

        for (const item of result.data) {
          const { score, reason } = scoreCandidate(item, track)
          if (score < 4) continue // 过滤掉明显不匹配的结果

          all.push({
            id: item.musicId || item.id,
            title: item.title || item.name || '',
            artist: item.artist || item.singer || '',
            album: item.album || item.albumName || '',
            cover: item.cover,
            duration: item.duration,
            musicPlatform: item.musicPlatform || platform,
            musicId: String(item.musicId || item.id),
            playUrl: item.playUrl || item.url,
            sourceInfo: item.sourceInfo,
            platformName: getPlatformDisplayName(
              item.musicPlatform || platform,
              siteConfig.value,
              currentLocale.value
            ),
            matchScore: score,
            matchReason: reason
          })
        }
      } catch (e) {
        console.warn(`[cross-platform] 平台 ${platform} 搜索失败:`, e)
      }
    }

    // 按匹配分降序，同分按平台顺序（网易云优先）
    const platformOrder: Record<string, number> = { netease: 0, tencent: 1, migu: 2 }
    all.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
      return (platformOrder[a.musicPlatform] ?? 9) - (platformOrder[b.musicPlatform] ?? 9)
    })

    // 去重（同平台同ID只保留一条）
    const seen = new Set<string>()
    return all.filter((c) => {
      const key = `${c.musicPlatform}:${c.musicId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return { searchAlternatives }
}
