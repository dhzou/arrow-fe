/** 必须在任何 pixi 模块之前导入，微信环境禁止 eval */
import './env-polyfills'
import { showWxLoadingCover } from './wx-loading-cover'

void showWxLoadingCover().finally(() => import('./wx-pixi-boot'))
