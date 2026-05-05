// 大语言模型解析服务 - 用于解析自然语言中的歌曲信息

import API_CONFIG from './apiConfig';

export interface ParsedSongInfo {
  songName: string;
  artist: string;
  album?: string;
  tags?: string[];
}

export interface ParseResult {
  success: boolean;
  data?: ParsedSongInfo;
  error?: string;
}

class LlmParser {
  private useLLM: boolean;

  constructor() {
    // 检查是否配置了硅基流动API密钥
    this.useLLM = !!API_CONFIG.SILICON_FLOW.API_KEY;
  }

  // 解析自然语言描述，提取歌曲信息
  async parseDescription(description: string): Promise<ParseResult> {
    if (!description.trim()) {
      return { success: false, error: '请输入描述内容' };
    }

    // 如果配置了大模型API，使用大模型解析
    if (this.useLLM) {
      return this.parseWithLLM(description);
    }

    // 如果未配置API密钥，返回错误提示
    return { 
      success: false, 
      error: '未配置大模型API密钥，请在 .env 文件中设置 VITE_SILICON_FLOW_API_KEY' 
    };
  }

  // 使用硅基流动大模型API解析
  private async parseWithLLM(description: string): Promise<ParseResult> {
    const apiKey = API_CONFIG.SILICON_FLOW.API_KEY;
    const baseUrl = API_CONFIG.SILICON_FLOW.BASE_URL;
    const model = API_CONFIG.SILICON_FLOW.MODEL;

    if (!apiKey) {
      return { success: false, error: '未配置硅基流动API密钥' };
    }

    const prompt = `
你是一个专业的音乐信息提取助手。请从用户的自然语言描述中精确提取歌曲名、歌手名、专辑名和标签信息。

用户描述：${description}

请严格按照以下JSON格式输出结果：
{
  "songName": "歌曲名称",
  "artist": "歌手名称",
  "album": "专辑名称",
  "tags": ["标签1", "标签2"]
}

只输出JSON格式，不要输出任何其他文本。
    `.trim();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API请求失败: ${response.status} - ${errorText}`);
        return { success: false, error: `API请求失败: ${response.status}` };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        console.error('API返回结果为空');
        return { success: false, error: 'API返回结果为空' };
      }

      console.log('大模型原始返回:', content);

      // 解析JSON响应
      try {
        // 清理可能存在的特殊字符
        const cleanedContent = this.cleanResponse(content);
        
        // 尝试直接解析
        const parsedData = JSON.parse(cleanedContent);
        return {
          success: true,
          data: this.validateAndCleanResult(parsedData),
        };
      } catch (parseError) {
        console.warn('JSON解析失败，尝试提取JSON:', parseError);
        
        // 如果JSON解析失败，尝试从响应中提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const cleanedContent = this.cleanResponse(jsonMatch[0]);
            const parsedData = JSON.parse(cleanedContent);
            return {
              success: true,
              data: this.validateAndCleanResult(parsedData),
            };
          } catch (e) {
            console.error('提取JSON后解析仍然失败:', e);
            console.error('原始内容:', content);
            return { success: false, error: '无法解析API返回的JSON' };
          }
        }
        
        console.error('无法从响应中提取JSON:', content);
        return { success: false, error: 'API返回的不是有效JSON' };
      }
    } catch (error) {
      console.error('大模型API调用失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '未知错误' };
    }
  }

  // 清理响应内容，移除可能导致解析失败的字符
  private cleanResponse(content: string): string {
    let cleaned = content;
    
    // 移除首尾的空白字符
    cleaned = cleaned.trim();
    
    // 移除可能的markdown代码块标记
    cleaned = cleaned.replace(/^```(json)?\s*/, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    
    // 移除可能的BOM字符
    cleaned = cleaned.replace(/^\uFEFF/, '');
    
    // 替换特殊空白字符
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 确保引号正确
    cleaned = cleaned.replace(/''/g, '"');
    
    return cleaned;
  }

  // 验证并清理解析结果
  private validateAndCleanResult(data: any): ParsedSongInfo {
    const result: ParsedSongInfo = {
      songName: '',
      artist: '',
      album: '',
      tags: [],
    };

    if (typeof data.songName === 'string') {
      result.songName = data.songName.trim();
    }

    if (typeof data.artist === 'string') {
      result.artist = data.artist.trim();
    }

    if (typeof data.album === 'string') {
      result.album = data.album.trim();
    }

    // 处理tags
    if (Array.isArray(data.tags)) {
      result.tags = data.tags
        .filter((tag: any) => typeof tag === 'string' && tag.trim())
        .map((tag: string) => tag.trim());
    } else if (typeof data.tags === 'string' && data.tags.trim()) {
      // 如果tags是字符串，尝试分割
      result.tags = data.tags.split(/[,，、]/).map((tag: string) => tag.trim()).filter(Boolean);
    }

    return result;
  }
}

export const llmParser = new LlmParser();
