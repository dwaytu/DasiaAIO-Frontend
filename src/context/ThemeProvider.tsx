import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * SENTINEL Theme Provider
 * 
 * Implements auto-detection of system preference, manual toggling,
 * and persistent theme storage for 12-hour shift ergonomics.
 * 
 * @component
 * @example
 * // Wrap your app in ThemeProvider:
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * 
 * // In any component:
 * const { theme, toggleTheme, setTheme } = useTheme();
 */

type Theme = 'light' | 'dark';

interface ThemeContextType {
  /** Current active theme ('light' or 'dark') */
  theme: Theme;
  
  /** Toggle between light and dark modes */
  toggleTheme: () => void;
  
  /** Manually set a specific theme */
  setTheme: (theme: Theme) => void;
  
  /** Whether the theme is being loaded from localStorage/system */
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  /** Optional default theme (overrides system preference) */
  defaultTheme?: Theme;
  /** localStorage key for persistence (default: 'sentinel-theme') */
  storageKey?: string;
}

/**
 * Detects user's system color scheme preference
 * @returns 'light' | 'dark'
 */
const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  return mediaQuery.matches ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme,
  storageKey = 'sentinel-theme',
}) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize theme on mount:
   * 1. Check localStorage for saved preference
   * 2. Fall back to system preference if no saved theme
   * 3. Apply default theme if provided
   */
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(storageKey) as Theme | null;
      
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setThemeState(savedTheme);
      } else if (defaultTheme) {
        setThemeState(defaultTheme);
      } else {
        // Use system preference
        setThemeState(getSystemTheme());
      }
    } catch (error) {
      console.error('Failed to load theme from localStorage:', error);
      setThemeState(defaultTheme || getSystemTheme());
    } finally {
      setIsLoading(false);
    }
  }, [defaultTheme, storageKey]);

  /**
   * Apply theme to document root
   * This triggers CSS variable changes defined in index.css
   */
  useEffect(() => {
    if (isLoading) return;

    const root = window.document.documentElement;
    
    // Remove both classes first to avoid conflicts
    root.classList.remove('light', 'dark');
    
    // Add the active theme class
    root.classList.add(theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? '#0F1115' : '#F4F5F7'
      );
    }
  }, [theme, isLoading]);

  /**
   * Listen for system theme changes
   * Users switching OS theme mid-shift should see immediate updates
   * (only if they haven't manually set a preference)
   */
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey);
    
    // Only listen to system changes if user hasn't manually set a theme
    if (savedTheme) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [storageKey]);

  /**
   * Set theme and persist to localStorage
   */
  const setTheme = (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  };

  /**
   * Toggle between light and dark modes
   */
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
    isLoading,
  };

  // Prevent flash of unstyled content (FOUC) on initial load
  // Render children only after theme is determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse-subtle">
          <svg
            className="w-12 h-12 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/**
 * Hook to access theme context
 * @throws Error if used outside ThemeProvider
 * 
 * @example
 * const { theme, toggleTheme } = useTheme();
 * 
 * return (
 *   <button onClick={toggleTheme}>
 *     {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
 *   </button>
 * );
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

/**
 * Theme Toggle Button Component
 * Drop-in component for header/navbar
 */
export const ThemeToggleButton: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className = '', showLabel = false }) => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        bg-surface-elevated hover:bg-surface-hover
        border border-border-subtle
        text-text-secondary hover:text-text-primary
        transition-all duration-250
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${className}
      `}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'dark' ? (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {theme === 'dark' ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
