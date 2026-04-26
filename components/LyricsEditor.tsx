import React, { useState, useEffect } from 'react';
import { X, FileText, Clock, Check, AlertCircle } from 'lucide-react';
import { parseLRC, parsePlainText, convertToSimplified } from '../services/lyricsService';

interface LyricsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  songTitle: string;
  artistName?: string;
  onSave: (lyrics: string, isLRC: boolean) => void;
  existingLyrics?: string;
}

export const LyricsEditor: React.FC<LyricsEditorProps> = ({
  isOpen,
  onClose,
  songTitle,
  artistName,
  onSave,
  existingLyrics
}) => {
  const [lyricsInput, setLyricsInput] = useState(existingLyrics || '');
  const [isLRC, setIsLRC] = useState(false);
  const [preview, setPreview] = useState<Array<{ time?: string; text: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingLyrics) {
      setLyricsInput(existingLyrics);
    }
  }, [existingLyrics]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLyricsInput(value);
    setError(null);

    if (value.trim()) {
      try {
        const lines = value.split('\n').filter(line => line.trim());
        const hasTimeTag = lines.some(line => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(line.trim()));

        if (hasTimeTag) {
          setIsLRC(true);
          const parsed = parseLRC(value);
          setPreview(parsed.synced.length > 0 ? parsed.synced : parsed.plain.map(text => ({ text })));
        } else {
          setIsLRC(false);
          const plainLines = parsePlainText(value);
          setPreview(plainLines.map(text => ({ text })));
        }
      } catch (err) {
        setError('歌词格式解析失败');
        setPreview([]);
      }
    } else {
      setIsLRC(false);
      setPreview([]);
    }
  };

  const handleSave = () => {
    if (!lyricsInput.trim()) {
      setError('请输入歌词内容');
      return;
    }

    if (preview.length === 0) {
      setError('无法解析歌词，请检查格式');
      return;
    }

    onSave(lyricsInput, isLRC);
    onClose();
  };

  const handleClear = () => {
    setLyricsInput('');
    setPreview([]);
    setIsLRC(false);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">添加歌词</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {songTitle}
              {artistName && <span className="ml-2">- {artistName}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              粘贴歌词内容
            </label>
            <textarea
              value={lyricsInput}
              onChange={handleInputChange}
              placeholder={
                isLRC
                  ? "粘贴LRC格式歌词...\n[00:12.34] 第一句歌词\n[00:15.67] 第二句歌词"
                  : "粘贴纯文本歌词...\n每行一句歌词"
              }
              className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-mono bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              disabled={preview.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                preview.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <FileText size={16} />
              {showPreview ? '隐藏预览' : '预览解析结果'}
            </button>

            {isLRC && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Clock size={16} />
                同步歌词格式
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>

          {showPreview && preview.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 max-h-64 overflow-y-auto">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                预览（共 {preview.length} 句）
              </h3>
              <div className="space-y-2">
                {preview.slice(0, 20).map((line, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    {isLRC && line.time && (
                      <span className="text-slate-400 font-mono text-xs mt-0.5">
                        {line.time}
                      </span>
                    )}
                    <span className="text-slate-700 dark:text-slate-300">{line.text}</span>
                  </div>
                ))}
                {preview.length > 20 && (
                  <p className="text-sm text-slate-400 italic">
                    ... 还有 {preview.length - 20} 句歌词
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
              💡 提示
            </h3>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <li>• 支持粘贴 <strong>LRC格式</strong> 歌词（带时间戳，如 [00:12.34]）</li>
              <li>• 支持粘贴 <strong>纯文本</strong> 歌词（每行一句）</li>
              <li>• 自动识别格式并转换为简体中文</li>
              <li>• 歌词将同步保存到云端，多设备共享</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            清空
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!lyricsInput.trim() || preview.length === 0}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              lyricsInput.trim() && preview.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check size={16} />
            保存歌词
          </button>
        </div>
      </div>
    </div>
  );
};

export default LyricsEditor;