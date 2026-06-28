import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { syncThemePack } from '@/game/apply-ui-theme'
import { DEFAULT_BOARD_THEME_INDEX } from '@/game/board-theme'
import { loadSaveData } from '@/utils/storage'
import './style.css'
import './styles/game-theme.css'
import './styles/ui-motion.css'

syncThemePack(loadSaveData().settings.boardThemeIndex ?? DEFAULT_BOARD_THEME_INDEX)

createApp(App).use(createPinia()).use(router).mount('#app')
