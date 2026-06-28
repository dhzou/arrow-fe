import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HomeV1View from '@/views/HomeV1View.vue'
import GameView from '@/views/GameView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SettingsV1View from '@/views/SettingsV1View.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { transition: 'route-fade' } },
  { path: '/v1', name: 'home-v1', component: HomeV1View, meta: { transition: 'route-fade' } },
  { path: '/game', name: 'game', component: GameView, meta: { transition: 'route-rise' } },
  { path: '/game/:mode', redirect: '/game' },
  { path: '/settings', name: 'settings', component: SettingsView, meta: { transition: 'route-slide' } },
  { path: '/settings/v1', name: 'settings-v1', component: SettingsV1View, meta: { transition: 'route-slide' } },
]

if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/levels',
    name: 'dev-levels',
    component: () => import('@/views/DevLevelPickerView.vue'),
    meta: { transition: 'route-slide' },
  })
  routes.push({
    path: '/dev/editor',
    name: 'level-editor',
    component: () => import('@/views/LevelEditorView.vue'),
    meta: { transition: 'route-slide' },
  })
  routes.push({
    path: '/dev/ui',
    name: 'dev-ui',
    component: () => import('@/views/DevUiPreviewView.vue'),
    meta: { transition: 'route-slide' },
  })
}
const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
