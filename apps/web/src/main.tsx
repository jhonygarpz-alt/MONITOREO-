import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/toast';
import { ThemeProvider } from './lib/theme';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter><App /></BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
