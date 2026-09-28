import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Начало React-приложения: Vite загружает этот модуль из index.html,
// после чего React монтирует корневой компонент App в DOM-элемент #root.
createRoot(document.getElementById('root')!).render(
  <App />,
)
