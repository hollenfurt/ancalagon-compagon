package com.hollen.ancalagon;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private WebView webView;
    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(32, 26, 22));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " AncalagonCompanion/0.2");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }
        });

        webView.addJavascriptInterface(new GemmalineBridge(), "AndroidBridge");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }

    private final class GemmalineBridge {
        @JavascriptInterface
        public void fetchGemmaline(String rawUrl, String requestId) {
            if (!isAllowedGemmalineUrl(rawUrl)) {
                deliver(requestId, null, "URL refusée : seuls les dons et sorts de gemmaline.com sont autorisés.");
                return;
            }
            networkExecutor.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    URL url = new URL(rawUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(20000);
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "AncalagonCompanion/0.2 (+personal D&D 3.5 character tool)");
                    connection.setRequestProperty("Accept", "text/html,application/xhtml+xml");

                    int code = connection.getResponseCode();
                    if (code < 200 || code >= 300) {
                        deliver(requestId, null, "Gemmaline a répondu avec le code HTTP " + code + ".");
                        return;
                    }

                    byte[] bytes;
                    try (InputStream in = connection.getInputStream();
                         ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            out.write(buffer, 0, read);
                            if (out.size() > 3_500_000) {
                                throw new IllegalStateException("Page Gemmaline anormalement volumineuse.");
                            }
                        }
                        bytes = out.toByteArray();
                    }

                    Charset charset = detectCharset(connection.getContentType());
                    String body = new String(bytes, charset);
                    deliver(requestId, body, null);
                } catch (Exception ex) {
                    deliver(requestId, null, "Impossible de lire Gemmaline : " + ex.getMessage());
                } finally {
                    if (connection != null) connection.disconnect();
                }
            });
        }
    }

    private static Charset detectCharset(String contentType) {
        if (contentType != null) {
            Matcher matcher = Pattern.compile("charset\\s*=\\s*['\\\"]?([^;\\s'\\\"]+)", Pattern.CASE_INSENSITIVE).matcher(contentType);
            if (matcher.find()) {
                try {
                    return Charset.forName(matcher.group(1));
                } catch (Exception ignored) { }
            }
        }
        return StandardCharsets.UTF_8;
    }

    private static boolean isAllowedGemmalineUrl(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            String path = uri.getPath();
            if (!"https".equalsIgnoreCase(scheme) || host == null || path == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            boolean goodHost = "gemmaline.com".equals(host) || "www.gemmaline.com".equals(host);
            return goodHost && (path.startsWith("/sorts/") || path.startsWith("/dons/"));
        } catch (Exception ex) {
            return false;
        }
    }

    private void deliver(String requestId, String body, String error) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String js = "window.__nativeFetchResolve(" + JSONObject.quote(requestId) + ","
                    + (body == null ? "null" : JSONObject.quote(body)) + ","
                    + (error == null ? "null" : JSONObject.quote(error)) + ");";
            webView.evaluateJavascript(js, null);
        });
    }
}
