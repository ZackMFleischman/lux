import { createRoot } from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { StudioApp } from './renderer.tsx';
import { createDisconnectedClient } from './service-client.ts';
import './studio.css';
import { AuthoringApp } from './authoring.tsx';

const root = document.getElementById('root');
if (!root) throw Error('Studio root element unavailable');
const nonce = document.querySelector<HTMLMetaElement>('meta[name="style-nonce"]')?.content;
if (!nonce || !/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error('Studio style nonce unavailable');
const cache = createCache({ key: 'lux', nonce });
// Deliberately no simulated service or generated visual. Integration supplies a
// real core client and a separately owned completed-output presentation port.
createRoot(root).render(<CacheProvider value={cache}><AuthoringApp /></CacheProvider>);
