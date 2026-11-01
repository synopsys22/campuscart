import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { App, ErrorBoundary } from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CompareProvider } from './context/CompareContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30 * 1000, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {/* Without this, a logout renders the old page once with no user, which redirects to login. */}
          <BrowserRouter useTransitions={false}>
            <AuthProvider>
              <CompareProvider>
                {/* Honours the visitor's reduced-motion setting everywhere, including layout animations. */}
                <MotionConfig reducedMotion="user">
                  <App />
                </MotionConfig>
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    className: 'toast',
                    success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--surface)' } },
                    error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--surface)' } },
                  }}
                />
              </CompareProvider>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
