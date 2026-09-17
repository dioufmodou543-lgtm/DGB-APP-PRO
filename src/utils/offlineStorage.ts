/**
 * Local storage & IndexedDB persistence utility for Offline Consultations
 * Specifically caches Timetables, Student Lists, Modules, and Programs.
 */

const OFFLINE_STORAGE_KEY = 'ismnm_offline_academic_cache_v1';
const LAST_SYNC_KEY = 'ismnm_last_sync_timestamp';

export interface OfflineAcademicCache {
  timestamp: number;
  studentsCount: number;
  timetablesCount: number;
  modulesCount: number;
  data: {
    config?: any;
    academicYears?: any[];
    programs?: any[];
    students?: any[];
    enrollments?: any[];
    modules?: any[];
    timetables?: any[];
    grades?: any[];
    attendance?: any[];
    invoices?: any[];
    receipts?: any[];
    cashSession?: any;
    expenses?: any[];
    books?: any[];
    bookLoans?: any[];
    diplomas?: any[];
    auditLogs?: any[];
  };
}

/**
 * Save academic data bundle to local cache for offline retrieval
 */
export function saveAcademicDataToOfflineCache(payload: Partial<OfflineAcademicCache['data']>): void {
  try {
    const existing = getAcademicDataFromOfflineCache();
    const mergedData = {
      ...(existing?.data || {}),
      ...payload,
    };

    const cacheBundle: OfflineAcademicCache = {
      timestamp: Date.now(),
      studentsCount: mergedData.students?.length || 0,
      timetablesCount: mergedData.timetables?.length || 0,
      modulesCount: mergedData.modules?.length || 0,
      data: mergedData,
    };

    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(cacheBundle));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (err) {
    console.warn('Unable to write to localStorage for offline cache:', err);
  }
}

/**
 * Retrieve cached academic data bundle
 */
export function getAcademicDataFromOfflineCache(): OfflineAcademicCache | null {
  try {
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineAcademicCache;
  } catch (err) {
    console.warn('Unable to read from offline cache:', err);
    return null;
  }
}

/**
 * Get last synchronization date string
 */
export function getLastSyncTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Check cache storage metrics
 */
export function getOfflineCacheSummary() {
  const cache = getAcademicDataFromOfflineCache();
  return {
    isCached: !!cache,
    timestamp: cache?.timestamp || null,
    lastSyncFormatted: cache?.timestamp ? new Date(cache.timestamp).toLocaleString('fr-FR') : 'Jamais',
    studentsCount: cache?.studentsCount || 0,
    timetablesCount: cache?.timetablesCount || 0,
    modulesCount: cache?.modulesCount || 0,
  };
}
