// src/components/StickyFormActionBar.jsx
import React from 'react'
import { Save, X, Check, Clock, Sparkles } from 'lucide-react'

export default function StickyFormActionBar({
  isDirty = false,
  isSaving = false,
  lastSavedAt = null,
  onSave,
  onCancel,
  saveText = 'Salva Modifiche',
  cancelText = 'Annulla'
}) {
  if (!isDirty && !lastSavedAt) return null

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 max-w-2xl w-[92%] sm:w-auto px-5 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-6 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        color: '#ffffff'
      }}
    >
      {/* Status Info */}
      <div className="flex items-center gap-3 text-xs sm:text-sm">
        <span 
          className={`w-2.5 h-2.5 rounded-full ${isDirty ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold text-slate-200">
            {isDirty ? 'Modifiche non salvate' : 'Tutte le modifiche salvate'}
          </span>
          {lastSavedAt && (
            <span className="text-slate-400 text-xs flex items-center gap-1">
              <Clock size={11} /> Bozza delle {formatTime(lastSavedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Actions & Hotkey Badge */}
      <div className="flex items-center gap-3">
        {/* Hotkey hint */}
        <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-white/10 text-slate-300 border border-white/10">
          ⌘S / Ctrl+S
        </span>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            {cancelText}
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {saveText}
        </button>
      </div>
    </div>
  )
}
