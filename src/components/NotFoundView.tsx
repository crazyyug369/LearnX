import React from 'react';
import { Home, ArrowRightLeft } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#faf9f5] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="editorial-canvas-bg rounded-xl border border-stone-200/80 shadow-md w-full max-w-2xl p-6 sm:p-8">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center space-x-3">
            <Home className="w-12 h-12 text-stone-500" />
            <h1 className="text-3xl font-bold text-stone-900 sm:text-4xl">
              Page not found
            </h1>
          </div>
          <p className="text-stone-600 text-lg max-w-xl">
            The page you are looking for does not exist. Please check the URL or return to the homepage.
          </p>
          <div className="flex items-center justify-center space-x-3">
            <a
              href="/"
              className="flex items-center justify-center px-5 py-3 bg-[#114B43] text-white rounded-lg hover:bg-[#0F453C] transition-colors font-medium space-x-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Return to homepage</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
