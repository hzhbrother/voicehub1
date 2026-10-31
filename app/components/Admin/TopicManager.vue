<template>
  <div class="space-y-6">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div
          class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30"
        >
          <Sparkles :size="20" class="text-violet-400" />
        </div>
        <div>
          <h3 class="text-lg font-black text-text-primary tracking-tight">专题管理</h3>
          <p class="text-xs text-text-tertiary mt-0.5">创建专题并管理投稿名额</p>
        </div>
      </div>
      <button
        class="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all active:scale-95"
        @click="openCreate"
      >
        <Plus :size="16" /> 新建专题
      </button>
    </div>

    <!-- 专题卡片网格 -->
    <div v-if="topics.length > 0" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="topic in topics"
        :key="topic.id"
        :class="[
          'group relative overflow-hidden rounded-xl border transition-all hover:shadow-2xl',
          topic.enabled
            ? 'bg-bg-secondary-30 border-border-secondary-60'
            : 'bg-bg-secondary-10 border-border-secondary-40 opacity-70'
        ]"
      >
        <!-- 顶部色条 -->
        <div
          class="h-1 w-full"
          :class="topic.enabled ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-border-tertiary'"
        />

        <div class="p-5">
          <div class="flex items-start gap-4">
            <!-- 封面 -->
            <div
              v-if="topic.cover"
              class="w-14 h-14 rounded-xl overflow-hidden border border-border-secondary flex-shrink-0"
            >
              <img :src="topic.cover" :alt="topic.name" class="w-full h-full object-cover" />
            </div>
            <div
              v-else
              class="w-14 h-14 rounded-xl bg-bg-primary-50 border border-border-secondary flex items-center justify-center flex-shrink-0"
            >
              <Sparkles :size="22" class="text-violet-400" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-base font-black text-text-primary truncate group-hover:text-violet-400 transition-colors">
                  {{ topic.name }}
                </h4>
                <span
                  :class="[
                    'px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border flex-shrink-0',
                    topic.enabled
                      ? 'bg-success-10 text-success border-success-20'
                      : 'bg-bg-tertiary-50 text-text-disabled border-border-tertiary-50'
                  ]"
                >
                  {{ topic.enabled ? '启用' : '禁用' }}
                </span>
              </div>
              <p v-if="topic.description" class="text-xs text-text-tertiary line-clamp-2 leading-relaxed">
                {{ topic.description }}
              </p>
            </div>
          </div>

          <!-- 时间 -->
          <div v-if="topic.startTime || topic.endTime" class="flex items-center gap-4 mt-4 text-[11px] text-text-tertiary">
            <div v-if="topic.startTime" class="flex items-center gap-1.5">
              <Clock :size="12" class="text-text-secondary" />
              <span>{{ formatDate(topic.startTime) }}</span>
            </div>
            <div v-if="topic.endTime" class="flex items-center gap-1.5">
              <span class="text-text-disabled">→</span>
              <span>{{ formatDate(topic.endTime) }}</span>
            </div>
          </div>

          <!-- 名额进度 -->
          <div class="mt-4">
            <div class="flex items-center justify-between mb-1.5 px-0.5">
              <span class="text-[10px] font-black text-text-disabled uppercase tracking-widest">名额进度</span>
              <span class="text-[11px] font-bold text-text-secondary">
                {{ topic.accepted }} / {{ topic.expected || '∞' }}
              </span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-bg-primary-50 border border-border-secondary-50 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="topic.enabled ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'bg-border-tertiary'"
                :style="{
                  width: topic.expected > 0 ? Math.min(100, (topic.accepted / topic.expected) * 100) + '%' : '0%'
                }"
              />
            </div>
          </div>

          <!-- 操作 -->
          <div class="flex items-center gap-2 mt-4 pt-4 border-t border-border-secondary-40">
            <button
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-primary-50 border border-border-secondary-60 hover:border-violet-400 hover:text-violet-400 text-text-secondary text-[11px] font-bold rounded-lg transition-all"
              @click="openEdit(topic)"
            >
              <Edit2 :size="13" /> 编辑
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-primary-50 border border-border-secondary-60 hover:border-error hover:text-error text-text-secondary text-[11px] font-bold rounded-lg transition-all"
              @click="handleDelete(topic)"
            >
              <Trash2 :size="13" /> 删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border-tertiary-50 bg-bg-secondary-10"
    >
      <div class="w-16 h-16 rounded-2xl bg-bg-primary-50 border border-border-secondary flex items-center justify-center mb-4">
        <Sparkles :size="28" class="text-text-disabled" />
      </div>
      <h4 class="text-sm font-bold text-text-secondary mb-1">暂无专题</h4>
      <p class="text-xs text-text-tertiary mb-4">创建第一个专题，开始收集主题投稿</p>
      <button
        class="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all"
        @click="openCreate"
      >
        <Plus :size="16" /> 新建专题
      </button>
    </div>

    <!-- 编辑/新建弹窗 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          @click.self="closeModal"
        >
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95 translate-y-4"
          >
            <div
              v-if="showModal"
              class="w-full max-w-lg rounded-2xl border border-border-secondary-60 bg-bg-secondary-30 p-6 shadow-2xl"
            >
              <div class="flex items-center gap-3 mb-5">
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30"
                >
                  <Sparkles :size="20" class="text-violet-400" />
                </div>
                <div>
                  <h3 class="text-base font-black text-text-primary">{{ editingId ? '编辑专题' : '新建专题' }}</h3>
                  <p class="text-xs text-text-tertiary mt-0.5">设置专题信息与投稿名额</p>
                </div>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                    专题名称 <span class="text-error">*</span>
                  </label>
                  <input
                    v-model="form.name"
                    type="text"
                    class="w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all placeholder:text-text-tertiary"
                    placeholder="例如：毕业季"
                  />
                </div>

                <div>
                  <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                    专题描述
                  </label>
                  <textarea
                    v-model="form.description"
                    rows="2"
                    class="w-full resize-none bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all placeholder:text-text-tertiary"
                    placeholder="介绍本期专题的主题与要求"
                  />
                </div>

                <div>
                  <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                    封面图
                  </label>
                  <div class="flex items-center gap-3">
                    <div
                      class="w-16 h-16 rounded-xl overflow-hidden border border-border-secondary-80 bg-bg-primary-50 flex items-center justify-center flex-shrink-0"
                    >
                      <img
                        v-if="form.cover"
                        :src="form.cover"
                        alt="封面预览"
                        class="w-full h-full object-cover"
                      />
                      <Sparkles v-else :size="20" class="text-text-disabled" />
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-2 bg-bg-primary-50 border border-border-secondary-60 hover:border-violet-400 hover:text-violet-400 text-text-secondary text-[11px] font-bold rounded-lg transition-all"
                        @click="fileInput?.click()"
                      >
                        <Upload :size="13" /> 选择图片
                      </button>
                      <button
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-2 bg-bg-primary-50 border border-border-secondary-60 hover:border-violet-400 hover:text-violet-400 text-text-secondary text-[11px] font-bold rounded-lg transition-all"
                        @click="cameraInput?.click()"
                      >
                        <Camera :size="13" /> 拍照
                      </button>
                      <button
                        v-if="form.cover"
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-2 bg-bg-primary-50 border border-border-secondary-60 hover:border-error hover:text-error text-text-secondary text-[11px] font-bold rounded-lg transition-all"
                        @click="form.cover = ''"
                      >
                        <X :size="13" /> 移除
                      </button>
                    </div>
                  </div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleCoverFile"
                  />
                  <input
                    ref="cameraInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    @change="handleCoverFile"
                  />
                  <input
                    v-if="!form.cover || !String(form.cover).startsWith('data:')"
                    v-model="form.cover"
                    type="text"
                    class="mt-2 w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all placeholder:text-text-tertiary"
                    placeholder="或粘贴图片 URL"
                  />
                  <p class="mt-1.5 text-[11px] text-text-tertiary">支持 JPG / PNG / WebP，图片会自动压缩</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                      开始时间
                    </label>
                    <input
                      v-model="form.startTime"
                      type="datetime-local"
                      class="w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                      结束时间
                    </label>
                    <input
                      v-model="form.endTime"
                      type="datetime-local"
                      class="w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                      名额上限
                    </label>
                    <input
                      v-model.number="form.expected"
                      type="number"
                      min="0"
                      class="w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all"
                      placeholder="0 表示不限"
                    />
                  </div>
                  <div>
                    <label class="block text-[10px] font-black text-text-disabled uppercase tracking-widest mb-1.5">
                      排序
                    </label>
                    <input
                      v-model.number="form.sortOrder"
                      type="number"
                      class="w-full bg-bg-primary-50 border border-border-secondary-80 rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-violet-400 transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                <label class="flex items-center gap-2.5 cursor-pointer">
                  <input
                    v-model="form.enabled"
                    type="checkbox"
                    class="w-4 h-4 rounded border-border-secondary-80 accent-violet-500"
                  />
                  <span class="text-sm text-text-secondary">启用该专题</span>
                </label>
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  class="flex-1 px-4 py-2.5 bg-bg-primary-50 border border-border-secondary-60 hover:bg-bg-secondary-90 text-text-secondary text-xs font-bold rounded-lg transition-all"
                  @click="closeModal"
                >
                  取消
                </button>
                <button
                  class="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="saving"
                  @click="handleSave"
                >
                  {{ saving ? '保存中...' : '保存' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Sparkles, Clock, Plus, Edit2, Trash2, Upload, Camera, X } from '@lucide/vue'
import { useToast } from '~/composables/useToast'

const toast = useToast()
const fileInput = ref(null)
const cameraInput = ref(null)
const topics = ref([])
const showModal = ref(false)
const editingId = ref(null)
const saving = ref(false)

const form = ref({
  name: '',
  description: '',
  cover: '',
  startTime: '',
  endTime: '',
  enabled: true,
  sortOrder: 0,
  expected: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    cover: '',
    startTime: '',
    endTime: '',
    enabled: true,
    sortOrder: 0,
    expected: 0
  }
  editingId.value = null
}

// 压缩图片为最长边 512px 的 JPEG Data URL，控制存储体积
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 512
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        // 填充白底，避免透明 PNG 转 JPEG 后变黑
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('图片读取失败'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

const handleCoverFile = async (event) => {
  const file = event.target.files?.[0]
  if (event.target) event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.error('请选择图片文件')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    toast.error('图片不能超过 10MB')
    return
  }
  try {
    form.value.cover = await compressImage(file)
  } catch (err) {
    console.error('处理封面图片失败:', err)
    toast.error('图片处理失败')
  }
}

const formatDate = (iso) => {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 16)
}

const fetchTopics = async () => {
  try {
    topics.value = await $fetch('/api/admin/topics')
  } catch (err) {
    console.error('获取专题列表失败:', err)
  }
}

const openCreate = () => {
  resetForm()
  showModal.value = true
}

const openEdit = (topic) => {
  editingId.value = topic.id
  form.value = {
    name: topic.name || '',
    description: topic.description || '',
    cover: topic.cover || '',
    startTime: topic.startTime ? topic.startTime.slice(0, 16) : '',
    endTime: topic.endTime ? topic.endTime.slice(0, 16) : '',
    enabled: topic.enabled !== false,
    sortOrder: topic.sortOrder || 0,
    expected: topic.expected || 0
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSave = async () => {
  if (!form.value.name.trim()) {
    toast.error('请输入专题名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description || null,
      cover: form.value.cover || null,
      startTime: form.value.startTime ? new Date(form.value.startTime).toISOString() : null,
      endTime: form.value.endTime ? new Date(form.value.endTime).toISOString() : null,
      enabled: form.value.enabled,
      sortOrder: form.value.sortOrder || 0,
      expected: form.value.expected || 0
    }
    if (editingId.value) {
      await $fetch(`/api/admin/topics/${editingId.value}`, { method: 'PUT', body: payload })
      toast.success('专题已更新')
    } else {
      await $fetch('/api/admin/topics', { method: 'POST', body: payload })
      toast.success('专题已创建')
    }
    closeModal()
    resetForm()
    await fetchTopics()
  } catch (err) {
    console.error('保存专题失败:', err)
    toast.error(err?.data?.message || err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (topic) => {
  if (!confirm(`确定删除专题「${topic.name}」吗？关联歌曲的专题标签将被清空。`)) return
  try {
    await $fetch(`/api/admin/topics/${topic.id}`, { method: 'DELETE' })
    toast.success('专题已删除')
    await fetchTopics()
  } catch (err) {
    console.error('删除专题失败:', err)
    toast.error(err?.data?.message || err?.message || '删除失败')
  }
}

onMounted(fetchTopics)
</script>
