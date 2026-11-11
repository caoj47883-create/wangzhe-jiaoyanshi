package com.wangzhe.jiaoyanshi;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 王者教研室 V2.1.0 — 纯本地 WebView 外壳 + GitHub Pages 数据热更新 + AI 问答桥。
 *
 * 架构（不再依赖 Android assets 目录读取，也不再依赖自定义域名拦截）：
 *  1. 网页整站打包为 res/raw/site.zip；
 *  2. 首次启动/版本变化时解压到应用私有目录 files/site；
 *  3. 在 127.0.0.1 上起一个本地 HTTP 服务提供 files/site；
 *  4. WebView 直接加载 http://127.0.0.1:端口/index.html（真实同源 HTTP，无跨域/拦截兼容问题）；
 *  5. 若本地服务失败，回退到 assets 拦截方案；再失败显示诊断页（不会再跳在线旧站）。
 */
public class MainActivity extends Activity {

    private static final String LOCAL_HOST = "appassets.v2.local";
    private static final String LOCAL_BASE = "https://" + LOCAL_HOST + "/";
    private static final String LOCAL_INDEX = LOCAL_BASE + "index.html";
    private static final int APP_BG = 0xFF080A0E;
    private static final long DOUBLE_BACK_MS = 2200L;
    /** 固定端口段：WebView localStorage 按 origin(scheme://host:port) 隔离，端口固定才能跨启动保留状态。 */
    private static final int HTTP_PORT_START = 17653;
    private static final int HTTP_PORT_TRIES = 12;

    private WebView webView;
    private String appVersion = "2.3.1";

    // 语音输入（Android 原生 SpeechRecognizer，不依赖 WebView 的 Web Speech API）
    private static final int REQ_RECORD_AUDIO = 7101;
    private SpeechRecognizer speechRecognizer;
    private boolean speechListening = false;
    private String speechRequestId = null;
    private String pendingVoiceRequestId = null;
    private boolean pendingVoiceCancelled = false;
    private long lastRmsEventAt = 0L;

    // 本地 HTTP 服务
    private File siteDir;
    private ServerSocket serverSocket;
    private ExecutorService serverPool;
    private volatile int serverPort = 0;
    private volatile boolean usingHttpServer = false;

    // 诊断 / 兜底状态
    private String prepareLog = "";
    private boolean localHtmlFallbackTried = false;
    private boolean diagnosticShown = false;
    private boolean readinessScheduled = false;
    private String lastErrorInfo = "";
    private long lastBackPress = 0L;

    /* ------------------------------------------------------------------ */
    /*  Lifecycle                                                          */
    /* ------------------------------------------------------------------ */

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            appVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception ignored) {
        }
        setupSystemBars();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(APP_BG);

        webView = new WebView(this);
        webView.setBackgroundColor(APP_BG);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        configureWebView();

        root.addView(webView);
        setContentView(root);

        Toast.makeText(this, "王者教研室 V" + appVersion + " · 纯本地版", Toast.LENGTH_SHORT).show();

        if (isWebViewTooOld()) {
            showWebViewTooOldPage(webView);
        } else {
            prepareAndServe();
        }
    }

    private void setupSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(APP_BG);
        window.setNavigationBarColor(APP_BG);
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setTextZoom(100);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(false);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            s.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setBackgroundColor(APP_BG);
        WebView.setWebContentsDebuggingEnabled(false);

        webView.addJavascriptInterface(new AppBridge(), "AppBridge");
        webView.setWebViewClient(new AppClient());
        webView.setWebChromeClient(new WebChromeClient());
    }

    /** The bundled app needs a reasonably modern Chromium (modern CSS uses color-mix). */
    private boolean isWebViewTooOld() {
        try {
            String ua = webView.getSettings().getUserAgentString();
            if (ua == null) {
                return false;
            }
            Matcher m = Pattern.compile("Chrome/(\\d+)").matcher(ua);
            if (m.find()) {
                return Integer.parseInt(m.group(1)) < 111;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private void showWebViewTooOldPage(WebView view) {
        String html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>"
                + "<style>html,body{margin:0;height:100%;background:#080a0e;color:#f2efe8;"
                + "font-family:sans-serif;display:flex;align-items:center;justify-content:center}"
                + "div{text-align:center;padding:26px;max-width:420px}h1{font-size:20px;color:#e3c078}"
                + "p{color:#9aa7b8;font-size:13px;line-height:1.9;text-align:left}</style></head><body><div>"
                + "<h1>系统 WebView 版本过低</h1>"
                + "<p>本应用内置的网页需要较新的系统 WebView（Chromium 111+）才能运行。<br/><br/>"
                + "请到手机自带的应用商店搜索并更新「<b>Android System WebView</b>」"
                + "（或「<b>Chrome</b>」「系统浏览器」），更新后重新打开本应用即可。</p>"
                + "</div></body></html>";
        view.loadDataWithBaseURL(LOCAL_BASE, html, "text/html", "utf-8", null);
    }

    /* ------------------------------------------------------------------ */
    /*  纯本地服务：res/raw/site.zip -> files/site -> 127.0.0.1 HTTP       */
    /* ------------------------------------------------------------------ */

    private void prepareAndServe() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                final StringBuilder log = new StringBuilder();
                try {
                    siteDir = new File(getFilesDir(), "site");
                    int n = extractSiteZip(siteDir, log);
                    log.append("内置资源解压成功：").append(n).append(" 个文件\n");
                    if (!new File(siteDir, "index.html").isFile()) {
                        throw new IOException("解压后缺少 index.html");
                    }
                    final int port = startHttpServer(siteDir);
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            loadLocalServer(port);
                        }
                    });
                } catch (final Throwable t) {
                    log.append("本地服务启动失败：").append(t.getClass().getSimpleName())
                            .append(": ").append(t.getMessage()).append("\n");
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            fallbackToAssets(log.toString());
                        }
                    });
                }
            }
        }, "wzjs-site").start();
    }

    /** 把 res/raw/site.zip 解压到 files/site；版本变化时重新解压。 */
    private int extractSiteZip(File dir, StringBuilder log) throws IOException {
        SharedPreferences sp = getSharedPreferences("wzjs_site", MODE_PRIVATE);
        File index = new File(dir, "index.html");
        if (sp.getString("version", "").equals(appVersion) && index.isFile()) {
            return countFiles(dir);
        }
        deleteRecursive(dir);
        if (!dir.mkdirs() && !dir.isDirectory()) {
            throw new IOException("无法创建目录 " + dir);
        }
        InputStream raw;
        try {
            raw = getResources().openRawResource(R.raw.site);
        } catch (Throwable t) {
            log.append("读取 res/raw/site.zip 失败：").append(t).append("\n");
            throw new IOException("无法读取内置压缩包: " + t.getMessage());
        }
        ZipInputStream zin = new ZipInputStream(new BufferedInputStream(raw));
        int count = 0;
        try {
            ZipEntry e;
            byte[] buf = new byte[8192];
            while ((e = zin.getNextEntry()) != null) {
                String name = e.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("..")) {
                    continue;
                }
                File f = new File(dir, name);
                if (e.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    f.mkdirs();
                    continue;
                }
                File parent = f.getParentFile();
                if (parent != null && !parent.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    parent.mkdirs();
                }
                FileOutputStream fos = new FileOutputStream(f);
                try {
                    int r;
                    while ((r = zin.read(buf)) > 0) {
                        fos.write(buf, 0, r);
                    }
                } finally {
                    fos.close();
                }
                count++;
            }
        } finally {
            zin.close();
        }
        sp.edit().putString("version", appVersion).apply();
        return count;
    }

    private void loadLocalServer(final int port) {
        serverPort = port;
        usingHttpServer = true;
        try {
            webView.clearCache(true);
        } catch (Exception ignored) {
        }
        webView.loadUrl(localHttpBase() + "index.html");
        scheduleReadinessCheck(9000);
    }

    private String localHttpBase() {
        return "http://127.0.0.1:" + serverPort + "/";
    }

    private int startHttpServer(final File root) throws IOException {
        // 固定端口段：WebView localStorage 按 origin(scheme://host:port) 隔离，
        // 端口固定才能让收藏/设置/热更新数据跨启动保留。
        ServerSocket ss = null;
        IOException lastError = null;
        for (int i = 0; i < HTTP_PORT_TRIES; i++) {
            try {
                ServerSocket candidate = new ServerSocket();
                candidate.setReuseAddress(true);
                candidate.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), HTTP_PORT_START + i), 50);
                ss = candidate;
                break;
            } catch (IOException e) {
                lastError = e;
            }
        }
        if (ss == null) {
            // 极端情况：端口全被占用，退回随机端口（本次可用，但 localStorage 会换 origin）
            ss = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
            prepareLog = prepareLog + "固定端口不可用，已用随机端口：" + lastError + "\n";
        }
        serverSocket = ss;
        serverPool = Executors.newFixedThreadPool(4);
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                while (true) {
                    try {
                        final Socket socket = serverSocket.accept();
                        serverPool.submit(new Runnable() {
                            @Override
                            public void run() {
                                handleHttp(socket, root);
                            }
                        });
                    } catch (IOException e) {
                        break;
                    }
                }
            }
        }, "wzjs-http");
        t.setDaemon(true);
        t.start();
        return ss.getLocalPort();
    }

    /** 极简本地静态文件服务（只服务 files/site 下的文件）。 */
    private void handleHttp(Socket socket, File root) {
        try {
            InputStream in = socket.getInputStream();
            byte[] buf = new byte[8192];
            int total = 0;
            int r;
            String req = "";
            while (total < buf.length && (r = in.read(buf, total, buf.length - total)) > 0) {
                total += r;
                req = new String(buf, 0, total, "US-ASCII");
                if (req.contains("\r\n\r\n")) {
                    break;
                }
            }
            String[] parts = req.split("\r\n", 2)[0].split(" ");
            if (parts.length < 2) {
                writeSimple(socket, 400, "Bad Request");
                return;
            }
            String method = parts[0];
            String target = parts[1];
            int q = target.indexOf('?');
            if (q >= 0) {
                target = target.substring(0, q);
            }
            int h = target.indexOf('#');
            if (h >= 0) {
                target = target.substring(0, h);
            }
            String path;
            try {
                path = URLDecoder.decode(target, "UTF-8");
            } catch (Exception e) {
                path = target;
            }
            if (path.endsWith("/")) {
                path = path + "index.html";
            }
            if (!path.startsWith("/")) {
                path = "/" + path;
            }
            if (path.contains("..")) {
                writeSimple(socket, 403, "Forbidden");
                return;
            }
            File file = new File(root, path);
            if (!file.isFile() && !path.contains(".")) {
                file = new File(root, "index.html"); // SPA fallback
            }
            if (!file.isFile()) {
                writeSimple(socket, 404, "Not Found");
                return;
            }
            byte[] data = readFully(file);
            String head = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: " + mimeOf(file.getName()) + "\r\n"
                    + "Content-Length: " + data.length + "\r\n"
                    + "Cache-Control: no-store\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Connection: close\r\n\r\n";
            OutputStream out = socket.getOutputStream();
            out.write(head.getBytes("US-ASCII"));
            if (!"HEAD".equalsIgnoreCase(method)) {
                out.write(data);
            }
            out.flush();
        } catch (Exception ignored) {
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void writeSimple(Socket socket, int code, String text) {
        try {
            byte[] body = text.getBytes("UTF-8");
            String reason = code == 404 ? "Not Found" : code == 403 ? "Forbidden" : "Bad Request";
            String head = "HTTP/1.1 " + code + " " + reason + "\r\n"
                    + "Content-Type: text/plain; charset=utf-8\r\n"
                    + "Content-Length: " + body.length + "\r\n"
                    + "Connection: close\r\n\r\n";
            OutputStream out = socket.getOutputStream();
            out.write(head.getBytes("US-ASCII"));
            out.write(body);
            out.flush();
        } catch (Exception ignored) {
        }
    }

    private static byte[] readFully(File file) throws IOException {
        FileInputStream fis = new FileInputStream(file);
        try {
            byte[] data = new byte[(int) file.length()];
            int off = 0;
            while (off < data.length) {
                int r = fis.read(data, off, data.length - off);
                if (r <= 0) {
                    break;
                }
                off += r;
            }
            return data;
        } finally {
            fis.close();
        }
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) {
            return;
        }
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) {
                for (File c : children) {
                    deleteRecursive(c);
                }
            }
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private static int countFiles(File dir) {
        int n = 0;
        File[] children = dir.listFiles();
        if (children == null) {
            return 0;
        }
        for (File c : children) {
            n += c.isDirectory() ? countFiles(c) : 1;
        }
        return n;
    }

    /* ------------------------------------------------------------------ */
    /*  Fallbacks / diagnostics                                            */
    /* ------------------------------------------------------------------ */

    private void fallbackToAssets(String reason) {
        if (diagnosticShown) {
            return;
        }
        prepareLog = reason;
        usingHttpServer = false;
        try {
            webView.clearCache(true);
        } catch (Exception ignored) {
        }
        webView.loadUrl(LOCAL_INDEX);
        scheduleReadinessCheck(9000);
    }

    private void scheduleReadinessCheck(final long delayMs) {
        if (readinessScheduled) {
            return;
        }
        readinessScheduled = true;
        webView.postDelayed(new Runnable() {
            @Override
            public void run() {
                readinessScheduled = false;
                checkRenderedOrFallback();
            }
        }, delayMs);
    }

    private void checkRenderedOrFallback() {
        if (webView == null || diagnosticShown) {
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{var r=document.getElementById('root');return String(r?r.childElementCount:0);}catch(e){return '-1';}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        int n = -1;
                        try {
                            n = Integer.parseInt(String.valueOf(value).replace("\"", "").trim());
                        } catch (Exception ignored) {
                        }
                        if (n > 0) {
                            return;
                        }
                        if (usingHttpServer) {
                            // 本地服务页面没渲染出来 → 试试 assets 拦截方案
                            usingHttpServer = false;
                            webView.loadUrl(LOCAL_INDEX);
                            scheduleReadinessCheck(6000);
                            return;
                        }
                        if (!localHtmlFallbackTried) {
                            localHtmlFallbackTried = true;
                            loadHtmlFallback();
                            scheduleReadinessCheck(5000);
                        } else {
                            showDiagnosticPage("页面脚本未渲染（root 为空）");
                        }
                    }
                });
    }

    private void loadHtmlFallback() {
        String html = readAssetText("site/index.html");
        if (html == null) {
            showDiagnosticPage("内置 assets 也无法读取（assets/site/index.html 不存在）");
            return;
        }
        webView.loadDataWithBaseURL(LOCAL_BASE, html, "text/html", "utf-8", null);
    }

    /* ------------------------------------------------------------------ */
    /*  assets fallback server (old scheme)                                */
    /* ------------------------------------------------------------------ */

    private boolean isLocalUrl(String url) {
        return url != null && (url.startsWith(LOCAL_BASE)
                || (serverPort > 0 && url.startsWith(localHttpBase())));
    }

    private InputStream openAsset(String assetPath) {
        try {
            return getAssets().open(assetPath);
        } catch (IOException e) {
            return null;
        }
    }

    private WebResourceResponse serveLocalAsset(String rawPath) {
        String path = rawPath == null ? "" : rawPath;
        if (path.isEmpty()) {
            path = "/index.html";
        }
        if (path.endsWith("/")) {
            path = path + "index.html";
        }
        if (path.indexOf("..") >= 0) {
            return plainResponse(403, "Forbidden", "text/plain", "403 Forbidden");
        }
        InputStream in = openAsset("site" + path);
        String resolved = path;
        if (in == null && !path.contains(".")) {
            in = openAsset("site/index.html");
            resolved = "/index.html";
        }
        if (in == null) {
            return plainResponse(404, "Not Found", "text/plain", "404 Not Found");
        }
        String mime = mimeOf(resolved);
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache, no-store, must-revalidate");
        headers.put("Access-Control-Allow-Origin", "*");
        String encoding = isTextual(mime) ? "utf-8" : null;
        return new WebResourceResponse(mime, encoding, 200, "OK", headers, in);
    }

    private WebResourceResponse plainResponse(int statusCode, String reason, String mime, String body) {
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache, no-store, must-revalidate");
        return new WebResourceResponse(mime, "utf-8", statusCode, reason, headers,
                new ByteArrayInputStream(body.getBytes()));
    }

    private static boolean isTextual(String mime) {
        return mime.startsWith("text/")
                || mime.equals("application/javascript")
                || mime.equals("application/json")
                || mime.equals("image/svg+xml");
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private String readAssetText(String assetPath) {
        InputStream in = openAsset(assetPath);
        if (in == null) {
            return null;
        }
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }
            return new String(out.toByteArray(), "UTF-8");
        } catch (IOException e) {
            return null;
        } finally {
            try {
                in.close();
            } catch (IOException ignored) {
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Page helpers: hide any Kimi branding + route external links         */
    /* ------------------------------------------------------------------ */

    private static final String PAGE_HELPERS_JS =
            "(function () {\n  if (window.__studyHelpersInstalled) {\n    r"
            + "eturn;\n  }\n  window.__studyHelpersInstalled = true;\n  try {\n"
            + "    var CSS = '.kimi-brand-container,.kimi-floating-button,."
            + "kimi-action-bar,' +\n      '.kimi-brand-close-icon,.kimi-bran"
            + "d-info-wrapper,[class*=\"kimi-brand\"],' +\n      '[class*=\"kim"
            + "i-floating\"],[class*=\"kimi-action-bar\"],' +\n      '[id*=\"kim"
            + "i-brand\"],[id*=\"kimi-floating\"]{display:none!important;' +\n "
            + "     'visibility:hidden!important;opacity:0!important;pointe"
            + "r-events:none!important}';\n\n    function hideKimi() {\n      "
            + "try {\n        var st = document.getElementById('__hide_kimi_"
            + "css');\n        if (!st) {\n          st = document.createElem"
            + "ent('style');\n          st.id = '__hide_kimi_css';\n         "
            + " st.textContent = CSS;\n          (document.head || document."
            + "documentElement).appendChild(st);\n        }\n        var node"
            + "s = document.querySelectorAll('.kimi-brand-container,.kimi-f"
            + "loating-button,.kimi-action-bar');\n        for (var i = node"
            + "s.length - 1; i >= 0; i--) {\n          nodes[i].remove();\n  "
            + "      }\n      } catch (e) {}\n    }\n\n    function openExterna"
            + "l(u) {\n      try {\n        if (window.AppBridge && typeof wi"
            + "ndow.AppBridge.openExternal === 'function') {\n          wind"
            + "ow.AppBridge.openExternal(String(u));\n          return true;"
            + "\n        }\n      } catch (e) {}\n      return false;\n    }\n\n "
            + "   window.open = function (u) {\n      if (u) {\n        openE"
            + "xternal(u);\n      }\n      return null;\n    };\n\n    document."
            + "addEventListener('click', function (ev) {\n      try {\n      "
            + "  var el = ev.target;\n        if (!el || !el.closest) {\n    "
            + "      return;\n        }\n        var a = el.closest('a[href]'"
            + ");\n        if (!a) {\n          return;\n        }\n        var"
            + " href = a.getAttribute('href') || '';\n        if (!href) {\n "
            + "         return;\n        }\n        var abs = new URL(href, l"
            + "ocation.href).href;\n        if (!/^https?:/i.test(abs)) {\n  "
            + "        return;\n        }\n        var h = new URL(abs).hostn"
            + "ame.toLowerCase();\n        if (h === 'appassets.local' || h "
            + "=== 'appassets.v2.local' || h === '127.0.0.1' || h === 'loca"
            + "lhost' || h === 'jchok.ok.kimi.link') {\n          return;\n  "
            + "      }\n        if (openExternal(abs)) {\n          ev.preven"
            + "tDefault();\n          ev.stopPropagation();\n        }\n      "
            + "} catch (e) {}\n    }, true);\n\n    hideKimi();\n    var hideSc"
            + "heduled = false;\n    function scheduleHide() {\n      if (hid"
            + "eScheduled) {\n        return;\n      }\n      hideScheduled = "
            + "true;\n      setTimeout(function () {\n        hideScheduled ="
            + " false;\n        hideKimi();\n      }, 300);\n    }\n    try {\n "
            + "     var o = new MutationObserver(scheduleHide);\n      o.obs"
            + "erve(document.body, { childList: true, subtree: true });\n   "
            + " } catch (e) {}\n    setTimeout(hideKimi, 600);\n    setTimeou"
            + "t(hideKimi, 2000);\n\n    // Hardware back key support (legacy"
            + " fallback).\n    // V2+ provides its own window.__appBack/__s"
            + "tudyBack (modal closers + router stack),\n    // so only inst"
            + "all this fallback when the app has not provided a handler.\n "
            + "   function findBackButton() {\n      var direct = document.q"
            + "uerySelector('[aria-label=\"返回\"],[aria-label=\"关闭\"],[aria-labe"
            + "l=\"Close\"],[aria-label=\"close\"]');\n      if (direct) {\n     "
            + "   var dr = direct.getBoundingClientRect();\n        if (dr.w"
            + "idth > 0 && dr.height > 0) {\n          return direct;\n      "
            + "  }\n      }\n      var candidates = document.querySelectorAll"
            + "('button, [role=\"button\"]');\n      for (var i = 0; i < candi"
            + "dates.length; i++) {\n        var b = candidates[i];\n        "
            + "if (!b || b.disabled) {\n          continue;\n        }\n      "
            + "  var r = b.getBoundingClientRect();\n        if (r.width <= "
            + "0 || r.height <= 0) {\n          continue;\n        }\n        "
            + "var t = (b.innerText || '').trim();\n        if (t === '‹' ||"
            + " t === '←' || t === '<' || t === '〈' || t === '《') {\n       "
            + "   return b;\n        }\n      }\n      return null;\n    }\n    "
            + "if (typeof window.__studyBack !== 'function') {\n      window"
            + ".__studyBack = function () {\n        try {\n          var b ="
            + " findBackButton();\n          if (b) {\n            b.click();"
            + "\n            return true;\n          }\n        } catch (e) {}"
            + "\n        return false;\n      };\n    }\n  } catch (e) {}\n})();"
            + "\n";

    private void injectPageHelpers(final WebView view) {
        if (view == null) {
            return;
        }
        view.evaluateJavascript(PAGE_HELPERS_JS, null);
    }

    /* ------------------------------------------------------------------ */
    /*  WebView client                                                     */
    /* ------------------------------------------------------------------ */

    private class AppClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null) {
                return null;
            }
            String host = uri.getHost();
            if (LOCAL_HOST.equalsIgnoreCase(host)) {
                return serveLocalAsset(uri.getPath());
            }
            if (host != null && (host.endsWith("kimi.com") || host.endsWith("kimi.ai"))) {
                String p = uri.getPath();
                if (p != null && (p.contains("sdk-seed") || p.contains("/sdk/"))) {
                    return new WebResourceResponse("application/javascript", "utf-8",
                            new ByteArrayInputStream(new byte[0]));
                }
            }
            return null;
        }

        private boolean handleUri(Uri uri) {
            if (uri == null) {
                return false;
            }
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            String host = uri.getHost();
            if (LOCAL_HOST.equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "localhost".equals(host)) {
                return false;
            }
            if ("http".equals(scheme) || "https".equals(scheme)) {
                openExternally(uri);
                return true;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUri(request.getUrl());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUri(Uri.parse(url));
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            if (url != null && isLocalUrl(url) && !localHtmlFallbackTried) {
                diagnosticShown = false;
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            injectPageHelpers(view);
            scheduleReadinessCheck(1800);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request == null || !request.isForMainFrame()) {
                return;
            }
            lastErrorInfo = "onReceivedError code=" + error.getErrorCode() + " " + error.getDescription();
            handleMainFrameFailure(lastErrorInfo);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request,
                                        WebResourceResponse errorResponse) {
            if (request == null || !request.isForMainFrame() || errorResponse == null) {
                return;
            }
            if (errorResponse.getStatusCode() >= 400) {
                lastErrorInfo = "onReceivedHttpError " + errorResponse.getStatusCode();
                handleMainFrameFailure(lastErrorInfo);
            }
        }
    }

    private void handleMainFrameFailure(String reason) {
        if (diagnosticShown) {
            return;
        }
        if (usingHttpServer) {
            usingHttpServer = false;
            webView.loadUrl(LOCAL_INDEX);
            scheduleReadinessCheck(6000);
            return;
        }
        if (!localHtmlFallbackTried) {
            localHtmlFallbackTried = true;
            loadHtmlFallback();
            scheduleReadinessCheck(5000);
            return;
        }
        showDiagnosticPage(reason);
    }

    /* ------------------------------------------------------------------ */
    /*  Diagnostics                                                        */
    /* ------------------------------------------------------------------ */

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private String chromeVersion() {
        try {
            String ua = webView.getSettings().getUserAgentString();
            Matcher m = Pattern.compile("Chrome/([0-9.]+)").matcher(ua == null ? "" : ua);
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception ignored) {
        }
        return "未知";
    }

    private String assetProbe() {
        StringBuilder sb = new StringBuilder();
        try {
            String[] list = getAssets().list("site");
            sb.append("assets/site 列表：").append(list == null ? "null" : (list.length + " 项"));
        } catch (Throwable t) {
            sb.append("assets 列表异常：").append(t);
        }
        return sb.toString();
    }

    private void showDiagnosticPage(String reason) {
        if (diagnosticShown) {
            return;
        }
        diagnosticShown = true;
        String indexText = readAssetText("site/index.html");
        int siteFiles = siteDir == null ? -1 : countFiles(siteDir);
        String info = "App 版本：" + appVersion
                + "\n运行模式：" + (usingHttpServer ? ("本地 HTTP 服务（端口 " + serverPort + "）") : "assets 拦截模式")
                + "\n当前 URL：" + (webView == null ? "" : webView.getUrl())
                + "\n失败原因：" + reason
                + "\n详细错误：" + lastErrorInfo
                + "\n本地解压目录：" + (siteDir == null ? "未初始化" : siteDir.getAbsolutePath())
                + "\n本地文件数：" + (siteFiles < 0 ? "未统计" : String.valueOf(siteFiles))
                + "\n启动日志：" + prepareLog.replace("\n", " | ")
                + "\nassets index.html 读取：" + (indexText == null ? "失败" : ("成功，" + indexText.length() + " 字符"))
                + "\n" + assetProbe()
                + "\nAndroid：" + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")"
                + "\nWebView Chrome 版本：" + chromeVersion()
                + "\nUser-Agent：" + (webView == null ? "" : webView.getSettings().getUserAgentString());
        String html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>"
                + "<style>body{margin:0;padding:22px;background:#080a0e;color:#f2efe8;"
                + "font-family:sans-serif;line-height:1.7}h1{font-size:19px;color:#e3c078;margin:0 0 8px}"
                + "p{font-size:12px;color:#9aa7b8;margin:0 0 12px}"
                + "textarea{width:100%;height:300px;box-sizing:border-box;background:#111721;color:#d8d2c5;"
                + "border:1px solid #222d3b;border-radius:10px;padding:10px;font-size:11px;font-family:monospace}"
                + "button{margin-top:14px;padding:10px 20px;border-radius:10px;border:1px solid #c9a25f;"
                + "background:transparent;color:#e3c078;font-size:14px;margin-right:8px}</style></head><body>"
                + "<h1>本地界面加载失败（诊断页）</h1>"
                + "<p>请把下面的信息截图发给开发者。当前版本不会跳转任何在线网页。</p>"
                + "<textarea readonly>" + esc(info) + "</textarea><br/>"
                + "<button onclick=\"location.reload()\">重新加载</button>"
                + "<button onclick=\"window.AppBridge&&window.AppBridge.restartApp()\">重启应用</button>"
                + "</body></html>";
        if (webView != null) {
            webView.loadDataWithBaseURL(LOCAL_BASE, html, "text/html", "utf-8", null);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  JS bridge                                                          */
    /* ------------------------------------------------------------------ */

    private class AppBridge {
        @JavascriptInterface
        public void openExternal(final String url) {
            if (url == null || webView == null || !isLocalUrl(webView.getUrl())) {
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    openExternally(Uri.parse(url));
                }
            });
        }

        @JavascriptInterface
        public void saveAndShareImage(final String dataUrl, final String filename) {
            if (dataUrl == null || webView == null || !isLocalUrl(webView.getUrl())) {
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        doSaveAndShare(dataUrl, filename);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "分享图生成失败", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void restartApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent(MainActivity.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                }
            });
        }

        /**
         * AI 问答转发：页面把 OpenAI 兼容请求（含 Key）交给原生层直连，绕开 WebView 的 CORS 限制。
         * 结果通过 window.__aiReply(id, ok, payload) 回传（payload 为接口原始 JSON 字符串）。
         */
        @JavascriptInterface
        public void aiChat(final String requestId, final String endpoint, final String apiKey, final String body) {
            final WebView wv = webView;
            if (wv == null) {
                return;
            }
            if (!isLocalUrl(wv.getUrl())) {
                return;
            }
            final String url = endpoint == null ? "" : endpoint.trim();
            if (!(url.startsWith("https://") || url.startsWith("http://"))) {
                aiReply(requestId, false, "接口地址必须以 http(s):// 开头");
                return;
            }
            new Thread(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection conn = null;
                    try {
                        URL u = new URL(url);
                        conn = (HttpURLConnection) u.openConnection();
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(90000);
                        conn.setRequestMethod("POST");
                        conn.setDoOutput(true);
                        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                        conn.setRequestProperty("Accept", "application/json");
                        if (apiKey != null && !apiKey.trim().isEmpty()) {
                            conn.setRequestProperty("Authorization", "Bearer " + apiKey.trim());
                        }
                        byte[] payload = (body == null ? "{}" : body).getBytes("UTF-8");
                        conn.setFixedLengthStreamingMode(payload.length);
                        OutputStream os = conn.getOutputStream();
                        try {
                            os.write(payload);
                        } finally {
                            os.close();
                        }
                        int code = conn.getResponseCode();
                        String text = readStreamText(code >= 400 ? conn.getErrorStream() : conn.getInputStream());
                        if (code >= 400) {
                            aiReply(requestId, false, "接口返回 HTTP " + code + (text.isEmpty() ? "" : "：" + trimText(text, 240)));
                        } else {
                            aiReply(requestId, true, text);
                        }
                    } catch (Throwable t) {
                        String msg = t.getClass().getSimpleName();
                        if (t.getMessage() != null && !t.getMessage().isEmpty()) {
                            msg = msg + " " + t.getMessage();
                        }
                        aiReply(requestId, false, "网络请求失败：" + msg);
                    } finally {
                        if (conn != null) {
                            conn.disconnect();
                        }
                    }
                }
            }, "wzjs-ai").start();
        }

        /**
         * BP 语音输入：开始一次识别。结果通过 window.__voiceEvent(id, type, payload) 回传。
         * type: ready / start / partial / final / end / rms / error。
         */
        @JavascriptInterface
        public void voiceStart(final String requestId) {
            final WebView wv = webView;
            if (requestId == null || requestId.isEmpty() || wv == null || !isLocalUrl(wv.getUrl())) {
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    beginVoice(requestId);
                }
            });
        }

        /** 松手后请求收尾，等待系统给出 final；不会立刻关闭麦克风。 */
        @JavascriptInterface
        public void voiceStop(final String requestId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!speechListening) {
                        return;
                    }
                    if (requestId != null && speechRequestId != null && !requestId.equals(speechRequestId)) {
                        return;
                    }
                    try {
                        if (speechRecognizer != null) {
                            speechRecognizer.stopListening();
                        }
                    } catch (Throwable ignored) {
                    }
                }
            });
        }

        /** 取消（页面关闭、切走、用户点“取消”）。 */
        @JavascriptInterface
        public void voiceCancel(final String requestId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (requestId != null && speechRequestId != null
                            && !requestId.equals(speechRequestId)
                            && !requestId.equals(pendingVoiceRequestId)) {
                        return;
                    }
                    cancelVoiceInternal(true);
                }
            });
        }
    }

    private void aiReply(final String requestId, final boolean ok, final String payload) {
        final WebView wv = webView;
        if (wv == null) {
            return;
        }
        final String js = "window.__aiReply&&window.__aiReply("
                + JSONObject.quote(requestId)
                + "," + (ok ? "true" : "false")
                + "," + JSONObject.quote(payload == null ? "" : payload) + ");";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /*  语音输入（系统 SpeechRecognizer）                                   */
    /* ------------------------------------------------------------------ */

    private void beginVoice(final String requestId) {
        if (speechListening) {
            voiceEvent(requestId, "error", voiceErrorJson("busy", "正在识别中，请稍候"));
            return;
        }
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingVoiceRequestId = requestId;
            pendingVoiceCancelled = false;
            try {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_RECORD_AUDIO);
            } catch (Throwable t) {
                pendingVoiceRequestId = null;
                voiceEvent(requestId, "error", voiceErrorJson("permission", "无法申请麦克风权限"));
            }
            return;
        }
        startVoice(requestId);
    }

    private void startVoice(final String requestId) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            voiceEvent(requestId, "error", voiceErrorJson("unavailable",
                    "系统没有可用的语音识别服务，请先用键盘输入"));
            return;
        }
        releaseSpeechRecognizer();
        try {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            if (speechRecognizer == null) {
                voiceEvent(requestId, "error", voiceErrorJson("unavailable", "语音识别初始化失败"));
                return;
            }
            speechRecognizer.setRecognitionListener(new VoiceListener());

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "zh-CN");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "说英雄名，如：对面 ban 东皇太一、张良");
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
            // 让系统尽快收尾（服务可能忽略这些提示）
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1100L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1100L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 500L);

            speechRequestId = requestId;
            speechListening = true;
            lastRmsEventAt = 0L;
            speechRecognizer.startListening(intent);
        } catch (Throwable t) {
            resetSpeechState();
            releaseSpeechRecognizer();
            String msg = t.getMessage();
            voiceEvent(requestId, "error", voiceErrorJson("start_failed",
                    "麦克风启动失败" + (msg == null || msg.isEmpty() ? "" : "：" + msg)));
        }
    }

    private void cancelVoiceInternal(boolean notify) {
        String id = speechRequestId;
        boolean wasListening = speechListening;
        if (speechRecognizer != null) {
            try {
                speechRecognizer.cancel();
            } catch (Throwable ignored) {
            }
        }
        releaseSpeechRecognizer();
        resetSpeechState();
        if (pendingVoiceRequestId != null) {
            pendingVoiceCancelled = true;
            pendingVoiceRequestId = null;
        }
        if (notify && wasListening && id != null) {
            voiceEvent(id, "error", voiceErrorJson("cancelled", "已取消语音输入"));
        }
    }

    private void resetSpeechState() {
        speechListening = false;
        speechRequestId = null;
        lastRmsEventAt = 0L;
    }

    private void releaseSpeechRecognizer() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Throwable ignored) {
            }
            speechRecognizer = null;
        }
    }

    private void voiceEvent(final String requestId, final String type, final String payload) {
        if (requestId == null || requestId.isEmpty()) {
            return;
        }
        final WebView wv = webView;
        if (wv == null) {
            return;
        }
        final String js = "window.__voiceEvent&&window.__voiceEvent("
                + JSONObject.quote(requestId)
                + "," + JSONObject.quote(type)
                + "," + JSONObject.quote(payload == null ? "{}" : payload) + ");";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    webView.evaluateJavascript(js, null);
                }
            }
        });
    }

    private static String voiceResultsJson(Bundle results) {
        try {
            JSONArray arr = new JSONArray();
            ArrayList<String> texts = results == null
                    ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            float[] conf = results == null
                    ? null : results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
            if (texts != null) {
                for (int i = 0; i < texts.size(); i++) {
                    String t = texts.get(i);
                    if (t == null || t.trim().isEmpty()) {
                        continue;
                    }
                    JSONObject item = new JSONObject();
                    item.put("text", t);
                    if (conf != null && i < conf.length && conf[i] >= 0f) {
                        item.put("confidence", (double) conf[i]);
                    }
                    arr.put(item);
                }
            }
            JSONObject root = new JSONObject();
            root.put("results", arr);
            return root.toString();
        } catch (Throwable t) {
            return "{\"results\":[]}";
        }
    }

    private static String voiceErrorJson(String code, String message) {
        try {
            JSONObject o = new JSONObject();
            o.put("code", code == null ? "error" : code);
            o.put("message", message == null ? "语音识别失败" : message);
            return o.toString();
        } catch (Throwable t) {
            return "{\"code\":\"error\",\"message\":\"语音识别失败\"}";
        }
    }

    private static String voiceErrorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "录音出错，请检查麦克风";
            case SpeechRecognizer.ERROR_CLIENT:
                return "识别客户端出错，请重试";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "没有麦克风权限";
            case SpeechRecognizer.ERROR_NETWORK:
                return "语音服务网络异常";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "语音服务超时";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "没听清，再说一次";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "识别器忙，请稍后再试";
            case SpeechRecognizer.ERROR_SERVER:
                return "语音服务出错";
            case SpeechRecognizer.ERROR_SERVER_DISCONNECTED:
                return "语音服务断开";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "没有听到声音";
            case SpeechRecognizer.ERROR_TOO_MANY_REQUESTS:
                return "请求太频繁，稍后再试";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
                return "系统不支持中文语音识别";
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE:
                return "中文语音识别不可用";
            default:
                return "语音识别失败（" + error + "）";
        }
    }

    private class VoiceListener implements RecognitionListener {
        @Override
        public void onReadyForSpeech(Bundle params) {
            if (speechRequestId != null) {
                voiceEvent(speechRequestId, "ready", "{}");
            }
        }

        @Override
        public void onBeginningOfSpeech() {
            if (speechRequestId != null) {
                voiceEvent(speechRequestId, "start", "{}");
            }
        }

        @Override
        public void onRmsChanged(float rmsdB) {
            String id = speechRequestId;
            if (id == null) {
                return;
            }
            long now = System.currentTimeMillis();
            if (now - lastRmsEventAt < 90L) {
                return;
            }
            lastRmsEventAt = now;
            int level = (int) Math.max(0, Math.min(10, (rmsdB + 2f) / 12f * 10f));
            try {
                JSONObject o = new JSONObject();
                o.put("rms", level);
                voiceEvent(id, "rms", o.toString());
            } catch (Throwable ignored) {
            }
        }

        @Override
        public void onBufferReceived(byte[] buffer) {
        }

        @Override
        public void onEndOfSpeech() {
            if (speechRequestId != null) {
                voiceEvent(speechRequestId, "end", "{}");
            }
        }

        @Override
        public void onError(int error) {
            String id = speechRequestId;
            resetSpeechState();
            releaseSpeechRecognizer();
            if (id != null) {
                voiceEvent(id, "error", voiceErrorJson(
                        error == SpeechRecognizer.ERROR_NO_MATCH ? "no_match" : "asr_error",
                        voiceErrorMessage(error)));
            }
        }

        @Override
        public void onResults(Bundle results) {
            String id = speechRequestId;
            resetSpeechState();
            if (id != null) {
                voiceEvent(id, "final", voiceResultsJson(results));
            }
        }

        @Override
        public void onPartialResults(Bundle partialResults) {
            String id = speechRequestId;
            if (id != null) {
                voiceEvent(id, "partial", voiceResultsJson(partialResults));
            }
        }

        @Override
        public void onEvent(int eventType, Bundle params) {
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_RECORD_AUDIO) {
            return;
        }
        String id = pendingVoiceRequestId;
        boolean cancelled = pendingVoiceCancelled;
        pendingVoiceRequestId = null;
        pendingVoiceCancelled = false;
        if (id == null || cancelled) {
            return;
        }
        boolean granted = grantResults != null && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (granted) {
            startVoice(id);
        } else {
            voiceEvent(id, "error", voiceErrorJson("permission",
                    "需要麦克风权限才能语音输入，可在系统设置里开启"));
        }
    }

    private static String readStreamText(InputStream is) throws IOException {
        if (is == null) {
            return "";
        }
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) {
                bos.write(buf, 0, n);
            }
        } finally {
            is.close();
        }
        return new String(bos.toByteArray(), "UTF-8");
    }

    private static String trimText(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private void doSaveAndShare(String dataUrl, String filename) throws IOException {
        final String pngPrefix = "data:image/png;base64,";
        if (dataUrl == null || !dataUrl.startsWith(pngPrefix)) {
            throw new IOException("unsupported image format");
        }
        if (dataUrl.length() > 16000000) {
            throw new IOException("image too large");
        }
        byte[] bytes = Base64.decode(dataUrl.substring(pngPrefix.length()), Base64.DEFAULT);
        File dir = new File(getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("cannot create cache dir");
        }
        String safeName = (filename == null ? "share.png" : filename).replaceAll("[^A-Za-z0-9._-]", "_");
        if (!safeName.toLowerCase().endsWith(".png")) {
            safeName = safeName + ".png";
        }
        File file = new File(dir, safeName);
        FileOutputStream out = new FileOutputStream(file);
        try {
            out.write(bytes);
        } finally {
            out.close();
        }
        cleanupShareDir(dir, file);
        Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/share/" + file.getName());
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("image/png");
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, "分享战绩图");
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(chooser);
    }

    private void cleanupShareDir(final File dir, final File keep) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        java.util.Arrays.sort(files, new java.util.Comparator<File>() {
            @Override
            public int compare(File a, File b) {
                return Long.compare(b.lastModified(), a.lastModified());
            }
        });
        long now = System.currentTimeMillis();
        for (int i = 0; i < files.length; i++) {
            File f = files[i];
            if (f == null || f.equals(keep)) {
                continue;
            }
            boolean tooOld = now - f.lastModified() > 7L * 24L * 3600L * 1000L;
            if (i >= 20 || tooOld) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    private void openExternally(Uri uri) {
        if (uri == null) {
            return;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "未找到可打开该链接的应用", Toast.LENGTH_SHORT).show();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Back / cleanup                                                     */
    /* ------------------------------------------------------------------ */

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{var f=window.__appBack||window.__studyBack;return !!(f&&f());}catch(e){return false;}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) {
                            return;
                        }
                        handleDoubleBackExit();
                    }
                });
    }

    private void handleDoubleBackExit() {
        long now = System.currentTimeMillis();
        if (now - lastBackPress < DOUBLE_BACK_MS) {
            finish();
        } else {
            lastBackPress = now;
            Toast.makeText(this, "再按一次退出", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (speechListening && pendingVoiceRequestId == null) {
            cancelVoiceInternal(true);
        }
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (speechListening || speechRecognizer != null) {
            cancelVoiceInternal(false);
        }
        pendingVoiceRequestId = null;
        pendingVoiceCancelled = true;
        try {
            if (serverSocket != null) {
                serverSocket.close();
            }
            if (serverPool != null) {
                serverPool.shutdownNow();
            }
        } catch (Exception ignored) {
        }
        if (webView != null) {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
            }
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
