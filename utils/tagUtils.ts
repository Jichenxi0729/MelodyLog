const TAGS_STORAGE_KEY = 'melodylog_tags_history';

export interface TagInfo {
  name: string;
  colorIndex: number;
  lastUsed: number;
}

// 从歌曲列表中提取所有唯一标签
export const getTagsFromSongs = (songs: any[]): string[] => {
  const tagSet = new Set<string>();
  songs.forEach(song => {
    if (song.tags && Array.isArray(song.tags)) {
      song.tags.forEach((tag: string) => {
        if (tag && typeof tag === 'string') {
          tagSet.add(tag);
        }
      });
    }
  });
  return Array.from(tagSet).sort();
};

export const getTagsHistory = (): TagInfo[] => {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const saveTagsHistory = (tags: TagInfo[]): void => {
  try {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch (error) {
    console.error('Failed to save tags history:', error);
  }
};

export const addTagToHistory = (tagName: string, colorIndex: number): void => {
  const history = getTagsHistory();
  const existingIndex = history.findIndex(t => t.name === tagName);

  if (existingIndex >= 0) {
    history[existingIndex].lastUsed = Date.now();
    history.unshift(history.splice(existingIndex, 1)[0]);
  } else {
    history.unshift({
      name: tagName,
      colorIndex,
      lastUsed: Date.now()
    });
  }

  if (history.length > 50) {
    history.pop();
  }

  saveTagsHistory(history);
};

export const removeTagFromHistory = (tagName: string): void => {
  const history = getTagsHistory();
  const filtered = history.filter(t => t.name !== tagName);
  saveTagsHistory(filtered);
};

export const getTagsNameList = (): string[] => {
  return getTagsHistory().map(t => t.name);
};

export const getNextColorIndex = (): number => {
  const history = getTagsHistory();
  if (history.length === 0) return 0;

  const lastTag = history[0];
  return (lastTag.colorIndex + 1) % 6;
};
