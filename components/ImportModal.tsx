import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (lines: string[]) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    await onImport(lines);
    setIsLoading(false);
    setStatus('success');
    
    setTimeout(() => {
        setStatus('idle');
        setText('');
        onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-brand-dark px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Upload size={20} /> 批量导入
          </h2>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
             <AlertCircle className="flex-shrink-0" size={20} />
             <div>
               <p className="font-semibold">格式说明</p>
               <p>请在下方粘贴您的列表，每行格式如下：</p>
               <code className="bg-white px-2 py-0.5 rounded border border-blue-200 text-xs mt-1 block w-fit">歌曲名 - 歌手名</code>
             </div>
          </div>

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`七里香 - 周杰伦\n十年 - 陈奕迅\n...`}
              className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none font-mono text-sm resize-none"
            />
            <FileText className="absolute right-4 bottom-4 text-slate-300 pointer-events-none" size={24} />
          </div>

          <button
            onClick={handleImport}
            disabled={isLoading || status === 'success' || !text.trim()}
            className={`w-full py-3 rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${
                status === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-brand-light hover:bg-blue-500 text-white shadow-blue-500/30'
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
                '处理中...'
            ) : status === 'success' ? (
                <><CheckCircle2 size={20} /> 导入成功</>
            ) : (
                '开始导入'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};