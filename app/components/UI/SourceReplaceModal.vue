<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="modal.state.visible && modal.state.song"
        class="fixed inset-0 z-[120] flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <div class="absolute inset-0 bg-bg-primary-60 backdrop-blur-sm" />

        <div
          class="relative w-full max-w-2xl bg-bg-secondary border border-border-secondary rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-start justify-between p-6 pb-4 gap-4">
            <div class="flex items-start gap-3 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-xl bg-error-10 flex items-center justify-center flex-shrink-0">
                <Icon name="warning" :size="22" class="text-error" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-black text-text-primary tracking-tight truncate">
                  {{ t.title }}
                </h3>
                <p class="text-xs text-text-tertiary mt-1 truncate">
                  {{ t.failedSong }}：{{ failedSong?.title }}
                  <span v-if="failedSong?.artist"> - {{ failedSong?.artist }}</span>
                </p>
                <p class="text-[11px] text-text-disabled mt-0.5">
                  {{ t.currentPlatform }}：{{ currentPlatformName }}
                </p>
              </div>
            </div>
            <button
              class="w-9 h-9 flex items-center justify-center rounded-xl bg-bg-tertiary-50 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-all flex-shrink-0"
              @click="handleClose"
            >
              <Icon name="x" :size="18" />
            </button>
          </div>

          <!-- 搜索中 -->
          <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3">
            <AppSpinner :size="36" />
            <p class="text-xs text-text-tertiary">{{ t.searching }}</p>
          </div>

          <!-- 空结果 -->
          <div v-else-if="candidates.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
            <Icon name="music" :size="40" class="text-text-disabled" />
            <p class="text-sm text-text-tertiary">{{ t.empty }}</p>
            <button
              class="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors flex items-center gap-2"
              @click="startSearch"
            >
              <Icon name="refresh" :size="14" />
              {{ t.retry }}
            </button>
          </div>

          <!-- 候选列表 -->
          <div v-else class="flex-1 overflow-y-auto px-6 pb-4">
            <p class="text-[11px] text-text-disabled mb-3">{{ t.tip }}</p>
            <div class="space-y-2">
              <div
                v-for="candidate in candidates"
                :key="`${candidate.musicPlatform}-${candidate.musicId}`"
                class="flex items-center gap-3 p-3 rounded-2xl bg-bg-tertiary-30 hover:bg-bg-tertiary-50 transition-colors"
              >
                <!-- 封面：点击试听 -->
                <div
                  class="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-bg-tertiary cursor-pointer group"
                  @click="previewCandidate(candidate)"
                >
                  <img
                    v-if="candidate.cover"
                    :src="convertToHttps(candidate.cover)"
                    :alt="candidate.title"
                    class="w-full h-full object-cover"
                    referrerpolicy="no-referrer"
                  >
                  <div v-else class="w-full h-full bg-primary-hover-10 flex items-center justify-center">
                    <Icon name="music" :size="20" class="text-primary" />
                  </div>
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon name="play" :size="22" class="text-white" />
                  </div>
                </div>

                <!-- 信息 -->
                <div class="min-w-0 flex-1">
                  <h4 class="text-sm font-bold text-text-primary truncate">{{ candidate.title }}</h4>
                  <p class="text-xs text-text-tertiary truncate">{{ candidate.artist }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-bg-tertiary text-text-tertiary">
                      {{ candidate.platformName }}
                    </span>
                    <span v-if="candidate.album" class="text-[10px] text-text-disabled truncate">
                      {{ candidate.album }}
                    </span>
                  </div>
                  <p v-if="candidate.matchReason" class="text-[10px] text-primary mt-0.5">
                    {{ candidate.matchReason }}
                  </p>
                </div>

                <!-- 更换按钮 -->
                <button
                  class="flex-shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                  :disabled="replacingId !== null"
                  @click="replaceSource(candidate)"
                >
                  {{ replacingId === `${candidate.musicPlatform}-${candidate.musicId}` ? t.replacing : t.replace }}
                </button>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="flex items-center justify-between px-6 py-3 border-t border-border-secondary bg-bg-tertiary-20">
            <p class="text-[11px] text-text-disabled">{{ t.bottomTip }}</p>
            <button
              class="px-4 py-2 rounded-xl bg-bg-tertiary text-text-primary text-xs font-bold hover:bg-bg-tertiary-70 transition-colors"
              @click="handleClose"
            >
              {{ t.close }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 试听音频 -->
    <audio ref="previewAudioRef" @ended="previewPlayingId = null" />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSourceReplaceModal } from '~/composables/useSourceReplaceModal'
import { useCrossPlatformSourceSearch } from '~/composables/useCrossPlatformSourceSearch'
import { getPlatformDisplayName } from '~/utils/platforms'
import { convertToHttps } from '~/utils/url'
import { getMusicUrl } from '~/utils/musicUrl'
import { useLocale } from '~/utils/locale'
import { useServerErrors } from '~/composables/useLocaleText'
import Icon from '~/components/UI/Icon.vue'
import AppSpinner from '~/components/UI/Common/AppSpinner.vue'

const modal = useSourceReplaceModal()
const { searchAlternatives } = useCrossPlatformSourceSearch()
const { sourceReplace } = useLocale()
const { localize } = useServerErrors()

const failedSong = computed(() => modal.state.song)
const currentPlatformName = computed(() => {
  if (!failedSong.value?.musicPlatform) return ''
  return getPlatformDisplayName(failedSong.value.musicPlatform, null, 'zh-CN')
})

const loading = ref(false)
const candidates = ref([])
const replacingId = ref(null)
const previewAudioRef = ref(null)
const previewPlayingId = ref(null)

// i18n 文案（优先取词典，缺失时回退中文）
const t = computed(() => {
  const base = sourceReplace.value || {}
  return {
    title: base.title || '音源解析失败，推荐以下可播放音源',
    failedSong: base.failedSong || '当前歌曲',
    currentPlatform: base.currentPlatform || '当前音源',
    searching: base.searching || '正在跨平台搜索可播放音源…',
    empty: base.empty || '未在其他平台找到可播放的相同歌曲',
    retry: base.retry || '重新搜索',
    tip: base.tip || '优先推荐歌手、标题一致的音源，点击封面可试听',
    replace: base.replace || '更换音源',
    replacing: base.replacing || '更换中…',
    bottomTip: base.bottomTip || '更换后将更新歌曲记录，无需重新投稿',
    close: base.close || '关闭',
    replaceSuccess: base.replaceSuccess || '音源更换成功',
    replaceFailed: base.replaceFailed || '音源更换失败',
    previewFailed: base.previewFailed || '试听失败，该音源可能无法播放'
  }
})

const startSearch = async () => {
  if (!failedSong.value) return
  loading.value = true
  candidates.value = []
  try {
    const list = await searchAlternatives(
      {
        title: failedSong.value.title,
        artist: failedSong.value.artist,
        album: failedSong.value.album,
        duration: failedSong.value.duration
      },
      failedSong.value.musicPlatform
    )
    candidates.value = list
  } catch (e) {
    console.warn('[source-replace] 搜索失败:', e)
    candidates.value = []
  } finally {
    loading.value = false
  }
}

// 弹窗打开时自动搜索
watch(
  () => modal.state.visible,
  (visible) => {
    if (visible) {
      startSearch()
    } else {
      // 关闭时停止试听
      stopPreview()
      candidates.value = []
    }
  }
)

const stopPreview = () => {
  if (previewAudioRef.value) {
    previewAudioRef.value.pause()
    previewAudioRef.value.src = ''
  }
  previewPlayingId.value = null
}

const previewCandidate = async (candidate) => {
  const id = `${candidate.musicPlatform}-${candidate.musicId}`
  if (previewPlayingId.value === id) {
    stopPreview()
    return
  }

  stopPreview()
  try {
    const url = await getMusicUrl(candidate.musicPlatform, candidate.musicId, candidate.playUrl, {
      musicInfo: {
        name: candidate.title,
        artist: candidate.artist,
        album: candidate.album,
        rawItem: candidate
      }
    })
    if (!url) {
      if (window.$showNotification) window.$showNotification(t.previewFailed, 'warning')
      return
    }
    if (previewAudioRef.value) {
      previewAudioRef.value.src = url
      await previewAudioRef.value.play()
      previewPlayingId.value = id
    }
  } catch (e) {
    console.warn('[source-replace] 试听失败:', e)
    if (window.$showNotification) window.$showNotification(t.previewFailed, 'warning')
  }
}

const replaceSource = async (candidate) => {
  if (!failedSong.value?.id) return
  const id = `${candidate.musicPlatform}-${candidate.musicId}`
  replacingId.value = id

  try {
    const resp = await $fetch(`/api/songs/${failedSong.value.id}/replace-source`, {
      method: 'POST',
      body: {
        musicPlatform: candidate.musicPlatform,
        musicId: candidate.musicId,
        cover: candidate.cover || null,
        playUrl: candidate.playUrl || null,
        durationSeconds: candidate.duration
          ? Math.round(candidate.duration / 1000)
          : undefined
      }
    })

    if (resp?.success) {
      if (window.$showNotification) window.$showNotification(t.replaceSuccess, 'success')
      // 通知外部更新当前播放歌曲
      window.dispatchEvent(
        new CustomEvent('source-replaced', {
          detail: {
            songId: failedSong.value.id,
            musicPlatform: candidate.musicPlatform,
            musicId: candidate.musicId,
            cover: candidate.cover,
            title: candidate.title,
            artist: candidate.artist,
            album: candidate.album,
            duration: candidate.duration,
            playUrl: candidate.playUrl
          }
        })
      )
      modal.close()
    }
  } catch (e) {
    console.error('[source-replace] 更换失败:', e)
    const msg = localize(e) || t.replaceFailed
    if (window.$showNotification) window.$showNotification(msg, 'error')
  } finally {
    replacingId.value = null
  }
}

const handleClose = () => {
  stopPreview()
  modal.close()
}

onUnmounted(() => stopPreview())
</script>
