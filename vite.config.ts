import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** Dopo la build: scrive in dist/sw.js l'elenco di tutti i file da tenere offline e una versione che cambia a ogni deploy. */
function swPrecache(): Plugin {
  return {
    name: 'sw-precache',
    apply: 'build',
    closeBundle() {
      const dir = resolve('dist')
      const files: string[] = []
      const walk = (d: string) => readdirSync(d).forEach(n => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(relative(dir, p).split('\\').join('/')) })
      walk(dir)
      const list = files.filter(f => !['sw.js', '_redirects'].includes(f)).sort()
      const hash = createHash('sha1')
      list.forEach(f => hash.update(f).update(readFileSync(join(dir, f))))
      const sw = readFileSync(join(dir, 'sw.js'), 'utf8')
        .replace('__PRECACHE__', JSON.stringify(list)).replace('__VERSION__', hash.digest('hex').slice(0, 10))
      writeFileSync(join(dir, 'sw.js'), sw)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), swPrecache()],
  build: { rollupOptions: { input: { main: resolve('index.html'), staff: resolve('staff.html'), cucina: resolve('cucina.html'), sala: resolve('sala.html'), cassa: resolve('cassa.html'), proprieta: resolve('proprieta.html') } } },
})
