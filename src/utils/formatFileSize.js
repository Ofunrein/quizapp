/**
 * Format file size in bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB", "512 KB", "2.3 GB")
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  
  const kb = bytes / 1024;
  
  // Under 1024 KB - show as KB
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  
  const mb = kb / 1024;
  
  // From 1024 KB to under 1024 MB - show as MB
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  
  const gb = mb / 1024;
  
  // 1024 MB and above - show as GB
  return `${gb.toFixed(1)} GB`;
} 