import { readonly, ref } from 'vue'
import type { PlayableSong } from './useAudioPlayer'

interface SourceReplaceState {
  visible: boolean
  song: PlayableSong | null
}

const state = ref<SourceReplaceState>({ visible: false, song: null })

/**
 * 音源替换弹窗的全局控制。
 * 播放器检测到音源彻底失败时调用 open()，弹窗组件监听 visible 渲染。
 */
export const useSourceReplaceModal = () => {
  const open = (song: PlayableSong) => {
    state.value = { visible: true, song }
  }

  const close = () => {
    state.value = { visible: false, song: null }
  }

  return {
    state: readonly(state),
    open,
    close
  }
}
