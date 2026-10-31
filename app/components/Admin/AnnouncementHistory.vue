<template>
  <section class="border-t border-panel-bg-dark pt-8">
    <div class="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <History :size="18" class="text-primary" />
          <h3 class="text-lg font-black text-text-primary-lighter">{{ locale.announcementTitle }}</h3>
        </div>
        <p class="mt-1 text-xs text-text-tertiary">{{ locale.announcementDescription }}</p>
      </div>

      <button
        type="button"
        :disabled="loading"
        class="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-panel-bg-dark px-4 text-xs font-bold text-text-muted transition-colors hover:border-panel-bg-hover hover:text-text-primary-lighter disabled:cursor-wait disabled:opacity-50 md:self-auto"
        @click="loadHistory"
      >
        <RefreshCw :size="15" :class="loading ? 'animate-spin' : ''" />
        {{ loading ? locale.refreshing : locale.refresh }}
      </button>
    </div>

    <div
      v-if="error"
      class="mt-5 flex items-start justify-between gap-4 rounded-lg border border-error-20 bg-error-5 p-4"
      role="alert"
    >
      <div class="flex min-w-0 items-start gap-3">
        <AlertCircle :size="17" class="mt-0.5 shrink-0 text-error" />
        <p class="break-words text-xs font-medium text-error-light">{{ error }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-bold text-error-light"
        @click="loadHistory"
      >
        {{ locale.retry }}
      </button>
    </div>

    <div
      v-if="loading && announcements.length === 0"
      class="flex min-h-56 items-center justify-center text-text-disabled"
    >
      <Loader2 :size="22" class="animate-spin" />
      <span class="ml-3 text-xs font-bold">{{ locale.loading }}</span>
    </div>

    <div
      v-else-if="announcements.length === 0"
      class="mt-6 flex min-h-56 flex-col items-center justify-center border-y border-panel-bg-dark text-center"
    >
      <Inbox :size="28" class="text-text-disabled" />
      <p class="mt-3 text-sm font-bold text-text-muted">{{ locale.empty }}</p>
      <p class="mt-1 text-xs text-text-disabled">{{ locale.announcementEmptyDescription }}</p>
    </div>

    <div v-else class="mt-6 divide-y divide-panel-bg-dark border-y border-panel-bg-dark">
      <article v-for="item in announcements" :key="item.id" class="py-5">
        <div
          class="markdown-body max-h-40 overflow-y-auto text-sm leading-relaxed text-text-primary-light"
          v-html="renderMarkdown(item.content)"
        />

        <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
          <span>{{ locale.sender }}：{{ senderName(item) }}</span>
          <span>{{ formatDateTime(item.createdAt) }}</span>
          <span
            v-if="item.broadcastToGroups"
            class="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-light"
          >
            <Megaphone :size="12" />
            {{ locale.groupForwarded }}
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { AlertCircle, History, Inbox, Loader2, Megaphone, RefreshCw } from '@lucide/vue'
import { useAuth } from '~/composables/useAuth'
import { useServerErrors } from '~/composables/useLocaleText'
import { renderMarkdown } from '~/utils/markdown'
import { useLocale } from '~/utils/locale'

const props = defineProps({
  refreshKey: {
    type: Number,
    default: 0
  }
})

const { getAuthConfig } = useAuth()
const { localize: localizeServerError } = useServerErrors()
const { admin, currentLocale } = useLocale()
const locale = computed(() => admin.value?.notificationSender?.history || {})

const announcements = ref([])
const loading = ref(false)
const error = ref('')

const senderName = (item) =>
  item.senderName?.trim() || item.senderUsername?.trim() || locale.value.systemSender

const formatDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return locale.value.unknownTime
  return new Intl.DateTimeFormat(currentLocale.value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

const loadHistory = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await $fetch('/api/admin/notifications/announcement-history', {
      query: { limit: 30 },
      ...getAuthConfig()
    })
    announcements.value = response.announcements || []
  } catch (fetchError) {
    error.value = localizeServerError(fetchError, locale.value.loadFailed)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.refreshKey,
  () => loadHistory()
)

onMounted(loadHistory)
</script>
