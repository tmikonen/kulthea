import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlacePage } from './PlacePage';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlacePage />
  </StrictMode>,
);
