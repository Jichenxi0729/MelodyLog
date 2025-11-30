import React, { useState } from 'react';
import { Upload, X, AlertCircle, FileText, FileUp, CheckCircle2, Search } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (lines: string[], enableSmartMatch: boolean) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'text' | 'csv'>('text');
  const [enableSmartMatch, setEnableSmartMatch] = useState(true);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      await onImport(lines, enableSmartMatch);
      setStatus('success');
    } catch (error) {
      console.error('导入错误:', error);
      setStatus('error');
      alert('导入失败，请检查数据格式');
    } finally {
      setIsLoading(false);
      
      setTimeout(() => {
        if (status === 'success' || status === 'error') {
          setStatus('idle');
          setText('');
          onClose();
        }
      }, 1500);
    }
  };

  const handleCSVImport = async (file: File) => {
    setIsLoading(true);
    try {
      const text = await file.text();
      const parsedLines = text.split('\n')
        .slice(1) // 跳过表头
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const values = parseCSVLine(line);
          if (values.length >= 3) {
            // 格式：歌名 - 歌手 (专辑)
            const title = values[1].trim();
            const artist = values[2].trim();
            const album = values.length >= 4 ? values[3].trim() : '';
            
            if (title && artist) {
              return album ? `${title} - ${artist} (${album})` : `${title} - ${artist}`;
            }
          }
          return null;
        }).filter(line => line !== null) as string[];
      
      if (parsedLines.length > 0) {
        await onImport(parsedLines, enableSmartMatch);
        setStatus('success');
      } else {
        alert('CSV文件格式不正确或没有有效数据');
      }
    } catch (error) {
      console.error('CSV导入错误:', error);
      alert('CSV文件读取失败，请检查文件格式');
    } finally {
      setIsLoading(false);
      
      setTimeout(() => {
        if (status === 'success') {
          setStatus('idle');
          setText('');
          onClose();
        }
      }, 1500);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCSVImport(file);
    }
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

        {/* 标签页切换 */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'text' 
                ? 'text-brand-light border-b-2 border-brand-light' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            文本导入
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'csv' 
                ? 'text-brand-light border-b-2 border-brand-light' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            CSV导入
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 智能匹配开关 */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-brand-light" />
              <div>
                <p className="text-sm font-medium text-slate-800">智能匹配歌曲信息</p>
                <p className="text-xs text-slate-500">自动获取封面图片、专辑、发行日期等信息</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={enableSmartMatch}
                onChange={(e) => setEnableSmartMatch(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-light"></div>
            </label>
          </div>

          {activeTab === 'text' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex gap-3 text-sm text-green-800">
                 <AlertCircle className="flex-shrink-0" size={20} />
                 <div>
                   <p className="font-semibold">CSV导入说明</p>
                   <p>请上传导出的CSV文件，支持以下格式：</p>
                   <ul className="mt-1 list-disc list-inside space-y-1">
                     <li>支持从本应用导出的CSV文件</li>
                     <li>支持标准CSV格式：歌名,歌手,专辑,年份</li>
                     <li>自动跳过表头行</li>
                   </ul>
                 </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-light transition-colors">
                <FileUp className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-600 mb-2">拖拽CSV文件到此处，或点击选择文件</p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  disabled={isLoading || status === 'success'}
                  className="hidden"
                  id="csv-file-input"
                  multiple={false}
                />
                <label
                  htmlFor="csv-file-input"
                  className={`inline-block px-8 py-3 rounded-lg font-medium cursor-pointer transition-colors active:scale-95 ${
                    isLoading || status === 'success'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-light hover:bg-blue-500 text-white shadow-blue-500/30'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {isLoading ? '处理中...' : status === 'success' ? '导入成功' : '选择CSV文件'}
                </label>
                <p className="text-xs text-gray-500 mt-2">支持.csv格式文件</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600 font-medium mb-1">CSV文件示例：</p>
                <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
{`序号,歌名,歌手,专辑,年份
1,七里香,周杰伦,七里香,2004
2,十年,陈奕迅,黑白灰,2003
3,晴天,周杰伦,叶惠美,2003`}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;