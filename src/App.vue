<script setup lang="ts">
import { onMounted } from 'vue'
import { useProgressStore } from '@/stores/progress'

const progress = useProgressStore()

onMounted(() => {
  progress.initSound()
})
</script>

<template>
  <div class="app-shell">
    <p v-if="progress.storageWarning" class="storage-warning">
      进度无法保存到本地，刷新后可能丢失。
    </p>
    <div class="app-panel">
      <router-view v-slot="{ Component, route }">
        <component :is="Component" :key="route.path" class="route-page" />
      </router-view>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
  display: flex;
  justify-content: center;
  background: #070d16;
}

.app-panel {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  max-width: 480px;
  height: 100%;
  min-height: 100dvh;
  overflow: hidden;
}

.storage-warning {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 100;
  width: 100%;
  max-width: 480px;
  margin: 0;
  padding: 8px 12px;
  transform: translateX(-50%);
  background: #f0f0f0;
  color: #1a1a1a;
  font-size: 13px;
  text-align: center;
  border-bottom: 1px solid #ddd;
}
</style>
