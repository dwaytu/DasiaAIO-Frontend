import { RouterProvider } from 'react-router'
import { router } from './router'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { LocationProvider } from './context/LocationContext'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary sectionLabel="application" onRetry={() => window.location.reload()}>
      <AuthProvider>
        <UIProvider>
          <LocationProvider>
            <RouterProvider router={router} />
          </LocationProvider>
        </UIProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
