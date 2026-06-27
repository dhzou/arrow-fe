import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { syncThemePack } from '@/game/apply-ui-theme'
import { loadSaveData } from '@/utils/storage'
import './style.css'
import './styles/game-theme.css'
import './styles/ui-motion.css'

syncThemePack(loadSaveData().settings.boardThemeIndex ?? 0)

createApp(App).use(createPinia()).use(router).mount('#app')
