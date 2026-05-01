import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, FileText, FileUp, CheckCircle2, FileJson } from 'lucide-react';
import { useToast } from './Toast';
import { Song } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (lines: string[]) => Promise<void>;
  onJSONImport?: (songs: Song[]) => Promise<void>;
}

type ImportTab = 'text' | 'csv' | 'json';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, onJSONImport }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<ImportTab>('text');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const resetState = () => {
    setStatus('idle');
    setText('');
    setDragOver(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // 文本导入
  const handleImport = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const validatedLines = lines.map(line => {
        if (line.includes('-')) return line;
        throw new Error(`格式错误，应为"歌名 - 歌手"`);
      });
      
      await onImport(validatedLines);
      setStatus('success');
      setTimeout(handleClose, 1500);
    } catch (error: any) {
      setStatus('error');
      showToast(`导入失败: ${error.message}`, 'error');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  // CSV导入
  const handleCSVImport = async (file: File) => {
    setIsLoading(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('文件过大，请选择小于10MB的文件');
      
      const text = await file.text();
      const parsedLines: string[] = [];
      const lines = text.split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const values = parseCSVLine(line);
          if (values.length >= 2) {
            const songInfo = {
              title: values[1] || values[0] || '',
              artist: values[2] || values[1] || '',
              album: values.length >= 4 ? values[3] : undefined,
              releaseDate: values.length >= 5 ? values[4] : undefined,
              coverUrl: values.length >= 6 ? values[5] : undefined,
              tags: values.length >= 7 && values[6] ? values[6].split(';').filter((t: string) => t.trim()) : [],
            };
            if (songInfo.title && songInfo.artist) {
              parsedLines.push(JSON.stringify(songInfo));
            }
          }
        } catch (e) {
          console.warn(`第${i+1}行解析失败`);
        }
      }
      
      if (parsedLines.length > 0) {
        await onImport(parsedLines);
        setStatus('success');
        showToast(`成功导入 ${parsedLines.length} 首歌曲`, 'success');
        setTimeout(handleClose, 1500);
      } else {
        showToast('CSV文件中没有有效数据', 'warning');
      }
    } catch (error: any) {
      showToast(`导入失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // JSON导入
  const handleJSONImport = async (file: File) => {
    if (!onJSONImport) return;
    setIsLoading(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('文件过大，请选择小于20MB的文件');
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 支持 MelodyLog 导出格式或纯数组
      let songs: Song[];
      if (Array.isArray(data)) {
        songs = data;
      } else if (data.songs && Array.isArray(data.songs)) {
        songs = data.songs;
      } else {
        throw new Error('JSON格式不正确，应为歌曲数组或MelodyLog导出格式');
      }
      
      // 验证基本字段
      const validSongs = songs.filter(s => s.title && s.artists && s.artists.length > 0);
      if (validSongs.length === 0) throw new Error('JSON中没有有效的歌曲数据');
      
      await onJSONImport(validSongs);
      setStatus('success');
      showToast(`成功导入 ${validSongs.length} 首歌曲`, 'success');
      setTimeout(handleClose, 1500);
    } catch (error: any) {
      showToast(`导入失败: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 文件处理统一入口
  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
      handleJSONImport(file);
    } else {
      handleCSVImport(file);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isDisabled = isLoading || status === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-brand-dark px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <Upload size={20} /> 导入数据
          </h2>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { key: 'text' as ImportTab, label: '文本', icon: <FileText size={14} /> },
            { key: 'csv' as ImportTab, label: 'CSV', icon: <FileUp size={14} /> },
            { key: 'json' as ImportTab, label: 'JSON', icon: <FileJson size={14} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === tab.key
                  ? 'text-brand-light border-b-2 border-brand-light'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          {/* 文本导入 */}
          {activeTab === 'text' && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
                <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-medium">每行一首，格式：歌曲名 - 歌手名</p>
                  <p className="text-xs mt-1 text-blue-600">如：七里香 - 周杰伦 (七里香)</p>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`七里香 - 周杰伦\n十年 - 陈奕迅\n...`}
                className="w-full h-44 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none font-mono text-sm resize-none"
              />
              <button
                onClick={handleImport}
                disabled={isDisabled || !text.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  status === 'success' ? 'bg-green-500 text-white' : 'bg-brand-light hover:bg-blue-500 text-white'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isLoading ? '处理中...' : status === 'success' ? <><CheckCircle2 size={18} /> 导入成功</> : '开始导入'}
              </button>
            </>
          )}

          {/* CSV/JSON 文件导入 */}
          {(activeTab === 'csv' || activeTab === 'json') && (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex gap-3 text-sm text-amber-800">
                <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="font-medium">
                    {activeTab === 'csv' ? '支持从本应用导出的CSV文件' : '支持从本应用导出的JSON文件'}
                  </p>
                  <p className="text-xs mt-1 text-amber-600">
                    {activeTab === 'csv' ? '字段：歌名,歌手,专辑,年份,封面URL,标签' : 'JSON格式包含完整数据，含歌词和标签'}
                  </p>
                </div>
              </div>
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-brand-light bg-brand-light/5' : 'border-gray-300 hover:border-brand-light'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="mb-3">
                  {activeTab === 'csv' 
                    ? <FileUp className="mx-auto text-gray-400" size={40} />
                    : <FileJson className="mx-auto text-gray-400" size={40} />
                  }
                </div>
                <p className="text-gray-600 mb-3 text-sm">
                  {dragOver ? '松开导入文件' : '拖拽文件到此处，或点击选择'}
                </p>
                <span className={`inline-block px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDisabled ? 'bg-gray-200 text-gray-500' : 'bg-brand-light text-white hover:bg-blue-500'
                }`}>
                  {isLoading ? '处理中...' : status === 'success' ? '导入成功' : `选择${activeTab === 'csv' ? 'CSV' : 'JSON'}文件`}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={activeTab === 'csv' ? '.csv,.txt' : '.json'}
                  onChange={handleFileChange}
                  disabled={isDisabled}
                  className="hidden"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
