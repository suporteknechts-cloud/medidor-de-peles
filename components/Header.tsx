import React from 'react';
import { Ruler, History } from 'lucide-react';

interface HeaderProps {
  onShowHistory: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onShowHistory, onGoHome }) => {
  return (
    <header className="bg-leather-800 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div 
          className="flex items-center space-x-2 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onGoHome}
        >
          <div className="bg-white p-1.5 rounded-lg text-leather-800">
            <Ruler size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Medidor de Pele</h1>
            <p className="text-xs text-leather-200 uppercase tracking-wider">Leather Precision Meter</p>
          </div>
        </div>
        
        <button 
          onClick={onShowHistory}
          className="p-2 hover:bg-leather-700 rounded-full transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <History size={20} />
          <span className="hidden sm:inline">Histórico</span>
        </button>
      </div>
    </header>
  );
};