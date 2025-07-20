import { createApp } from 'vue'
import App from './App.vue'
import VueGoodTablePlugin from 'vue-good-table-next'

// Import the vue-good-table styles
import 'vue-good-table-next/dist/vue-good-table-next.css'

const app = createApp(App)

// Install the vue-good-table plugin
app.use(VueGoodTablePlugin)

app.mount('#app')
