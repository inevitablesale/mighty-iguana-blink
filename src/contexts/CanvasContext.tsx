import { createContext, useState, useContext, ReactNode } from 'react';

export type CanvasView = 'opportunities' | 'campaigns' | 'agents' | 'placements' | 'proposals' | 'analytics' | 'profile' | null;

interface CanvasContextType {
  currentView: CanvasView;
  setCurrentView: (view: CanvasView) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider = ({ children }: { children: ReactNode }) => {
  const [currentView, setCurrentView] = useState<CanvasView>(null);

  return (
    <CanvasContext.Provider value={{ currentView, setCurrentView }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};