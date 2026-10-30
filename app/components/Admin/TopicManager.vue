<template>
  <div class="p-4 md:p-6 lg:p-8">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-xl font-black text-text-primary">专题管理</h2>
      </div>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="topic in topics"
          :key="topic.id"
          :class="[
            'group rounded-3xl border bg-bg-secondary-40 p-6 transition-all hover:shadow-2xl',
            topic.enabled ? 'border-border-secondary' : 'border-border-secondary-40 opacity-60'
          ]"
        >
          <div class="mb-4 flex items-start justify-between">
            <div
              v-if="topic.cover"
              class="h-14 w-14 overflow-hidden rounded-2xl border border-border-secondary"
            >
              <img :src="topic.cover" :alt="topic.name" class="h-full w-full object-cover" />
            </div>
            <div
              v-else
              class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-secondary bg-bg-primary text-primary"
            >
              <Sparkles :size="22" />
            </div>
            <span
              :class="[
                'rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
                topic.enabled
                  ? 'border-success-20 bg-success-10 text-success'
                  : 'border-border-tertiary-50 bg-bg-tertiary-50 text-text-disabled'
              ]"
            >
              {{ topic.enabled ? '启用' : '禁用' }}
            </span>
          </div>

          <h3 class="text-lg font-black text-text-primary group-hover:text-primary transition-colors">
            {{ topic.name }}
            <span class="text-xs font-bold text-text-disabled">
              ({{ topic.accepted }}/{{ topic.expected || '∞' }})
            </span>
          </h3>

          <p v-if="topic.description" class="mt-2 line-clamp-2 min-h-[32px] text-xs italic leading-relaxed text-text-tertiary">
            {{ topic.description }}
          </p>

          <div class="mt-3 space-y-1">
            <div v-if="topic.startTime" class="flex items-center gap-2 text-[11px] font-bold text-text-tertiary">
              <Clock :size="11" class="text-text-secondary" />
              <span>{{ formatDate(topic.startTime) }}</span>
            </div>
            <div v-if="topic.endTime" class="flex items-center gap-2 text-[11px] font-bold text-text-tertiary">
              <Clock :size="11" class="text-text-secondary" />
              <span>{{ formatDate(topic.endTime) }}</span>
            </div>
          </div>

          <div class="mt-3">
            <div class="mb-1 flex justify-between px-0.5 text-[9px] font-black uppercase tracking-widest text-text-disabled">
              <span>名额进度</span>
              <span>{{ topic.expected > 0 ? Math.min(100, Math.round((topic.accepted / topic.expected) * 100)) : 0 }}%</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full border border-border-secondary-50 bg-bg-primary">
              <div
                class="h-full rounded-full bg-primary transition-all duration-500"
                :style="{ width: `${topic.expected > 0 ? Math.min(100, (topic.accepted / topic.expected) * 100) : 0}%` }"
              />
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              class="flex-1 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:border-primary hover:text-primary"
              @click="openEdit(topic)"
            >
              编辑
            </button>
            <button
              class="flex-1 rounded-xl border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-bold text-text-secondary transition-colors hover:border-error hover:text-error"
              @click="handleDelete(topic)"
            >
              删除
            </button>
          </div>
        </div>

        <!-- 新建专题卡片 -->
        <button
          class="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border-tertiary-50 p-6 text-text-disabled transition-colors hover:border-primary hover:text-primary"
          @click="openCreate"
        >
          <Plus :size="32" />
          <span class="mt-3 text-sm font-bold">新建专题</span>
        </button>
      </div>
    </div>

    <!-- 编辑/新建弹窗 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeModal"
      >
        <div class="w-full max-w-md rounded-2xl border border-border bg-bg-primary p-6 shadow-2xl">
          <h3 class="mb-4 text-lg font-black text-text-primary">
            {{ editingId ? '编辑专题' : '新建专题' }}
          </h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-bold text-text-secondary">专题名称 *</label>
              <input
                v-model="form.name"
                type="text"
                class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                placeholder="例如：毕业季"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold text-text-secondary">专题描述</label>
              <textarea
                v-model="form.description"
                rows="3"
                class="w-full resize-none rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                placeholder="专题介绍"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-bold text-text-secondary">封面图 URL</label>
              <input
                v-model="form.cover"
                type="text"
                class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                placeholder="https://..."
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-bold text-text-secondary">开始时间</label>
                <input
                  v-model="form.startTime"
                  type="datetime-local"
                  class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold text-text-secondary">结束时间</label>
                <input
                  v-model="form.endTime"
                  type="datetime-local"
                  class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-bold text-text-secondary">名额上限</label>
                <input
                  v-model.number="form.expected"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  placeholder="0 表示不限"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-bold text-text-secondary">排序</label>
                <input
                  v-model.number="form.sortOrder"
                  type="number"
                  class="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  placeholder="0"
                />
              </div>
            </div>

            <label class="flex items-center gap-2">
              <input
                v-model="form.enabled"
                type="checkbox"
                class="h-4 w-4 rounded border-border accent-primary"
              />
              <span class="text-sm text-text-secondary">启用</span>
            </label>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-xl border border-border-secondary bg-bg-secondary px-4 py-2.5 text-sm font-bold text-text-secondary transition-colors hover:bg-bg-tertiary"
              @click="closeModal"
            >
              取消
            </button>
            <button
              class="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              :disabled="saving"
              @click="handleSave"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Sparkles, Clock, Plus } from '@lucide/vue'

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
    alert('请输入专题名称')
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
    } else {
      await $fetch('/api/admin/topics', { method: 'POST', body: payload })
    }
    closeModal()
    resetForm()
    await fetchTopics()
  } catch (err) {
    console.error('保存专题失败:', err)
    alert(err?.data?.message || err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (topic) => {
  if (!confirm(`确定删除专题「${topic.name}」吗？关联歌曲的专题标签将被清空。`)) return
  try {
    await $fetch(`/api/admin/topics/${topic.id}`, { method: 'DELETE' })
    await fetchTopics()
  } catch (err) {
    console.error('删除专题失败:', err)
    alert(err?.data?.message || err?.message || '删除失败')
  }
}

onMounted(fetchTopics)
</script>
