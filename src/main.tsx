import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DadosProvider } from './dados/store';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DadosProvider>
      <App />
    </DadosProvider>
  </StrictMode>,
);
