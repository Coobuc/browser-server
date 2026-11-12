package com.geremy.thezone;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.net.Uri;
import android.content.Intent;

public class MainActivity extends Activity {
  private WebView web;
  private final String HOME = "https://math.geremy503704.chatgpt.site/";
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(8,7,13));
    getWindow().setNavigationBarColor(Color.rgb(8,7,13));
    web = new WebView(this);
    web.setBackgroundColor(Color.rgb(8,7,13));
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.setWebChromeClient(new WebChromeClient());
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
        Uri uri=request.getUrl();
        String scheme=uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
          try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(Exception ignored) {}
          return true;
        }
        return false;
      }
    });
    setContentView(web);
    if(state!=null) web.restoreState(state); else web.loadUrl(HOME);
  }
  @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
  @Override public void onBackPressed() { if(web.canGoBack())web.goBack(); else super.onBackPressed(); }
  @Override public void onDestroy() { web.destroy(); super.onDestroy(); }
}
