import React, { useState } from 'react';
import { Upload, X, AlertCircle, FileText, FileUp, CheckCircle2, Search } from 'lucide-react';

interface SongImportInfo {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  releaseDate?: string;
  addedAt?: string | number; // 支持添加时间字段
}

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
      
      // 验证文本格式
      const validatedLines = lines.map(line => {
        if (line.includes('-')) {
          return line;
        } else {
          throw new Error(`第${lines.indexOf(line) + 1}行格式错误，应为"歌名 - 歌手"`);
        }
      });
      
      await onImport(validatedLines, enableSmartMatch);
      setStatus('success');
      
      // 成功后自动关闭
      setTimeout(() => {
        setStatus('idle');
        setText('');
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('导入错误:', error);
      setStatus('error');
      alert(`导入失败: ${error.message}`);
      
      // 失败后自动关闭
      setTimeout(() => {
        setStatus('idle');
        setText('');
        onClose();
      }, 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVImport = async (file: File) => {
    setIsLoading(true);
    try {
      // 文件大小限制（10MB）
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('文件过大，请选择小于10MB的文件');
      }
      
      // 验证文件类型
      if (!file.name.toLowerCase().endsWith('.csv') && 
          !file.type.includes('csv') && 
          !file.type.includes('text')) {
        throw new Error('请选择CSV格式的文件');
      }
      
      const text = await file.text();
      
      // 安全的CSV解析
      const parsedLines = [];
      const lines = text.split('\n');
      
      for (let i = 1; i < lines.length; i++) { // 从第2行开始（跳过表头）
        const line = lines[i].trim();
        if (line.length === 0) continue;
        
        try {
          const values = parseCSVLine(line);
          
          // 验证基本格式
          if (values.length >= 3) {
            // 字段映射：根据导出文件字段顺序调整映射
            // 字段顺序：1.序号 2.歌名 3.歌手 4.专辑 5.年份 6.封面图片URL 7.添加时间
            const songInfo = {
              title: values[1] || '',
              artist: values[2] || '',
              album: values.length >= 4 ? values[3] : undefined,
              releaseDate: values.length >= 5 ? values[4] : undefined, // 年份（第5列）
              coverUrl: values.length >= 6 ? values[5] : undefined,   // 封面图片URL（第6列）
              addedAt: values.length >= 7 ? values[6] : undefined     // 添加时间（第7列）
            };
            
            // 验证必要字段
            if (songInfo.title && songInfo.artist) {
              parsedLines.push(songInfo);
            }
          }
        } catch (error) {
          console.warn(`第${i+1}行解析失败:`, error);
          // 继续处理其他行，不中断整个导入过程
        }
      }
      
      if (parsedLines.length > 0) {
        // 转换为更安全的数据结构
        const importData = parsedLines.map(info => 
          JSON.stringify(info)
        );
        
        await onImport(importData, enableSmartMatch);
        setStatus('success');
        
        // 显示导入结果
        const successCount = parsedLines.length;
        const totalLines = lines.length - 1;
        alert(`成功导入 ${successCount} 首歌曲（共 ${totalLines} 行数据）`);
        
        // 成功后自动关闭
        setTimeout(() => {
          setStatus('idle');
          setText('');
          onClose();
        }, 1500);
      } else {
        alert('CSV文件格式不正确或没有有效数据');
        
        // 无数据时也自动关闭
        setTimeout(() => {
          setStatus('idle');
          setText('');
          onClose();
        }, 1500);
      }
    } catch (error: any) {
      console.error('CSV导入错误:', error);
      alert(`导入失败: ${error.message}`);
      
      // 失败后自动关闭
      setTimeout(() => {
        setStatus('idle');
        setText('');
        onClose();
      }, 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let escaped = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (escaped) {
        current += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        // 处理双引号："" 表示一个引号字符
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // 跳过下一个引号
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
                   <p className="mt-2 text-xs">CSV文件支持的字段：ID,歌名,歌手,专辑,图片URL,发行日期,添加时间</p>
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

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-light transition-colors cursor-pointer" onClick={() => document.getElementById('csv-file-input')?.click()} style={{ touchAction: 'manipulation' }}>
                <FileUp className="mx-auto text-gray-400 mb-3" size={48} />
                <p className="text-gray-600 mb-2">拖拽CSV文件到此处，或点击选择文件</p>
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileChange}
                  disabled={isLoading || status === 'success'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="csv-file-input"
                  multiple={false}
                  style={{ touchAction: 'manipulation' }}
                />
                <div className={`relative inline-block px-8 py-3 rounded-lg font-medium cursor-pointer transition-colors active:scale-95 ${
                    isLoading || status === 'success'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-brand-light hover:bg-blue-500 text-white shadow-blue-500/30'
                  }`}>
                  <span>{isLoading ? '处理中...' : status === 'success' ? '导入成功' : '选择CSV文件'}</span>
                </div>
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