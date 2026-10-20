import {StrictMode} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import App from './App.tsx';
import { getPublicAuthor } from './public-site/content';
import 'katex/dist/katex.min.css';
import './index.css';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App
      pathname={window.location.pathname}
      publicAuthor={getPublicAuthor(root.dataset.publicAuthorName, root.dataset.publicAuthorBio)}
    />
  </StrictMode>
);

if (root.dataset.learnxSsr === 'anonymous-v1') {
  hydrateRoot(root, app);
} else {
  // Vite's development entry can still run without the production HTTP helper.
  createRoot(root).render(app);
}
