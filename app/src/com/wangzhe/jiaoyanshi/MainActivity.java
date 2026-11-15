package com.wangzhe.jiaoyanshi;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.media.AudioRecord;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.util.Log;
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
import com.k2fsa.sherpa.onnx.FeatureConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
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
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Iterator;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/* loaded from: classes.dex */
public class MainActivity extends Activity {
    private static final int APP_BG = -16250354;
    private static final String[] ASR_MODEL_FILES = {"encoder.int8.onnx", "decoder.onnx", "joiner.int8.onnx", "tokens.txt"};
    private static final int[] ASR_MODEL_RAWS = {R.raw.asr_encoder, R.raw.asr_decoder, R.raw.asr_joiner, R.raw.asr_tokens};
    private static final String ASR_MODEL_TAG = "zh-2025-06-30-v1";
    private static final String ASR_HOTWORDS_FILE = "hotwords.txt";
    private static final int ASR_HOTWORDS_RAW = R.raw.asr_hotwords;
    private static final float ASR_HOTWORDS_SCORE = 2.0f;
    private static final long DOUBLE_BACK_MS = 2200;
    private static final int HTTP_PORT_START = 17653;
    private static final int HTTP_PORT_TRIES = 12;
    private static final String LOCAL_BASE = "https://appassets.v2.local/";
    private static final String LOCAL_HOST = "appassets.v2.local";
    private static final String LOCAL_INDEX = "https://appassets.v2.local/index.html";
    private static final String LOG_TAG = "WZJS";
    private static final String PAGE_HELPERS_JS = "(function () {\n  if (window.__studyHelpersInstalled) {\n    return;\n  }\n  window.__studyHelpersInstalled = true;\n  try {\n    var CSS = '.kimi-brand-container,.kimi-floating-button,.kimi-action-bar,' +\n      '.kimi-brand-close-icon,.kimi-brand-info-wrapper,[class*=\"kimi-brand\"],' +\n      '[class*=\"kimi-floating\"],[class*=\"kimi-action-bar\"],' +\n      '[id*=\"kimi-brand\"],[id*=\"kimi-floating\"]{display:none!important;' +\n      'visibility:hidden!important;opacity:0!important;pointer-events:none!important}';\n\n    function hideKimi() {\n      try {\n        var st = document.getElementById('__hide_kimi_css');\n        if (!st) {\n          st = document.createElement('style');\n          st.id = '__hide_kimi_css';\n          st.textContent = CSS;\n          (document.head || document.documentElement).appendChild(st);\n        }\n        var nodes = document.querySelectorAll('.kimi-brand-container,.kimi-floating-button,.kimi-action-bar');\n        for (var i = nodes.length - 1; i >= 0; i--) {\n          nodes[i].remove();\n        }\n      } catch (e) {}\n    }\n\n    function openExternal(u) {\n      try {\n        if (window.AppBridge && typeof window.AppBridge.openExternal === 'function') {\n          window.AppBridge.openExternal(String(u));\n          return true;\n        }\n      } catch (e) {}\n      return false;\n    }\n\n    window.open = function (u) {\n      if (u) {\n        openExternal(u);\n      }\n      return null;\n    };\n\n    document.addEventListener('click', function (ev) {\n      try {\n        var el = ev.target;\n        if (!el || !el.closest) {\n          return;\n        }\n        var a = el.closest('a[href]');\n        if (!a) {\n          return;\n        }\n        var href = a.getAttribute('href') || '';\n        if (!href) {\n          return;\n        }\n        var abs = new URL(href, location.href).href;\n        if (!/^https?:/i.test(abs)) {\n          return;\n        }\n        var h = new URL(abs).hostname.toLowerCase();\n        if (h === 'appassets.local' || h === 'appassets.v2.local' || h === '127.0.0.1' || h === 'localhost' || h === 'jchok.ok.kimi.link') {\n          return;\n        }\n        if (openExternal(abs)) {\n          ev.preventDefault();\n          ev.stopPropagation();\n        }\n      } catch (e) {}\n    }, true);\n\n    hideKimi();\n    var hideScheduled = false;\n    function scheduleHide() {\n      if (hideScheduled) {\n        return;\n      }\n      hideScheduled = true;\n      setTimeout(function () {\n        hideScheduled = false;\n        hideKimi();\n      }, 300);\n    }\n    try {\n      var o = new MutationObserver(scheduleHide);\n      o.observe(document.body, { childList: true, subtree: true });\n    } catch (e) {}\n    setTimeout(hideKimi, 600);\n    setTimeout(hideKimi, 2000);\n\n    // Hardware back key support (legacy fallback).\n    // V2+ provides its own window.__appBack/__studyBack (modal closers + router stack),\n    // so only install this fallback when the app has not provided a handler.\n    function findBackButton() {\n      var direct = document.querySelector('[aria-label=\"返回\"],[aria-label=\"关闭\"],[aria-label=\"Close\"],[aria-label=\"close\"]');\n      if (direct) {\n        var dr = direct.getBoundingClientRect();\n        if (dr.width > 0 && dr.height > 0) {\n          return direct;\n        }\n      }\n      var candidates = document.querySelectorAll('button, [role=\"button\"]');\n      for (var i = 0; i < candidates.length; i++) {\n        var b = candidates[i];\n        if (!b || b.disabled) {\n          continue;\n        }\n        var r = b.getBoundingClientRect();\n        if (r.width <= 0 || r.height <= 0) {\n          continue;\n        }\n        var t = (b.innerText || '').trim();\n        if (t === '‹' || t === '←' || t === '<' || t === '〈' || t === '《') {\n          return b;\n        }\n      }\n      return null;\n    }\n    if (typeof window.__studyBack !== 'function') {\n      window.__studyBack = function () {\n        try {\n          var b = findBackButton();\n          if (b) {\n            b.click();\n            return true;\n          }\n        } catch (e) {}\n        return false;\n      };\n    }\n  } catch (e) {}\n})();\n";
    private static final int REQ_ASR_AUDIO = 7103;
    private static final int REQ_RECORD_AUDIO = 7101;
    private static final int REQ_SYSTEM_SPEECH = 7102;
    private ExecutorService serverPool;
    private ServerSocket serverSocket;
    private File siteDir;
    private SpeechRecognizer speechRecognizer;
    private WebView webView;
    private String appVersion = "2.4.9";
    private String systemVoiceRequestId = null;
    private boolean speechListening = false;
    private String speechRequestId = null;
    private String pendingVoiceRequestId = null;
    private boolean pendingVoiceCancelled = false;
    private long lastRmsEventAt = 0;
    private Bundle lastPartialResults = null;
    private boolean voiceStopPending = false;
    private volatile OnlineRecognizer asrRecognizer = null;
    private volatile OnlineStream asrStream = null;
    private volatile AudioRecord asrRecord = null;
    private volatile Thread asrThread = null;
    private volatile boolean asrRunning = false;
    private volatile boolean asrCancelled = false;
    private volatile String asrRequestId = null;
    private String pendingAsrRequestId = null;
    private boolean pendingAsrCancelled = false;
    private volatile OnlineRecognizer asrWarmRecognizer = null;
    private volatile boolean asrWarming = false;
    private volatile boolean asrStopRequested = false;
    private volatile int serverPort = 0;
    private volatile boolean usingHttpServer = false;
    private String prepareLog = "";
    private boolean localHtmlFallbackTried = false;
    private boolean diagnosticShown = false;
    private boolean readinessScheduled = false;
    private String lastErrorInfo = "";
    private long lastBackPress = 0;
    private long lastAsrRmsAt = 0;

    @Override // android.app.Activity
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        try {
            this.appVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception unused) {
        }
        setupSystemBars();
        FrameLayout frameLayout = new FrameLayout(this);
        frameLayout.setBackgroundColor(APP_BG);
        WebView webView = new WebView(this);
        this.webView = webView;
        webView.setBackgroundColor(APP_BG);
        this.webView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        configureWebView();
        frameLayout.addView(this.webView);
        setContentView(frameLayout);
        Toast.makeText(this, "王者教研室 V" + this.appVersion + " · 纯本地版", 0).show();
        if (isWebViewTooOld()) {
            showWebViewTooOldPage(this.webView);
        } else {
            prepareAndServe();
        }
    }

    private void prewarmAsr() {
        if (this.asrWarming || this.asrWarmRecognizer != null || this.asrRecognizer != null) {
            return;
        }
        this.asrWarming = true;
        new Thread(new Runnable() {
            @Override // java.lang.Runnable
            public void run() {
                OnlineRecognizer recognizer = null;
                try {
                    recognizer = createAsrRecognizer(MainActivity.this.ensureAsrModelDir());
                    synchronized (MainActivity.this) {
                        if (MainActivity.this.asrRecognizer == null) {
                            MainActivity.this.asrWarmRecognizer = recognizer;
                            recognizer = null;
                        }
                    }
                } catch (Throwable th) {
                    Log.e(LOG_TAG, "prewarmAsr failed: " + describeThrowable(th));
                } finally {
                    MainActivity.this.asrWarming = false;
                    if (recognizer != null) {
                        try {
                            recognizer.release();
                        } catch (Throwable unused) {
                        }
                    }
                }
            }
        }, "wzjs-asr-warm").start();
    }

    private synchronized OnlineRecognizer takePrewarmedAsr() {
        OnlineRecognizer recognizer = this.asrWarmRecognizer;
        this.asrWarmRecognizer = null;
        return recognizer;
    }

    private void setupSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(APP_BG);
        window.setNavigationBarColor(APP_BG);
        window.getDecorView().setSystemUiVisibility(256);
    }

    private void configureWebView() {
        WebSettings settings = this.webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setCacheMode(2);
        settings.setTextZoom(100);
        settings.setMixedContentMode(1);
        if (Build.VERSION.SDK_INT >= 26) {
            settings.setSafeBrowsingEnabled(false);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            settings.setForceDark(0);
        }
        this.webView.setVerticalScrollBarEnabled(false);
        this.webView.setHorizontalScrollBarEnabled(false);
        this.webView.setOverScrollMode(2);
        this.webView.setBackgroundColor(APP_BG);
        WebView.setWebContentsDebuggingEnabled(false);
        this.webView.addJavascriptInterface(new AppBridge(), "AppBridge");
        this.webView.setWebViewClient(new AppClient());
        this.webView.setWebChromeClient(new WebChromeClient());
    }

    private boolean isWebViewTooOld() {
        try {
            String userAgentString = this.webView.getSettings().getUserAgentString();
            if (userAgentString == null) {
                return false;
            }
            Matcher matcher = Pattern.compile("Chrome/(\\d+)").matcher(userAgentString);
            if (matcher.find()) {
                return Integer.parseInt(matcher.group(1)) < 111;
            }
            return false;
        } catch (Exception unused) {
            return false;
        }
    }

    private void showWebViewTooOldPage(WebView webView) {
        webView.loadDataWithBaseURL(LOCAL_BASE, "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><style>html,body{margin:0;height:100%;background:#080a0e;color:#f2efe8;font-family:sans-serif;display:flex;align-items:center;justify-content:center}div{text-align:center;padding:26px;max-width:420px}h1{font-size:20px;color:#e3c078}p{color:#9aa7b8;font-size:13px;line-height:1.9;text-align:left}</style></head><body><div><h1>系统 WebView 版本过低</h1><p>本应用内置的网页需要较新的系统 WebView（Chromium 111+）才能运行。<br/><br/>请到手机自带的应用商店搜索并更新「<b>Android System WebView</b>」（或「<b>Chrome</b>」「系统浏览器」），更新后重新打开本应用即可。</p></div></body></html>", "text/html", "utf-8", null);
    }

    private void prepareAndServe() {
        new Thread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.1
            @Override // java.lang.Runnable
            public void run() {
                final StringBuilder sb = new StringBuilder();
                try {
                    MainActivity.this.siteDir = new File(MainActivity.this.getFilesDir(), "site");
                    MainActivity mainActivity = MainActivity.this;
                    int extractSiteZip = mainActivity.extractSiteZip(mainActivity.siteDir, sb);
                    sb.append("内置资源解压成功：");
                    sb.append(extractSiteZip);
                    sb.append(" 个文件\n");
                    if (!new File(MainActivity.this.siteDir, "index.html").isFile()) {
                        throw new IOException("解压后缺少 index.html");
                    }
                    MainActivity mainActivity2 = MainActivity.this;
                    final int startHttpServer = mainActivity2.startHttpServer(mainActivity2.siteDir);
                    MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.1.1
                        @Override // java.lang.Runnable
                        public void run() {
                            MainActivity.this.loadLocalServer(startHttpServer);
                        }
                    });
                } catch (Throwable th) {
                    sb.append("本地服务启动失败：");
                    sb.append(th.getClass().getSimpleName());
                    sb.append(": ");
                    sb.append(th.getMessage());
                    sb.append("\n");
                    MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.1.2
                        @Override // java.lang.Runnable
                        public void run() {
                            MainActivity.this.fallbackToAssets(sb.toString());
                        }
                    });
                }
            }
        }, "wzjs-site").start();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public int extractSiteZip(File file, StringBuilder sb) throws IOException {
        SharedPreferences sharedPreferences = getSharedPreferences("wzjs_site", 0);
        File file2 = new File(file, "index.html");
        if (sharedPreferences.getString("version", "").equals(this.appVersion) && file2.isFile()) {
            return countFiles(file);
        }
        deleteRecursive(file);
        if (!file.mkdirs() && !file.isDirectory()) {
            throw new IOException("无法创建目录 " + file);
        }
        try {
            ZipInputStream zipInputStream = new ZipInputStream(new BufferedInputStream(getResources().openRawResource(R.raw.site)));
            try {
                byte[] bArr = new byte[8192];
                int i = 0;
                while (true) {
                    ZipEntry nextEntry = zipInputStream.getNextEntry();
                    if (nextEntry != null) {
                        String replace = nextEntry.getName().replace('\\', '/');
                        if (!replace.startsWith("/") && !replace.contains("..")) {
                            File file3 = new File(file, replace);
                            if (nextEntry.isDirectory()) {
                                file3.mkdirs();
                            } else {
                                File parentFile = file3.getParentFile();
                                if (parentFile != null && !parentFile.isDirectory()) {
                                    parentFile.mkdirs();
                                }
                                FileOutputStream fileOutputStream = new FileOutputStream(file3);
                                while (true) {
                                    try {
                                        int read = zipInputStream.read(bArr);
                                        if (read <= 0) {
                                            break;
                                        }
                                        fileOutputStream.write(bArr, 0, read);
                                    } finally {
                                    }
                                }
                                fileOutputStream.close();
                                i++;
                            }
                        }
                    } else {
                        zipInputStream.close();
                        sharedPreferences.edit().putString("version", this.appVersion).apply();
                        return i;
                    }
                }
            } catch (Throwable th) {
                zipInputStream.close();
                throw th;
            }
        } catch (Throwable th2) {
            sb.append("读取 res/raw/site.zip 失败：");
            sb.append(th2);
            sb.append("\n");
            throw new IOException("无法读取内置压缩包: " + th2.getMessage());
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void loadLocalServer(int i) {
        this.serverPort = i;
        this.usingHttpServer = true;
        try {
            this.webView.clearCache(true);
        } catch (Exception unused) {
        }
        this.webView.loadUrl(localHttpBase() + "index.html");
        scheduleReadinessCheck(9000L);
    }

    private String localHttpBase() {
        return "http://127.0.0.1:" + this.serverPort + "/";
    }

    /* JADX INFO: Access modifiers changed from: private */
    public int startHttpServer(final File file) throws IOException {
        ServerSocket serverSocket = null;
        IOException e = null;
        int i = 0;
        while (true) {
            if (i >= HTTP_PORT_TRIES) {
                break;
            }
            try {
                ServerSocket serverSocket2 = new ServerSocket();
                serverSocket2.setReuseAddress(true);
                serverSocket2.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), i + HTTP_PORT_START), 50);
                serverSocket = serverSocket2;
                break;
            } catch (IOException e2) {
                e = e2;
                i++;
            }
        }
        if (serverSocket == null) {
            serverSocket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
            this.prepareLog += "固定端口不可用，已用随机端口：" + e + "\n";
        }
        this.serverSocket = serverSocket;
        this.serverPool = Executors.newFixedThreadPool(4);
        Thread thread = new Thread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.2
            @Override // java.lang.Runnable
            public void run() {
                while (true) {
                    try {
                        final Socket accept = MainActivity.this.serverSocket.accept();
                        MainActivity.this.serverPool.submit(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.2.1
                            @Override // java.lang.Runnable
                            public void run() {
                                MainActivity.this.handleHttp(accept, file);
                            }
                        });
                    } catch (IOException unused) {
                        return;
                    }
                }
            }
        }, "wzjs-http");
        thread.setDaemon(true);
        thread.start();
        return serverSocket.getLocalPort();
    }

    /* JADX INFO: Access modifiers changed from: private */
    private void handleHttp(Socket socket, File file) {
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
            File targetFile = new File(file, path);
            if (!targetFile.isFile() && !path.contains(".")) {
                targetFile = new File(file, "index.html"); // SPA fallback
            }
            if (!targetFile.isFile()) {
                writeSimple(socket, 404, "Not Found");
                return;
            }
            byte[] data = readFully(targetFile);
            String head = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: " + mimeOf(targetFile.getName()) + "\r\n"
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

    private void writeSimple(Socket socket, int i, String str) {
        try {
            byte[] bytes = str.getBytes("UTF-8");
            String str2 = "HTTP/1.1 " + i + " " + (i == 404 ? "Not Found" : i == 403 ? "Forbidden" : "Bad Request") + "\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: " + bytes.length + "\r\nConnection: close\r\n\r\n";
            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(str2.getBytes("US-ASCII"));
            outputStream.write(bytes);
            outputStream.flush();
        } catch (Exception unused) {
        }
    }

    private static byte[] readFully(File file) throws IOException {
        FileInputStream fileInputStream = new FileInputStream(file);
        try {
            int length = (int) file.length();
            byte[] bArr = new byte[length];
            int i = 0;
            while (i < length) {
                int read = fileInputStream.read(bArr, i, length - i);
                if (read <= 0) {
                    break;
                }
                i += read;
            }
            return bArr;
        } finally {
            fileInputStream.close();
        }
    }

    private static void deleteRecursive(File file) {
        File[] listFiles;
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory() && (listFiles = file.listFiles()) != null) {
            for (File file2 : listFiles) {
                deleteRecursive(file2);
            }
        }
        file.delete();
    }

    private static int countFiles(File file) {
        File[] listFiles = file.listFiles();
        if (listFiles == null) {
            return 0;
        }
        int i = 0;
        for (File file2 : listFiles) {
            i += file2.isDirectory() ? countFiles(file2) : 1;
        }
        return i;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void fallbackToAssets(String str) {
        if (this.diagnosticShown) {
            return;
        }
        this.prepareLog = str;
        this.usingHttpServer = false;
        try {
            this.webView.clearCache(true);
        } catch (Exception unused) {
        }
        this.webView.loadUrl(LOCAL_INDEX);
        scheduleReadinessCheck(9000L);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void scheduleReadinessCheck(long j) {
        if (this.readinessScheduled) {
            return;
        }
        this.readinessScheduled = true;
        this.webView.postDelayed(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.3
            @Override // java.lang.Runnable
            public void run() {
                MainActivity.this.readinessScheduled = false;
                MainActivity.this.checkRenderedOrFallback();
            }
        }, j);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void checkRenderedOrFallback() {
        WebView webView = this.webView;
        if (webView == null || this.diagnosticShown) {
            return;
        }
        webView.evaluateJavascript("(function(){try{var r=document.getElementById('root');return String(r?r.childElementCount:0);}catch(e){return '-1';}})()", new ValueCallback<String>() { // from class: com.wangzhe.jiaoyanshi.MainActivity.4
            @Override // android.webkit.ValueCallback
            public void onReceiveValue(String str) {
                int i;
                try {
                    i = Integer.parseInt(String.valueOf(str).replace("\"", "").trim());
                } catch (Exception unused) {
                    i = -1;
                }
                if (i > 0) {
                    return;
                }
                if (MainActivity.this.usingHttpServer) {
                    MainActivity.this.usingHttpServer = false;
                    MainActivity.this.webView.loadUrl(MainActivity.LOCAL_INDEX);
                    MainActivity.this.scheduleReadinessCheck(6000L);
                } else {
                    if (!MainActivity.this.localHtmlFallbackTried) {
                        MainActivity.this.localHtmlFallbackTried = true;
                        MainActivity.this.loadHtmlFallback();
                        MainActivity.this.scheduleReadinessCheck(5000L);
                        return;
                    }
                    MainActivity.this.showDiagnosticPage("页面脚本未渲染（root 为空）");
                }
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void loadHtmlFallback() {
        String readAssetText = readAssetText("site/index.html");
        if (readAssetText == null) {
            showDiagnosticPage("内置 assets 也无法读取（assets/site/index.html 不存在）");
        } else {
            this.webView.loadDataWithBaseURL(LOCAL_BASE, readAssetText, "text/html", "utf-8", null);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public boolean isLocalUrl(String str) {
        return str != null && (str.startsWith(LOCAL_BASE) || (this.serverPort > 0 && str.startsWith(localHttpBase())));
    }

    private InputStream openAsset(String str) {
        try {
            return getAssets().open(str);
        } catch (IOException unused) {
            return null;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public WebResourceResponse serveLocalAsset(String str) {
        if (str == null) {
            str = "";
        }
        String str2 = "/index.html";
        if (str.isEmpty()) {
            str = "/index.html";
        }
        if (str.endsWith("/")) {
            str = str + "index.html";
        }
        if (str.indexOf("..") >= 0) {
            return plainResponse(403, "Forbidden", "text/plain", "403 Forbidden");
        }
        InputStream openAsset = openAsset("site" + str);
        if (openAsset != null || str.contains(".")) {
            str2 = str;
        } else {
            openAsset = openAsset("site/index.html");
        }
        InputStream inputStream = openAsset;
        if (inputStream == null) {
            return plainResponse(404, "Not Found", "text/plain", "404 Not Found");
        }
        String mimeOf = mimeOf(str2);
        HashMap hashMap = new HashMap();
        hashMap.put("Cache-Control", "no-cache, no-store, must-revalidate");
        hashMap.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse(mimeOf, isTextual(mimeOf) ? "utf-8" : null, 200, "OK", hashMap, inputStream);
    }

    private WebResourceResponse plainResponse(int i, String str, String str2, String str3) {
        HashMap hashMap = new HashMap();
        hashMap.put("Cache-Control", "no-cache, no-store, must-revalidate");
        return new WebResourceResponse(str2, "utf-8", i, str, hashMap, new ByteArrayInputStream(str3.getBytes()));
    }

    private static boolean isTextual(String str) {
        return str.startsWith("text/") || str.equals("application/javascript") || str.equals("application/json") || str.equals("image/svg+xml");
    }

    private static String mimeOf(String str) {
        String lowerCase = str.toLowerCase();
        return (lowerCase.endsWith(".html") || lowerCase.endsWith(".htm")) ? "text/html" : (lowerCase.endsWith(".js") || lowerCase.endsWith(".mjs")) ? "application/javascript" : lowerCase.endsWith(".css") ? "text/css" : lowerCase.endsWith(".woff2") ? "font/woff2" : lowerCase.endsWith(".woff") ? "font/woff" : lowerCase.endsWith(".ttf") ? "font/ttf" : lowerCase.endsWith(".png") ? "image/png" : (lowerCase.endsWith(".jpg") || lowerCase.endsWith(".jpeg")) ? "image/jpeg" : lowerCase.endsWith(".webp") ? "image/webp" : lowerCase.endsWith(".svg") ? "image/svg+xml" : lowerCase.endsWith(".ico") ? "image/x-icon" : lowerCase.endsWith(".json") ? "application/json" : lowerCase.endsWith(".txt") ? "text/plain" : "application/octet-stream";
    }

    private String readAssetText(String str) {
        InputStream openAsset = openAsset(str);
        if (openAsset == null) {
            return null;
        }
        try {
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            byte[] bArr = new byte[8192];
            while (true) {
                int read = openAsset.read(bArr);
                if (read <= 0) {
                    break;
                }
                byteArrayOutputStream.write(bArr, 0, read);
            }
            return new String(byteArrayOutputStream.toByteArray(), "UTF-8");
        } catch (Throwable th) {
            return null;
        } finally {
            try {
                openAsset.close();
            } catch (Throwable th) {
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void injectPageHelpers(WebView webView) {
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript(PAGE_HELPERS_JS, null);
    }

    private class AppClient extends WebViewClient {
        private AppClient() {
        }

        @Override // android.webkit.WebViewClient
        public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest webResourceRequest) {
            String path;
            Uri url = webResourceRequest.getUrl();
            if (url == null) {
                return null;
            }
            String host = url.getHost();
            if (MainActivity.LOCAL_HOST.equalsIgnoreCase(host)) {
                return MainActivity.this.serveLocalAsset(url.getPath());
            }
            if (host == null || !((host.endsWith("kimi.com") || host.endsWith("kimi.ai")) && (path = url.getPath()) != null && (path.contains("sdk-seed") || path.contains("/sdk/")))) {
                return null;
            }
            return new WebResourceResponse("application/javascript", "utf-8", new ByteArrayInputStream(new byte[0]));
        }

        private boolean handleUri(Uri uri) {
            if (uri == null) {
                return false;
            }
            String lowerCase = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            String host = uri.getHost();
            if (MainActivity.LOCAL_HOST.equalsIgnoreCase(host) || "127.0.0.1".equals(host) || "localhost".equals(host)) {
                return false;
            }
            if ("http".equals(lowerCase) || "https".equals(lowerCase)) {
                MainActivity.this.openExternally(uri);
                return true;
            }
            try {
                MainActivity.this.startActivity(new Intent("android.intent.action.VIEW", uri));
            } catch (Exception unused) {
            }
            return true;
        }

        @Override // android.webkit.WebViewClient
        public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest webResourceRequest) {
            return handleUri(webResourceRequest.getUrl());
        }

        @Override // android.webkit.WebViewClient
        public boolean shouldOverrideUrlLoading(WebView webView, String str) {
            return handleUri(Uri.parse(str));
        }

        @Override // android.webkit.WebViewClient
        public void onPageStarted(WebView webView, String str, Bitmap bitmap) {
            if (str == null || !MainActivity.this.isLocalUrl(str) || MainActivity.this.localHtmlFallbackTried) {
                return;
            }
            MainActivity.this.diagnosticShown = false;
        }

        @Override // android.webkit.WebViewClient
        public void onPageFinished(WebView webView, String str) {
            MainActivity.this.injectPageHelpers(webView);
            MainActivity.this.scheduleReadinessCheck(1800L);
        }

        @Override // android.webkit.WebViewClient
        public void onReceivedError(WebView webView, WebResourceRequest webResourceRequest, WebResourceError webResourceError) {
            if (webResourceRequest == null || !webResourceRequest.isForMainFrame()) {
                return;
            }
            MainActivity.this.lastErrorInfo = "onReceivedError code=" + webResourceError.getErrorCode() + " " + ((Object) webResourceError.getDescription());
            MainActivity mainActivity = MainActivity.this;
            mainActivity.handleMainFrameFailure(mainActivity.lastErrorInfo);
        }

        @Override // android.webkit.WebViewClient
        public void onReceivedHttpError(WebView webView, WebResourceRequest webResourceRequest, WebResourceResponse webResourceResponse) {
            if (webResourceRequest == null || !webResourceRequest.isForMainFrame() || webResourceResponse == null || webResourceResponse.getStatusCode() < 400) {
                return;
            }
            MainActivity.this.lastErrorInfo = "onReceivedHttpError " + webResourceResponse.getStatusCode();
            MainActivity mainActivity = MainActivity.this;
            mainActivity.handleMainFrameFailure(mainActivity.lastErrorInfo);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void handleMainFrameFailure(String str) {
        if (this.diagnosticShown) {
            return;
        }
        if (this.usingHttpServer) {
            this.usingHttpServer = false;
            this.webView.loadUrl(LOCAL_INDEX);
            scheduleReadinessCheck(6000L);
        } else {
            if (!this.localHtmlFallbackTried) {
                this.localHtmlFallbackTried = true;
                loadHtmlFallback();
                scheduleReadinessCheck(5000L);
                return;
            }
            showDiagnosticPage(str);
        }
    }

    private static String esc(String str) {
        return str == null ? "" : str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private String chromeVersion() {
        try {
            String userAgentString = this.webView.getSettings().getUserAgentString();
            Pattern compile = Pattern.compile("Chrome/([0-9.]+)");
            if (userAgentString == null) {
                userAgentString = "";
            }
            Matcher matcher = compile.matcher(userAgentString);
            return matcher.find() ? matcher.group(1) : "未知";
        } catch (Exception unused) {
            return "未知";
        }
    }

    private String assetProbe() {
        String str;
        StringBuilder sb = new StringBuilder();
        try {
            String[] list = getAssets().list("site");
            sb.append("assets/site 列表：");
            if (list == null) {
                str = "null";
            } else {
                str = list.length + " 项";
            }
            sb.append(str);
        } catch (Throwable th) {
            sb.append("assets 列表异常：");
            sb.append(th);
        }
        return sb.toString();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void showDiagnosticPage(String str) {
        String str2;
        String str3;
        if (this.diagnosticShown) {
            return;
        }
        this.diagnosticShown = true;
        String readAssetText = readAssetText("site/index.html");
        File file = this.siteDir;
        int countFiles = file == null ? -1 : countFiles(file);
        StringBuilder sb = new StringBuilder("App 版本：");
        sb.append(this.appVersion);
        sb.append("\n运行模式：");
        if (this.usingHttpServer) {
            str2 = "本地 HTTP 服务（端口 " + this.serverPort + "）";
        } else {
            str2 = "assets 拦截模式";
        }
        sb.append(str2);
        sb.append("\n当前 URL：");
        WebView webView = this.webView;
        sb.append(webView == null ? "" : webView.getUrl());
        sb.append("\n失败原因：");
        sb.append(str);
        sb.append("\n详细错误：");
        sb.append(this.lastErrorInfo);
        sb.append("\n本地解压目录：");
        File file2 = this.siteDir;
        sb.append(file2 == null ? "未初始化" : file2.getAbsolutePath());
        sb.append("\n本地文件数：");
        sb.append(countFiles < 0 ? "未统计" : String.valueOf(countFiles));
        sb.append("\n启动日志：");
        sb.append(this.prepareLog.replace("\n", " | "));
        sb.append("\nassets index.html 读取：");
        if (readAssetText == null) {
            str3 = "失败";
        } else {
            str3 = "成功，" + readAssetText.length() + " 字符";
        }
        sb.append(str3);
        sb.append("\n");
        sb.append(assetProbe());
        sb.append("\nAndroid：");
        sb.append(Build.VERSION.RELEASE);
        sb.append(" (API ");
        sb.append(Build.VERSION.SDK_INT);
        sb.append(")\nWebView Chrome 版本：");
        sb.append(chromeVersion());
        sb.append("\nUser-Agent：");
        WebView webView2 = this.webView;
        sb.append(webView2 != null ? webView2.getSettings().getUserAgentString() : "");
        String str4 = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><style>body{margin:0;padding:22px;background:#080a0e;color:#f2efe8;font-family:sans-serif;line-height:1.7}h1{font-size:19px;color:#e3c078;margin:0 0 8px}p{font-size:12px;color:#9aa7b8;margin:0 0 12px}textarea{width:100%;height:300px;box-sizing:border-box;background:#111721;color:#d8d2c5;border:1px solid #222d3b;border-radius:10px;padding:10px;font-size:11px;font-family:monospace}button{margin-top:14px;padding:10px 20px;border-radius:10px;border:1px solid #c9a25f;background:transparent;color:#e3c078;font-size:14px;margin-right:8px}</style></head><body><h1>本地界面加载失败（诊断页）</h1><p>请把下面的信息截图发给开发者。当前版本不会跳转任何在线网页。</p><textarea readonly>" + esc(sb.toString()) + "</textarea><br/><button onclick=\"location.reload()\">重新加载</button><button onclick=\"window.AppBridge&&window.AppBridge.restartApp()\">重启应用</button></body></html>";
        WebView webView3 = this.webView;
        if (webView3 != null) {
            webView3.loadDataWithBaseURL(LOCAL_BASE, str4, "text/html", "utf-8", null);
        }
    }

    private class AppBridge {
        private AppBridge() {
        }

        @JavascriptInterface
        public void openExternal(final String str) {
            if (str == null || MainActivity.this.webView == null) {
                return;
            }
            MainActivity mainActivity = MainActivity.this;
            if (mainActivity.isLocalUrl(mainActivity.webView.getUrl())) {
                MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.1
                    @Override // java.lang.Runnable
                    public void run() {
                        MainActivity.this.openExternally(Uri.parse(str));
                    }
                });
            }
        }

        @JavascriptInterface
        public void saveAndShareImage(final String str, final String str2) {
            if (str == null || MainActivity.this.webView == null) {
                return;
            }
            MainActivity mainActivity = MainActivity.this;
            if (mainActivity.isLocalUrl(mainActivity.webView.getUrl())) {
                MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.2
                    @Override // java.lang.Runnable
                    public void run() {
                        try {
                            MainActivity.this.doSaveAndShare(str, str2);
                        } catch (Exception unused) {
                            Toast.makeText(MainActivity.this, "分享图生成失败", 0).show();
                        }
                    }
                });
            }
        }

        @JavascriptInterface
        public void restartApp() {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.3
                @Override // java.lang.Runnable
                public void run() {
                    Intent intent = new Intent(MainActivity.this, (Class<?>) MainActivity.class);
                    intent.addFlags(268468224);
                    MainActivity.this.startActivity(intent);
                    MainActivity.this.finish();
                }
            });
        }

        @JavascriptInterface
        public void aiChat(final String str, String str2, final String str3, final String str4) {
            WebView webView = MainActivity.this.webView;
            if (webView != null && MainActivity.this.isLocalUrl(webView.getUrl())) {
                final String trim = str2 == null ? "" : str2.trim();
                if (!trim.startsWith("https://") && !trim.startsWith("http://")) {
                    MainActivity.this.aiReply(str, false, "接口地址必须以 http(s):// 开头");
                } else {
                    new Thread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.4
                        @Override // java.lang.Runnable
                        public void run() {
                            String str5;
                            HttpURLConnection httpURLConnection = null;
                            try {
                                HttpURLConnection httpURLConnection2 = (HttpURLConnection) new URL(trim).openConnection();
                                try {
                                    httpURLConnection2.setConnectTimeout(15000);
                                    httpURLConnection2.setReadTimeout(90000);
                                    httpURLConnection2.setRequestMethod("POST");
                                    httpURLConnection2.setDoOutput(true);
                                    httpURLConnection2.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                                    httpURLConnection2.setRequestProperty("Accept", "application/json");
                                    String str6 = str3;
                                    if (str6 != null && !str6.trim().isEmpty()) {
                                        httpURLConnection2.setRequestProperty("Authorization", "Bearer " + str3.trim());
                                    }
                                    String str7 = str4;
                                    if (str7 == null) {
                                        str7 = "{}";
                                    }
                                    byte[] bytes = str7.getBytes("UTF-8");
                                    httpURLConnection2.setFixedLengthStreamingMode(bytes.length);
                                    OutputStream outputStream = httpURLConnection2.getOutputStream();
                                    try {
                                        outputStream.write(bytes);
                                        outputStream.close();
                                        int responseCode = httpURLConnection2.getResponseCode();
                                        String readStreamText = MainActivity.readStreamText(responseCode >= 400 ? httpURLConnection2.getErrorStream() : httpURLConnection2.getInputStream());
                                        if (responseCode < 400) {
                                            MainActivity.this.aiReply(str, true, readStreamText);
                                        } else {
                                            MainActivity mainActivity = MainActivity.this;
                                            String str8 = str;
                                            StringBuilder sb = new StringBuilder("接口返回 HTTP ");
                                            sb.append(responseCode);
                                            if (readStreamText.isEmpty()) {
                                                str5 = "";
                                            } else {
                                                str5 = "：" + MainActivity.trimText(readStreamText, 240);
                                            }
                                            sb.append(str5);
                                            mainActivity.aiReply(str8, false, sb.toString());
                                        }
                                        if (httpURLConnection2 != null) {
                                            httpURLConnection2.disconnect();
                                        }
                                    } catch (Throwable th) {
                                        outputStream.close();
                                        throw th;
                                    }
                                } catch (Throwable th2) {
                                    httpURLConnection = httpURLConnection2;
                                    try {
                                        String simpleName = th2.getClass().getSimpleName();
                                        if (th2.getMessage() != null && !th2.getMessage().isEmpty()) {
                                            simpleName = simpleName + " " + th2.getMessage();
                                        }
                                        MainActivity.this.aiReply(str, false, "网络请求失败：" + simpleName);
                                    } finally {
                                        if (httpURLConnection != null) {
                                            httpURLConnection.disconnect();
                                        }
                                    }
                                }
                            } catch (Throwable th3) {
                            }
                        }
                    }, "wzjs-ai").start();
                }
            }
        }

        @JavascriptInterface
        public void voiceStart(final String str) {
            final WebView webView;
            if (str == null || str.isEmpty() || (webView = MainActivity.this.webView) == null) {
                return;
            }
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.5
                @Override // java.lang.Runnable
                public void run() {
                    try {
                        if (MainActivity.this.isLocalUrl(webView.getUrl())) {
                            MainActivity.this.beginVoice(str);
                        }
                    } catch (Throwable th) {
                        Log.e(MainActivity.LOG_TAG, "voiceStart failed", th);
                        MainActivity.this.resetSpeechState();
                        MainActivity.this.releaseSpeechRecognizer();
                        MainActivity.this.voiceEvent(str, "error", MainActivity.voiceErrorJson("native_error", "语音启动异常：" + MainActivity.describeThrowable(th)));
                    }
                }
            });
        }

        @JavascriptInterface
        public void voiceSystemInput(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.6
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.startSystemVoice(str);
                }
            });
        }

        @JavascriptInterface
        public void voiceStop(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.7
                @Override // java.lang.Runnable
                public void run() {
                    if (MainActivity.this.speechListening) {
                        if ((str == null || MainActivity.this.speechRequestId == null || str.equals(MainActivity.this.speechRequestId)) && !MainActivity.this.voiceStopPending) {
                            MainActivity.this.voiceStopPending = true;
                            MainActivity.this.finishVoiceFromPartial(str);
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public void voiceCancel(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.8
                @Override // java.lang.Runnable
                public void run() {
                    if (str == null || MainActivity.this.speechRequestId == null || str.equals(MainActivity.this.speechRequestId) || str.equals(MainActivity.this.pendingVoiceRequestId)) {
                        MainActivity.this.cancelVoiceInternal(true);
                    }
                }
            });
        }

        @JavascriptInterface
        public void asrStart(final String str) {
            final WebView webView;
            if (str == null || str.isEmpty() || (webView = MainActivity.this.webView) == null) {
                return;
            }
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.9
                @Override // java.lang.Runnable
                public void run() {
                    try {
                        if (MainActivity.this.isLocalUrl(webView.getUrl())) {
                            MainActivity.this.beginAsr(str);
                        }
                    } catch (Throwable th) {
                        Log.e(MainActivity.LOG_TAG, "asrStart failed", th);
                        MainActivity.this.voiceEvent(str, "error", MainActivity.voiceErrorJson("asr_error", "离线语音启动异常：" + MainActivity.describeThrowable(th)));
                    }
                }
            });
        }

        @JavascriptInterface
        public void asrStop(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.10
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.stopAsr(str);
                }
            });
        }

        @JavascriptInterface
        public void asrCancel(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.AppBridge.11
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.cancelAsr(str);
                }
            });
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void aiReply(String str, boolean z, String str2) {
        if (this.webView == null) {
            return;
        }
        StringBuilder sb = new StringBuilder("window.__aiReply&&window.__aiReply(");
        sb.append(JSONObject.quote(str));
        sb.append(",");
        sb.append(z ? "true" : "false");
        sb.append(",");
        if (str2 == null) {
            str2 = "";
        }
        sb.append(JSONObject.quote(str2));
        sb.append(");");
        final String sb2 = sb.toString();
        runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.5
            @Override // java.lang.Runnable
            public void run() {
                if (MainActivity.this.webView != null) {
                    MainActivity.this.webView.evaluateJavascript(sb2, null);
                }
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void beginAsr(String str) {
        try {
            if (!this.asrRunning && (this.asrThread == null || !this.asrThread.isAlive())) {
                if (this.pendingAsrRequestId != null) {
                    voiceEvent(str, "error", voiceErrorJson("busy", "正在申请麦克风权限，请稍候"));
                    return;
                }
                if (checkSelfPermission("android.permission.RECORD_AUDIO") != 0) {
                    this.pendingAsrRequestId = str;
                    this.pendingAsrCancelled = false;
                    try {
                        requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, REQ_ASR_AUDIO);
                        return;
                    } catch (Throwable th) {
                        this.pendingAsrRequestId = null;
                        Log.e(LOG_TAG, "asr requestPermissions failed", th);
                        voiceEvent(str, "error", voiceErrorJson("permission", "无法申请麦克风权限：" + describeThrowable(th)));
                        return;
                    }
                }
                startAsr(str);
                return;
            }
            voiceEvent(str, "error", voiceErrorJson("busy", "正在识别中，请稍候"));
        } catch (Throwable th2) {
            this.asrRunning = false;
            this.asrCancelled = true;
            Log.e(LOG_TAG, "beginAsr failed", th2);
            voiceEvent(str, "error", voiceErrorJson("asr_error", "离线语音初始化异常：" + describeThrowable(th2)));
        }
    }

    private void startAsr(final String str) {
        synchronized (this) {
            if (!this.asrRunning && (this.asrThread == null || !this.asrThread.isAlive())) {
                this.asrRequestId = str;
                this.asrCancelled = false;
                this.asrStopRequested = false;
                this.asrRunning = true;
                this.lastAsrRmsAt = 0L;
                Thread thread = new Thread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.6
                    @Override // java.lang.Runnable
                    public void run() {
                        MainActivity.this.runAsrLoop(str);
                    }
                }, "wzjs-asr");
                this.asrThread = thread;
                thread.start();
                return;
            }
            voiceEvent(str, "error", voiceErrorJson("busy", "正在识别中，请稍候"));
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void stopAsr(String str) {
        if (str == null || this.asrRequestId == null || str.equals(this.asrRequestId)) {
            if (this.pendingAsrRequestId != null) {
                this.pendingAsrCancelled = true;
            } else {
                this.asrStopRequested = true;
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void cancelAsr(String str) {
        if (str == null || this.asrRequestId == null || str.equals(this.asrRequestId) || str.equals(this.pendingAsrRequestId)) {
            if (this.pendingAsrRequestId != null) {
                this.pendingAsrCancelled = true;
                this.pendingAsrRequestId = null;
            }
            this.asrCancelled = true;
            this.asrRunning = false;
            AudioRecord audioRecord = this.asrRecord;
            if (audioRecord != null) {
                try {
                    audioRecord.stop();
                } catch (Throwable unused) {
                }
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    /* JADX WARN: Removed duplicated region for block: B:115:0x022c A[Catch: all -> 0x0276, TRY_LEAVE, TryCatch #13 {all -> 0x0276, blocks: (B:113:0x0228, B:115:0x022c), top: B:112:0x0228 }] */
    /* JADX WARN: Removed duplicated region for block: B:123:0x0264 A[EXC_TOP_SPLITTER, SYNTHETIC] */
    /* JADX WARN: Removed duplicated region for block: B:127:0x025f A[EXC_TOP_SPLITTER, SYNTHETIC] */
    /* JADX WARN: Removed duplicated region for block: B:131:0x0253 A[EXC_TOP_SPLITTER, SYNTHETIC] */
    /* JADX WARN: Removed duplicated region for block: B:195:0x01c4 A[Catch: all -> 0x01ce, TryCatch #9 {all -> 0x01ce, blocks: (B:176:0x0112, B:179:0x0121, B:181:0x012b, B:183:0x0131, B:185:0x0139, B:67:0x0157, B:68:0x015a, B:70:0x0160, B:72:0x0164, B:75:0x0171, B:193:0x01bc, B:194:0x01c3, B:195:0x01c4, B:196:0x01cd), top: B:33:0x0087 }] */
    /* JADX WARN: Removed duplicated region for block: B:35:0x0089 A[Catch: all -> 0x01d0, TryCatch #10 {all -> 0x01d0, blocks: (B:32:0x0083, B:35:0x0089, B:37:0x0095, B:39:0x00a6, B:41:0x00aa, B:43:0x00ae, B:163:0x00e0, B:169:0x00f2, B:170:0x00f5, B:174:0x00ff), top: B:31:0x0083 }] */
    /*
        Code decompiled incorrectly, please refer to instructions dump.
        To view partially-correct add '--show-bad-code' argument
    */
    public void runAsrLoop(final String requestId) {
        OnlineRecognizer recognizer = null;
        OnlineStream stream = null;
        AudioRecord record = null;
        final OnlineRecognizer[] modelHolder = new OnlineRecognizer[1];
        final Throwable[] modelError = new Throwable[1];
        final CountDownLatch modelLatch = new CountDownLatch(1);
        try {
            // 先打开麦克风并开始录音，模型加载期间的声音先缓存，避免首词丢失。
            int minBuf = AudioRecord.getMinBufferSize(16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT);
            int bufSize = Math.max(minBuf * 2, 32000);
            try {
                record = new AudioRecord(android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT, bufSize);
            } catch (Throwable t) {
                record = null;
            }
            if (record == null || record.getState() != AudioRecord.STATE_INITIALIZED) {
                if (record != null) {
                    try {
                        record.release();
                    } catch (Throwable unused) {
                    }
                }
                record = new AudioRecord(android.media.MediaRecorder.AudioSource.MIC, 16000, android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT, bufSize);
            }
            if (record.getState() != AudioRecord.STATE_INITIALIZED) {
                throw new IOException("麦克风初始化失败");
            }
            this.asrRecord = record;
            record.startRecording();
            voiceEvent(requestId, "ready", "{}");

            Thread loader = new Thread(new Runnable() {
                @Override // java.lang.Runnable
                public void run() {
                    try {
                        File dir = ensureAsrModelDir();
                        OnlineRecognizer warm = takePrewarmedAsr();
                        modelHolder[0] = warm != null ? warm : createAsrRecognizer(dir);
                    } catch (Throwable t) {
                        modelError[0] = t;
                    } finally {
                        modelLatch.countDown();
                    }
                }
            }, "wzjs-asr-model");
            loader.start();

            short[] pcm = new short[1600];
            float[] chunk = new float[1600];
            ArrayList<float[]> pending = new ArrayList<>();
            String lastText = "";
            boolean streamReady = false;
            long loadStartedAt = System.currentTimeMillis();
            while (this.asrRunning && !this.asrCancelled) {
                int n = record.read(pcm, 0, pcm.length);
                if (n <= 0) {
                    continue;
                }
                for (int i = 0; i < n; i++) {
                    chunk[i] = pcm[i] / 32768.0f;
                }
                if (!streamReady && modelLatch.getCount() == 0) {
                    if (modelError[0] != null) {
                        throw new IOException("离线模型加载失败", modelError[0]);
                    }
                    recognizer = modelHolder[0];
                    if (recognizer == null) {
                        throw new IOException("离线模型加载失败");
                    }
                    stream = recognizer.createStream();
                    this.asrRecognizer = recognizer;
                    this.asrStream = stream;
                    streamReady = true;
                    for (float[] buffered : pending) {
                        stream.acceptWaveform(buffered, 16000);
                        while (recognizer.isReady(stream)) {
                            recognizer.decode(stream);
                        }
                    }
                    pending.clear();
                }
                if (streamReady) {
                    stream.acceptWaveform(chunk, 16000);
                    while (recognizer.isReady(stream)) {
                        recognizer.decode(stream);
                    }
                    String text = recognizer.getResult(stream).getText();
                    if (text != null && !text.trim().isEmpty() && !text.equals(lastText)) {
                        lastText = text;
                        voiceEvent(requestId, "partial", asrResultsJson(text));
                    }
                } else {
                    pending.add(Arrays.copyOf(chunk, n));
                }
                sendAsrRms(requestId, pcm, n, System.currentTimeMillis());
                if (streamReady && this.asrStopRequested) {
                    break;
                }
                if (!streamReady && this.asrStopRequested && System.currentTimeMillis() - loadStartedAt > 60000L) {
                    throw new IOException("离线模型加载超时");
                }
            }
            if (!this.asrCancelled && this.asrStopRequested && streamReady) {
                long tailUntil = System.currentTimeMillis() + 350L;
                while (System.currentTimeMillis() < tailUntil) {
                    int n = record.read(pcm, 0, pcm.length);
                    if (n <= 0) {
                        continue;
                    }
                    for (int i = 0; i < n; i++) {
                        chunk[i] = pcm[i] / 32768.0f;
                    }
                    stream.acceptWaveform(chunk, 16000);
                    while (recognizer.isReady(stream)) {
                        recognizer.decode(stream);
                    }
                }
            }
            if (stream == null || recognizer == null) {
                throw new IOException("离线模型尚未加载完成");
            }
            stream.inputFinished();
            while (recognizer.isReady(stream)) {
                recognizer.decode(stream);
            }
            String finalText = recognizer.getResult(stream).getText();
            if (this.asrCancelled) {
                voiceEvent(requestId, "error", voiceErrorJson("cancelled", "已取消语音输入"));
            } else if (finalText == null || finalText.trim().isEmpty()) {
                voiceEvent(requestId, "error", voiceErrorJson("no_match", "没听到声音，请靠近麦克风再说一次"));
            } else {
                voiceEvent(requestId, "final", asrResultsJson(finalText));
            }
        } catch (Throwable th) {
            if (!this.asrCancelled) {
                Log.e(LOG_TAG, "runAsrLoop failed", th);
                voiceEvent(requestId, "error", voiceErrorJson("asr_error", "离线语音识别失败：" + describeThrowable(th)));
            }
        } finally {
            if (record != null) {
                try {
                    record.stop();
                } catch (Throwable unused) {
                }
                try {
                    record.release();
                } catch (Throwable unused) {
                }
            }
            if (stream != null) {
                try {
                    stream.release();
                } catch (Throwable unused) {
                }
            }
            if (recognizer == null) {
                recognizer = modelHolder[0];
            }
            if (recognizer != null) {
                boolean keepWarm = false;
                synchronized (MainActivity.this) {
                    if (this.asrWarmRecognizer == null && !isFinishing()) {
                        this.asrWarmRecognizer = recognizer;
                        recognizer = null;
                        keepWarm = true;
                    }
                }
                if (!keepWarm && recognizer != null) {
                    try {
                        recognizer.release();
                    } catch (Throwable unused) {
                    }
                }
            }
            this.asrRecord = null;
            this.asrStream = null;
            this.asrRecognizer = null;
            this.asrRunning = false;
            this.asrThread = null;
            this.asrRequestId = null;
            this.asrCancelled = false;
            this.asrStopRequested = false;
        }
    }

    private void sendAsrRms(String str, short[] sArr, int i, long j) {
        if (j - this.lastAsrRmsAt < 90) {
            return;
        }
        this.lastAsrRmsAt = j;
        double d = 0.0d;
        for (int i2 = 0; i2 < i; i2++) {
            try {
                double d2 = sArr[i2];
                d += d2 * d2;
            } catch (Throwable unused) {
                return;
            }
        }
        int max = (int) Math.max(0L, Math.min(10L, Math.round((Math.sqrt(d / Math.max(1, i)) / 32768.0d) * 80.0d)));
        JSONObject jSONObject = new JSONObject();
        try {
            jSONObject.put("rms", max);
        } catch (Throwable unused) {
        }
        voiceEvent(str, "rms", jSONObject.toString());
    }

    private static String asrResultsJson(String str) {
        try {
            JSONArray jSONArray = new JSONArray();
            JSONObject jSONObject = new JSONObject();
            if (str == null) {
                str = "";
            }
            jSONObject.put("text", str);
            jSONObject.put("confidence", 1.0d);
            jSONArray.put(jSONObject);
            JSONObject jSONObject2 = new JSONObject();
            jSONObject2.put("results", jSONArray);
            return jSONObject2.toString();
        } catch (Throwable unused) {
            return "{\"results\":[]}";
        }
    }

    private synchronized File ensureAsrModelDir() throws IOException {
        File file = new File(getFilesDir(), "asr-model");
        File file2 = new File(file, ".ready");
        boolean isFile = ASR_MODEL_TAG.equals(readSmallText(file2));
        int i = 0;
        if (isFile) {
            for (String str : ASR_MODEL_FILES) {
                File file3 = new File(file, str);
                if (!file3.isFile() || file3.length() == 0) {
                    isFile = false;
                    break;
                }
            }
            if (isFile) {
                File hotwords = new File(file, ASR_HOTWORDS_FILE);
                if (!hotwords.isFile() || hotwords.length() == 0) {
                    isFile = false;
                }
            }
        }
        if (isFile) {
            return file;
        }
        deleteRecursively(file);
        if (!file.mkdirs() && !file.isDirectory()) {
            throw new IOException("无法创建 ASR 模型目录");
        }
        while (true) {
            String[] strArr = ASR_MODEL_FILES;
            if (i < strArr.length) {
                copyRawResource(ASR_MODEL_RAWS[i], new File(file, strArr[i]));
                i++;
            } else {
                copyRawResource(ASR_HOTWORDS_RAW, new File(file, ASR_HOTWORDS_FILE));
                FileOutputStream fileOutputStream = new FileOutputStream(file2);
                try {
                    fileOutputStream.write(ASR_MODEL_TAG.getBytes("UTF-8"));
                    return file;
                } finally {
                    fileOutputStream.close();
                }
            }
        }
    }

    private void copyRawResource(int i, File file) throws IOException {
        InputStream openRawResource = getResources().openRawResource(i);
        FileOutputStream fileOutputStream = new FileOutputStream(file);
        try {
            byte[] bArr = new byte[65536];
            while (true) {
                int read = openRawResource.read(bArr);
                if (read <= 0) {
                    break;
                } else {
                    fileOutputStream.write(bArr, 0, read);
                }
            }
            fileOutputStream.flush();
            try {
                fileOutputStream.close();
            } catch (Throwable unused) {
            }
            try {
                openRawResource.close();
            } catch (Throwable unused2) {
            }
        } finally {
        }
    }

    private static String readSmallText(File file) {
        if (file == null || !file.isFile()) {
            return "";
        }
        FileInputStream input = null;
        ByteArrayOutputStream output = null;
        try {
            input = new FileInputStream(file);
            output = new ByteArrayOutputStream();
            byte[] buffer = new byte[256];
            int read;
            while ((read = input.read(buffer)) > 0 && output.size() < 256) {
                output.write(buffer, 0, read);
            }
            return output.toString("UTF-8");
        } catch (Throwable unused) {
            return "";
        } finally {
            if (input != null) {
                try { input.close(); } catch (Throwable unused) { }
            }
            if (output != null) {
                try { output.close(); } catch (Throwable unused) { }
            }
        }
    }

    private static void deleteRecursively(File file) {
        File[] listFiles;
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory() && (listFiles = file.listFiles()) != null) {
            for (File file2 : listFiles) {
                deleteRecursively(file2);
            }
        }
        file.delete();
    }

    private static OnlineRecognizer createAsrRecognizer(File file) {
        String absolutePath = file.getAbsolutePath();
        FeatureConfig build = FeatureConfig.builder().setSampleRate(16000).setFeatureDim(80).build();
        OnlineTransducerModelConfig.Builder builder = OnlineTransducerModelConfig.builder();
        String[] strArr = ASR_MODEL_FILES;
        return new OnlineRecognizer(OnlineRecognizerConfig.builder()
            .setFeatureConfig(build)
            .setOnlineModelConfig(OnlineModelConfig.builder()
                .setTransducer(builder.setEncoder(new File(absolutePath, strArr[0]).getAbsolutePath()).setDecoder(new File(absolutePath, strArr[1]).getAbsolutePath()).setJoiner(new File(absolutePath, strArr[2]).getAbsolutePath()).build())
                .setTokens(new File(absolutePath, strArr[3]).getAbsolutePath())
                .setNumThreads(2)
                .setDebug(false)
                .setProvider("cpu")
                .build())
            .setDecodingMethod("modified_beam_search")
            .setMaxActivePaths(4)
            .setHotwordsFile(new File(absolutePath, ASR_HOTWORDS_FILE).getAbsolutePath())
            .setHotwordsScore(ASR_HOTWORDS_SCORE)
            .setEnableEndpoint(false)
            .build());
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void startSystemVoice(String str) {
        if (str == null || str.isEmpty()) {
            return;
        }
        try {
            Intent intent = new Intent("android.speech.action.RECOGNIZE_SPEECH");
            intent.putExtra("android.speech.extra.LANGUAGE_MODEL", "free_form");
            intent.putExtra("android.speech.extra.LANGUAGE", "zh-CN");
            intent.putExtra("android.speech.extra.PROMPT", "说出要 Ban 或选中的英雄");
            intent.putExtra("android.speech.extra.MAX_RESULTS", 5);
            this.systemVoiceRequestId = str;
            startActivityForResult(intent, REQ_SYSTEM_SPEECH);
        } catch (Throwable th) {
            this.systemVoiceRequestId = null;
            Log.e(LOG_TAG, "startSystemVoice failed", th);
            voiceEvent(str, "error", voiceErrorJson("system_input_unavailable", "系统语音输入不可用：" + describeThrowable(th)));
        }
    }

    @Override // android.app.Activity
    protected void onActivityResult(int i, int i2, Intent intent) {
        ArrayList<String> stringArrayListExtra;
        super.onActivityResult(i, i2, intent);
        if (i != REQ_SYSTEM_SPEECH) {
            return;
        }
        String str = this.systemVoiceRequestId;
        this.systemVoiceRequestId = null;
        if (str == null) {
            return;
        }
        if (i2 == -1 && intent != null && (stringArrayListExtra = intent.getStringArrayListExtra("android.speech.extra.RESULTS")) != null && !stringArrayListExtra.isEmpty()) {
            Bundle bundle = new Bundle();
            bundle.putStringArrayList("results_recognition", stringArrayListExtra);
            voiceEvent(str, "final", voiceResultsJson(bundle));
            return;
        }
        voiceEvent(str, "error", voiceErrorJson("cancelled", "已取消系统语音输入"));
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void beginVoice(String str) {
        try {
            if (this.speechListening) {
                voiceEvent(str, "error", voiceErrorJson("busy", "正在识别中，请稍候"));
                return;
            }
            if (checkSelfPermission("android.permission.RECORD_AUDIO") != 0) {
                this.pendingVoiceRequestId = str;
                this.pendingVoiceCancelled = false;
                try {
                    requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, REQ_RECORD_AUDIO);
                    return;
                } catch (Throwable th) {
                    this.pendingVoiceRequestId = null;
                    Log.e(LOG_TAG, "requestPermissions failed", th);
                    voiceEvent(str, "error", voiceErrorJson("permission", "无法申请麦克风权限：" + describeThrowable(th)));
                    return;
                }
            }
            startVoice(str);
        } catch (Throwable th2) {
            resetSpeechState();
            releaseSpeechRecognizer();
            Log.e(LOG_TAG, "beginVoice failed", th2);
            voiceEvent(str, "error", voiceErrorJson("native_error", "语音初始化异常：" + describeThrowable(th2)));
        }
    }

    private void startVoice(String str) {
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                voiceEvent(str, "error", voiceErrorJson("unavailable", "系统没有可用的语音识别服务，请先用键盘输入"));
                return;
            }
            releaseSpeechRecognizer();
            SpeechRecognizer createSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            this.speechRecognizer = createSpeechRecognizer;
            if (createSpeechRecognizer == null) {
                voiceEvent(str, "error", voiceErrorJson("unavailable", "语音识别初始化失败"));
                return;
            }
            createSpeechRecognizer.setRecognitionListener(new VoiceListener());
            Intent intent = new Intent("android.speech.action.RECOGNIZE_SPEECH");
            intent.putExtra("android.speech.extra.LANGUAGE_MODEL", "free_form");
            intent.putExtra("android.speech.extra.LANGUAGE", "zh-CN");
            intent.putExtra("android.speech.extra.LANGUAGE_PREFERENCE", "zh-CN");
            intent.putExtra("android.speech.extra.PARTIAL_RESULTS", true);
            intent.putExtra("android.speech.extra.MAX_RESULTS", 5);
            intent.putExtra("android.speech.extra.PROMPT", "说英雄名，如：对面 ban 东皇太一、张良");
            intent.putExtra("calling_package", getPackageName());
            intent.putExtra("android.speech.extras.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 1100L);
            intent.putExtra("android.speech.extras.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 1100L);
            intent.putExtra("android.speech.extras.SPEECH_INPUT_MINIMUM_LENGTH_MILLIS", 500L);
            this.speechRequestId = str;
            this.speechListening = true;
            this.lastRmsEventAt = 0L;
            this.speechRecognizer.startListening(intent);
            voiceEvent(str, "start", "{}");
        } catch (Throwable th) {
            resetSpeechState();
            releaseSpeechRecognizer();
            Log.e(LOG_TAG, "startVoice failed", th);
            voiceEvent(str, "error", voiceErrorJson("start_failed", "麦克风启动失败：" + describeThrowable(th)));
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void finishVoiceFromPartial(String str) {
        final String str2;
        if (!this.speechListening || (str2 = this.speechRequestId) == null) {
            return;
        }
        if (str == null || str.equals(str2)) {
            Bundle bundle = this.lastPartialResults;
            if (bundle != null && hasVoiceText(bundle)) {
                Bundle bundle2 = this.lastPartialResults;
                resetSpeechState();
                try {
                    SpeechRecognizer speechRecognizer = this.speechRecognizer;
                    if (speechRecognizer != null) {
                        speechRecognizer.cancel();
                    }
                } catch (Throwable unused) {
                }
                releaseSpeechRecognizer();
                voiceEvent(str2, "final", voiceResultsJson(bundle2));
                return;
            }
            try {
                SpeechRecognizer speechRecognizer2 = this.speechRecognizer;
                if (speechRecognizer2 != null) {
                    speechRecognizer2.stopListening();
                }
            } catch (Throwable unused2) {
            }
            WebView webView = this.webView;
            if (webView != null) {
                webView.postDelayed(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.7
                    @Override // java.lang.Runnable
                    public void run() {
                        if (MainActivity.this.speechListening && str2.equals(MainActivity.this.speechRequestId)) {
                            Bundle bundle3 = MainActivity.this.lastPartialResults;
                            MainActivity.this.resetSpeechState();
                            MainActivity.this.releaseSpeechRecognizer();
                            if (bundle3 == null || !MainActivity.hasVoiceText(bundle3)) {
                                MainActivity.this.voiceEvent(str2, "error", MainActivity.voiceErrorJson("no_match", "没听到声音，请靠近麦克风再说一次"));
                            } else {
                                MainActivity.this.voiceEvent(str2, "final", MainActivity.voiceResultsJson(bundle3));
                            }
                        }
                    }
                }, 5000L);
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static boolean hasVoiceText(Bundle bundle) {
        if (bundle == null) {
            return false;
        }
        try {
            ArrayList<String> stringArrayList = bundle.getStringArrayList("results_recognition");
            if (stringArrayList != null) {
                Iterator<String> it = stringArrayList.iterator();
                while (it.hasNext()) {
                    String next = it.next();
                    if (next != null && !next.trim().isEmpty()) {
                        return true;
                    }
                }
            }
        } catch (Throwable unused) {
        }
        return false;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void cancelVoiceInternal(boolean z) {
        String str = this.speechRequestId;
        boolean z2 = this.speechListening;
        SpeechRecognizer speechRecognizer = this.speechRecognizer;
        if (speechRecognizer != null) {
            try {
                speechRecognizer.cancel();
            } catch (Throwable unused) {
            }
        }
        releaseSpeechRecognizer();
        resetSpeechState();
        if (this.pendingVoiceRequestId != null) {
            this.pendingVoiceCancelled = true;
            this.pendingVoiceRequestId = null;
        }
        if (z && z2 && str != null) {
            voiceEvent(str, "error", voiceErrorJson("cancelled", "已取消语音输入"));
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void resetSpeechState() {
        this.speechListening = false;
        this.speechRequestId = null;
        this.lastRmsEventAt = 0L;
        this.lastPartialResults = null;
        this.voiceStopPending = false;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void releaseSpeechRecognizer() {
        SpeechRecognizer speechRecognizer = this.speechRecognizer;
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Throwable unused) {
            }
            this.speechRecognizer = null;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void voiceEvent(String str, String str2, String str3) {
        if (str == null || str.isEmpty() || this.webView == null) {
            return;
        }
        try {
            StringBuilder sb = new StringBuilder("window.__voiceEvent&&window.__voiceEvent(");
            sb.append(JSONObject.quote(str));
            sb.append(",");
            sb.append(JSONObject.quote(str2));
            sb.append(",");
            if (str3 == null) {
                str3 = "{}";
            }
            sb.append(JSONObject.quote(str3));
            sb.append(");");
            final String sb2 = sb.toString();
            runOnUiThread(new Runnable() { // from class: com.wangzhe.jiaoyanshi.MainActivity.8
                @Override // java.lang.Runnable
                public void run() {
                    if (MainActivity.this.webView != null) {
                        MainActivity.this.webView.evaluateJavascript(sb2, null);
                    }
                }
            });
        } catch (Throwable th) {
            Log.e(LOG_TAG, "voiceEvent failed", th);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String describeThrowable(Throwable th) {
        String str;
        if (th == null) {
            return "unknown";
        }
        String message = th.getMessage();
        StringBuilder sb = new StringBuilder();
        sb.append(th.getClass().getSimpleName());
        if (message == null || message.isEmpty()) {
            str = "";
        } else {
            str = "：" + message;
        }
        sb.append(str);
        return sb.toString();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String voiceResultsJson(Bundle bundle) {
        try {
            JSONArray jSONArray = new JSONArray();
            float[] fArr = null;
            ArrayList<String> stringArrayList = bundle == null ? null : bundle.getStringArrayList("results_recognition");
            if (bundle != null) {
                fArr = bundle.getFloatArray("confidence_scores");
            }
            if (stringArrayList != null) {
                for (int i = 0; i < stringArrayList.size(); i++) {
                    String str = stringArrayList.get(i);
                    if (str != null && !str.trim().isEmpty()) {
                        JSONObject jSONObject = new JSONObject();
                        jSONObject.put("text", str);
                        if (fArr != null && i < fArr.length) {
                            float f = fArr[i];
                            if (f >= 0.0f) {
                                jSONObject.put("confidence", f);
                            }
                        }
                        jSONArray.put(jSONObject);
                    }
                }
            }
            JSONObject jSONObject2 = new JSONObject();
            jSONObject2.put("results", jSONArray);
            return jSONObject2.toString();
        } catch (Throwable unused) {
            return "{\"results\":[]}";
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String voiceErrorJson(String str, String str2) {
        try {
            JSONObject jSONObject = new JSONObject();
            if (str == null) {
                str = "error";
            }
            jSONObject.put("code", str);
            if (str2 == null) {
                str2 = "语音识别失败";
            }
            jSONObject.put("message", str2);
            return jSONObject.toString();
        } catch (Throwable unused) {
            return "{\"code\":\"error\",\"message\":\"语音识别失败\"}";
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String voiceErrorMessage(int i) {
        switch (i) {
            case 1:
                return "语音服务超时";
            case 2:
                return "语音服务网络异常";
            case 3:
                return "录音出错，请检查麦克风";
            case 4:
                return "语音服务出错";
            case 5:
                return "识别客户端出错，请重试";
            case 6:
                return "没有听到声音";
            case 7:
                return "没听清，再说一次";
            case 8:
                return "识别器忙，请稍后再试";
            case 9:
                return "没有麦克风权限";
            case 10:
                return "请求太频繁，稍后再试";
            case 11:
                return "语音服务断开";
            case HTTP_PORT_TRIES /* 12 */:
                return "系统不支持中文语音识别";
            case 13:
                return "中文语音识别不可用";
            default:
                return "语音识别失败（" + i + "）";
        }
    }

    private class VoiceListener implements RecognitionListener {
        @Override // android.speech.RecognitionListener
        public void onBufferReceived(byte[] bArr) {
        }

        @Override // android.speech.RecognitionListener
        public void onEvent(int i, Bundle bundle) {
        }

        private VoiceListener() {
        }

        @Override // android.speech.RecognitionListener
        public void onReadyForSpeech(Bundle bundle) {
            if (MainActivity.this.speechRequestId != null) {
                MainActivity mainActivity = MainActivity.this;
                mainActivity.voiceEvent(mainActivity.speechRequestId, "ready", "{}");
            }
        }

        @Override // android.speech.RecognitionListener
        public void onBeginningOfSpeech() {
            if (MainActivity.this.speechRequestId != null) {
                MainActivity mainActivity = MainActivity.this;
                mainActivity.voiceEvent(mainActivity.speechRequestId, "start", "{}");
            }
        }

        @Override // android.speech.RecognitionListener
        public void onRmsChanged(float f) {
            String str = MainActivity.this.speechRequestId;
            if (str == null) {
                return;
            }
            long currentTimeMillis = System.currentTimeMillis();
            if (currentTimeMillis - MainActivity.this.lastRmsEventAt < 90) {
                return;
            }
            MainActivity.this.lastRmsEventAt = currentTimeMillis;
            int max = (int) Math.max(0.0f, Math.min(10.0f, ((f + 2.0f) / 12.0f) * 10.0f));
            try {
                JSONObject jSONObject = new JSONObject();
                jSONObject.put("rms", max);
                MainActivity.this.voiceEvent(str, "rms", jSONObject.toString());
            } catch (Throwable unused) {
            }
        }

        @Override // android.speech.RecognitionListener
        public void onEndOfSpeech() {
            if (MainActivity.this.speechRequestId != null) {
                MainActivity mainActivity = MainActivity.this;
                mainActivity.voiceEvent(mainActivity.speechRequestId, "end", "{}");
            }
        }

        @Override // android.speech.RecognitionListener
        public void onError(int i) {
            String str = MainActivity.this.speechRequestId;
            MainActivity.this.resetSpeechState();
            MainActivity.this.releaseSpeechRecognizer();
            if (str != null) {
                MainActivity.this.voiceEvent(str, "error", MainActivity.voiceErrorJson(i == 7 ? "no_match" : "asr_error", MainActivity.voiceErrorMessage(i)));
            }
        }

        @Override // android.speech.RecognitionListener
        public void onResults(Bundle bundle) {
            String str = MainActivity.this.speechRequestId;
            MainActivity.this.resetSpeechState();
            if (str != null) {
                MainActivity.this.voiceEvent(str, "final", MainActivity.voiceResultsJson(bundle));
            }
        }

        @Override // android.speech.RecognitionListener
        public void onPartialResults(Bundle bundle) {
            String str = MainActivity.this.speechRequestId;
            if (str != null) {
                MainActivity.this.lastPartialResults = bundle;
                MainActivity.this.voiceEvent(str, "partial", MainActivity.voiceResultsJson(bundle));
                if (MainActivity.this.voiceStopPending) {
                    MainActivity.this.finishVoiceFromPartial(str);
                }
            }
        }
    }

    @Override // android.app.Activity
    public void onRequestPermissionsResult(int i, String[] strArr, int[] iArr) {
        super.onRequestPermissionsResult(i, strArr, iArr);
        if (i == REQ_ASR_AUDIO) {
            String str = this.pendingAsrRequestId;
            boolean z = this.pendingAsrCancelled;
            this.pendingAsrRequestId = null;
            this.pendingAsrCancelled = false;
            if (str == null || z) {
                return;
            }
            if (iArr != null && iArr.length > 0 && iArr[0] == 0) {
                startAsr(str);
                return;
            } else {
                voiceEvent(str, "error", voiceErrorJson("permission", "需要麦克风权限才能离线语音输入，可在系统设置里开启"));
                return;
            }
        }
        if (i != REQ_RECORD_AUDIO) {
            return;
        }
        String str2 = this.pendingVoiceRequestId;
        boolean z2 = this.pendingVoiceCancelled;
        this.pendingVoiceRequestId = null;
        this.pendingVoiceCancelled = false;
        if (str2 == null || z2) {
            return;
        }
        if (iArr != null && iArr.length > 0 && iArr[0] == 0) {
            startVoice(str2);
        } else {
            voiceEvent(str2, "error", voiceErrorJson("permission", "需要麦克风权限才能语音输入，可在系统设置里开启"));
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String readStreamText(InputStream inputStream) throws IOException {
        if (inputStream == null) {
            return "";
        }
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        try {
            byte[] bArr = new byte[8192];
            while (true) {
                int read = inputStream.read(bArr);
                if (read > 0) {
                    byteArrayOutputStream.write(bArr, 0, read);
                } else {
                    inputStream.close();
                    return new String(byteArrayOutputStream.toByteArray(), "UTF-8");
                }
            }
        } catch (Throwable th) {
            inputStream.close();
            throw th;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static String trimText(String str, int i) {
        if (str == null) {
            return "";
        }
        if (str.length() <= i) {
            return str;
        }
        return str.substring(0, i) + "…";
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void doSaveAndShare(String str, String str2) throws IOException {
        if (str == null || !str.startsWith("data:image/png;base64,")) {
            throw new IOException("unsupported image format");
        }
        if (str.length() > 16000000) {
            throw new IOException("image too large");
        }
        byte[] decode = Base64.decode(str.substring(22), 0);
        File file = new File(getCacheDir(), "share");
        if (!file.exists() && !file.mkdirs()) {
            throw new IOException("cannot create cache dir");
        }
        if (str2 == null) {
            str2 = "share.png";
        }
        String replaceAll = str2.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!replaceAll.toLowerCase().endsWith(".png")) {
            replaceAll = replaceAll + ".png";
        }
        File file2 = new File(file, replaceAll);
        FileOutputStream fileOutputStream = new FileOutputStream(file2);
        try {
            fileOutputStream.write(decode);
            fileOutputStream.close();
            cleanupShareDir(file, file2);
            Uri parse = Uri.parse("content://com.wangzhe.jiaoyanshi.share/share/" + file2.getName());
            Intent intent = new Intent("android.intent.action.SEND");
            intent.setType("image/png");
            intent.putExtra("android.intent.extra.STREAM", parse);
            intent.addFlags(1);
            Intent createChooser = Intent.createChooser(intent, "分享战绩图");
            createChooser.addFlags(268435456);
            startActivity(createChooser);
        } catch (Throwable th) {
            fileOutputStream.close();
            throw th;
        }
    }

    private void cleanupShareDir(File file, File file2) {
        File[] listFiles = file.listFiles();
        if (listFiles == null) {
            return;
        }
        Arrays.sort(listFiles, new Comparator<File>() { // from class: com.wangzhe.jiaoyanshi.MainActivity.9
            @Override // java.util.Comparator
            public int compare(File file3, File file4) {
                return Long.compare(file4.lastModified(), file3.lastModified());
            }
        });
        long currentTimeMillis = System.currentTimeMillis();
        for (int i = 0; i < listFiles.length; i++) {
            File file3 = listFiles[i];
            if (file3 != null && !file3.equals(file2)) {
                boolean z = currentTimeMillis - file3.lastModified() > 604800000;
                if (i >= 20 || z) {
                    file3.delete();
                }
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void openExternally(Uri uri) {
        if (uri == null) {
            return;
        }
        String lowerCase = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("http".equals(lowerCase) || "https".equals(lowerCase)) {
            try {
                Intent intent = new Intent("android.intent.action.VIEW", uri);
                intent.addFlags(268435456);
                startActivity(intent);
            } catch (Exception unused) {
                Toast.makeText(this, "未找到可打开该链接的应用", 0).show();
            }
        }
    }

    @Override // android.app.Activity
    public void onBackPressed() {
        WebView webView = this.webView;
        if (webView == null) {
            super.onBackPressed();
        } else if (webView.canGoBack()) {
            this.webView.goBack();
        } else {
            this.webView.evaluateJavascript("(function(){try{var f=window.__appBack||window.__studyBack;return !!(f&&f());}catch(e){return false;}})()", new ValueCallback<String>() { // from class: com.wangzhe.jiaoyanshi.MainActivity.10
                @Override // android.webkit.ValueCallback
                public void onReceiveValue(String str) {
                    if ("true".equals(str)) {
                        return;
                    }
                    MainActivity.this.handleDoubleBackExit();
                }
            });
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void handleDoubleBackExit() {
        long currentTimeMillis = System.currentTimeMillis();
        if (currentTimeMillis - this.lastBackPress < DOUBLE_BACK_MS) {
            finish();
        } else {
            this.lastBackPress = currentTimeMillis;
            Toast.makeText(this, "再按一次退出", 0).show();
        }
    }

    @Override // android.app.Activity
    protected void onResume() {
        super.onResume();
        WebView webView = this.webView;
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override // android.app.Activity
    protected void onPause() {
        if (this.speechListening && this.pendingVoiceRequestId == null) {
            cancelVoiceInternal(true);
        }
        if (this.asrRunning || this.asrThread != null) {
            cancelAsr(null);
        }
        WebView webView = this.webView;
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override // android.app.Activity
    protected void onDestroy() {
        if (this.speechListening || this.speechRecognizer != null) {
            cancelVoiceInternal(false);
        }
        if (this.asrRunning || this.asrThread != null) {
            cancelAsr(null);
        }
        this.pendingVoiceRequestId = null;
        this.pendingAsrRequestId = null;
        this.pendingVoiceCancelled = true;
        try {
            ServerSocket serverSocket = this.serverSocket;
            if (serverSocket != null) {
                serverSocket.close();
            }
            ExecutorService executorService = this.serverPool;
            if (executorService != null) {
                executorService.shutdownNow();
            }
        } catch (Exception unused) {
        }
        WebView webView = this.webView;
        if (webView != null) {
            ViewGroup viewGroup = (ViewGroup) webView.getParent();
            if (viewGroup != null) {
                viewGroup.removeView(this.webView);
            }
            this.webView.stopLoading();
            this.webView.destroy();
            this.webView = null;
        }
        super.onDestroy();
    }
}
