// Prima della build: toglie i vecchi file compilati (assets/) e le lezioni copiate (content/) da apps/english-sprint
import { rmSync } from 'node:fs'
rmSync(new URL('../assets', import.meta.url), { recursive: true, force: true })
rmSync(new URL('../content', import.meta.url), { recursive: true, force: true })
