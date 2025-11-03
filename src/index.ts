/**
 * vue-version-watcher v1.2
 * @description 系统版本检测插件（基于 ETag + 静态资源错误 + History API 监听）
 * @description 无需依赖 Vue Router，自动监听 URL 变化；支持同源资源检测与 ETag 校验。
 */

declare global {
  interface Window {
    __VERSION_WATCHER_INSTALLED__?: boolean;
    ElMessageBox?: any;
    ElMessage?: any;
  }
}

export interface VersionWatcherOptions {
  /** 检测开关，默认 true */
  enabled?: boolean;
  /** 检测间隔（毫秒），默认 30000 */
  checkInterval?: number;
  /** 自定义检测路径，默认当前域名根路径 */
  checkPath?: string;
  /** 静默模式，不输出日志 */
  silent?: boolean;
  /** 自定义更新提示函数 */
  onUpdateDetected?: () => void;
  /** 忽略的路径模式（正则表达式） */
  ignorePaths?: RegExp;
}

// Vue 插件类型
interface VuePlugin {
  install: (app: any, options?: VersionWatcherOptions) => void;
}

let sysVersion: string | null = null; // 系统版本号
let checkTimer: number | null = null;
let isInitialized = false;

/** 初始化版本检测 */
export function setupVersionWatcher(options: VersionWatcherOptions = {}): void {
  const {
    enabled = true,
    checkInterval = 0,
    checkPath = `${window.location.origin}/`,
    silent = false,
    onUpdateDetected,
    ignorePaths,
  } = options;

  if (!enabled) {
    !silent && console.log("[versionWatcher] 已关闭（当前环境未启用检测）");
    return;
  }

  if (isInitialized) {
    !silent && console.warn("[versionWatcher] 已存在，跳过重复注册。");
    return;
  }
  isInitialized = true;

  !silent && console.log("[versionWatcher] 启用版本更新检测(v1.2)...");

  // 检查当前路径是否在忽略列表中
  if (ignorePaths && ignorePaths.test(window.location.pathname)) {
    !silent && console.log("[versionWatcher] 忽略当前路径，跳过初始化。");
    return;
  }

  // 设置定期检测
  if (checkInterval > 0) {
    checkTimer = window.setInterval(() => {
      versionUpdateHandler(checkPath, silent, onUpdateDetected);
    }, checkInterval);
  }

  // Hook history API
  hookHistoryChange(() => {
    // 检查新路径是否在忽略列表中
    if (ignorePaths && ignorePaths.test(window.location.pathname)) {
      !silent &&
        console.log("[versionWatcher] 导航到忽略的路径，跳过版本检查。");
      return;
    }
    versionUpdateHandler(checkPath, silent, onUpdateDetected);
  });
  window.addEventListener("popstate", () => {
    // 检查新路径是否在忽略列表中
    if (ignorePaths && ignorePaths.test(window.location.pathname)) {
      !silent &&
        console.log("[versionWatcher] 导航到忽略的路径，跳过版本检查。");
      return;
    }
    versionUpdateHandler(checkPath, silent, onUpdateDetected);
  });

  // 捕获静态资源错误（仅同源资源）
  setupErrorMonitoring(checkPath, silent, onUpdateDetected);

  // 初始检测
  versionUpdateHandler(checkPath, silent, onUpdateDetected);
}

/** 设置错误监控 */
function setupErrorMonitoring(
  checkPath: string,
  silent: boolean,
  onUpdateDetected?: () => void
): void {
  let errorCount = 0;
  const checkError = debounce(async (): Promise<void> => {
    if (errorCount > 1) {
      const newVersion = await getETag(checkPath, silent);
      if (sysVersion && newVersion && sysVersion !== newVersion) {
        if (onUpdateDetected) {
          onUpdateDetected();
        } else {
          showUpdateDialog(silent);
        }
      }
    }
    errorCount = 0;
  }, 1000);

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const target = event.target as
        | (HTMLElement & { src?: string; href?: string })
        | null;
      const url = target?.src || target?.href;
      if (!url) return;

      // 忽略第三方资源
      if (!url.startsWith(window.location.origin)) return;

      if (
        target &&
        (target.tagName === "SCRIPT" || target.tagName === "LINK")
      ) {
        !silent &&
          console.warn("[versionWatcher] 静态资源加载失败，检测中:", url);
        errorCount++;
        checkError();
      }
    },
    true
  );
}

/** 销毁版本检测器 */
export function destroyVersionWatcher(): void {
  if (checkTimer) {
    window.clearInterval(checkTimer);
    checkTimer = null;
  }
  isInitialized = false;

  // 恢复原始的 history 方法
  if ((window as any).__ORIGINAL_PUSH_STATE__) {
    history.pushState = (window as any).__ORIGINAL_PUSH_STATE__;
  }
  if ((window as any).__ORIGINAL_REPLACE_STATE__) {
    history.replaceState = (window as any).__ORIGINAL_REPLACE_STATE__;
  }
  console.log("[versionWatcher] Destroyed");
}

/***
 * ETag是由Web服务器分配给在URL中找到的特定版本资源的不透明标识符。
 * 如果该URL的资源表示发生了变化，则会重新分配一个新的ETag。ETag类似于指纹，可以快速进行比较以确定资源的两种表示是否相同。
 */
/** 获取服务器 ETag 或 Last-Modified */
async function getETag(url: string, silent: boolean): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-cache",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.headers.get("etag") || res.headers.get("last-modified") || "";
  } catch (error) {
    !silent && console.warn("[versionWatcher] Failed to get ETag:", error);
    return "";
  }
}
/** ETag 版本检测逻辑 */
async function versionUpdateHandler(
  checkPath: string,
  silent: boolean,
  onUpdateDetected?: () => void
) {
  try {
    const newVersion = await getETag(checkPath, silent);
    if (!sysVersion) {
      sysVersion = newVersion;
      return;
    }
    if (sysVersion !== newVersion) {
      !silent &&
        console.log(
          `[versionWatcher] 检测到版本变化：${sysVersion} → ${newVersion}`
        );
      if (onUpdateDetected) {
        onUpdateDetected();
      } else {
        showUpdateDialog(silent);
      }
    }
  } catch (error) {
    !silent && console.warn("[versionWatcher] 检测版本信息失败：", error);
  }
}

/** 弹出提示框（自动选择 UI 或原生） */
function showUpdateDialog(silent: boolean): void {
  const showDialog = debounce(() => {
    if (window.ElMessageBox) {
      const { ElMessageBox, ElMessage } = window;
      ElMessageBox.confirm(
        "检测到系统版本更新，是否刷新页面获取最新内容？",
        "系统更新提示",
        {
          confirmButtonText: "刷新",
          cancelButtonText: "取消",
          type: "warning",
        }
      )
        .then(() => window.location.reload())
        .catch(() => ElMessage?.({ type: "info", message: "已取消刷新" }));
    } else {
      if (confirm("检测到系统版本更新，是否刷新页面？")) {
        window.location.reload();
      } else {
        !silent && console.log("[versionWatcher] 已取消刷新");
      }
    }
  }, 500);

  showDialog();
}

/** 监听 history.pushState / replaceState */
function hookHistoryChange(callback: () => void) {
  // 保存原始方法
  if (!(window as any).__ORIGINAL_PUSH_STATE__) {
    (window as any).__ORIGINAL_PUSH_STATE__ = history.pushState;
  }
  if (!(window as any).__ORIGINAL_REPLACE_STATE__) {
    (window as any).__ORIGINAL_REPLACE_STATE__ = history.replaceState;
  }

  const originalPushState = (window as any).__ORIGINAL_PUSH_STATE__;
  const originalReplaceState = (window as any).__ORIGINAL_REPLACE_STATE__;

  history.pushState = function (...args: any[]): void {
    const result = originalPushState.apply(this, args);
    callback();
    return result;
  };

  history.replaceState = function (...args: any[]): void {
    const result = originalReplaceState.apply(this, args);
    callback();
    return result;
  };
}

// 防抖函数
function debounce(fn: Function, delay = 300) {
  let timer: number | undefined;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

// Vue 插件对象
const VueVersionWatcher: VuePlugin = {
  install: (app: any, options: VersionWatcherOptions = {}): void => {
    // 在 Vue 应用中自动设置
    if (app._versionWatcherInstalled) {
      console.warn("[versionWatcher] Plugin already installed in this Vue app");
      return;
    }

    app._versionWatcherInstalled = true;

    // 可选：提供全局方法
    app.config.globalProperties.$versionWatcher = {
      setup: (opts: VersionWatcherOptions) => setupVersionWatcher(opts),
      destroy: destroyVersionWatcher,
    };

    // 设置版本监听
    setupVersionWatcher(options);
  },
};

export default VueVersionWatcher;
