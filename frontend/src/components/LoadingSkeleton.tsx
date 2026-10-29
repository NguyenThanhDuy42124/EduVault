import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 p-5 space-y-4 animate-pulse">
      <div className="w-full h-40 bg-slate-100 rounded-xl" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-8 bg-slate-100 rounded-lg w-24" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-50 border-b border-slate-200/60" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between space-x-4">
            <div className="h-4 bg-slate-100 rounded w-1/4" />
            <div className="h-4 bg-slate-100 rounded w-1/6" />
            <div className="h-4 bg-slate-100 rounded w-1/5" />
            <div className="h-7 bg-slate-100 rounded-lg w-20" />
          </div>
        ))}
      </div>
    </div>
  );
};
