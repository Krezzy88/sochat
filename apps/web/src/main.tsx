import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';
import { FeedbackProvider } from './Feedback.tsx';
createRoot(document.getElementById('root')!).render(
  <FeedbackProvider>
    <App />
  </FeedbackProvider>,
);
