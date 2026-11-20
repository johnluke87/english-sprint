// Copia il PHP (php/) nella cartella dell'app (apps/english-sprint): api/, lib/, pagina.php, .htaccess
import { cpSync } from 'node:fs'
cpSync(new URL('./php/', import.meta.url), new URL('../', import.meta.url), { recursive: true })
console.log('PHP copiato in apps/english-sprint')
