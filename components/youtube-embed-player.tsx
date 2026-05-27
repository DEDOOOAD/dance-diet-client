import React, { useEffect, useMemo, useRef } from 'react';
import { Linking, NativeModules, Platform, Pressable, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { getGeneralServerYoutubeEmbedEndpoint } from '@/services/server-config/general-server';

type YoutubeEmbedPlayerProps = {
  videoId?: string | null;
  youtubeUrl?: string | null;
  playbackState?: 'ready' | 'countdown' | 'playing' | 'paused';
  playbackPositionSeconds?: number;
  onPlaybackPositionChange?: (seconds: number) => void;
};

function extractVideoId(youtubeUrl: string) {
  try {
    const parsedUrl = new URL(youtubeUrl);
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host.endsWith('youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathSegments[0] === 'embed' || pathSegments[0] === 'shorts') {
        return pathSegments[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getSafeWebView() {
  const hasNativeModule = Boolean(NativeModules.RNCWebViewModule);
  const hasNativeViewManager =
    Platform.OS === 'android'
      ? Boolean(UIManager.getViewManagerConfig?.('RNCWebView'))
      : Platform.OS === 'ios'
        ? Boolean(UIManager.getViewManagerConfig?.('RNCWebView'))
        : true;

  if (!hasNativeModule && !hasNativeViewManager) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-webview') as {
      WebView?: React.ComponentType<Record<string, unknown>>;
    };
    return module.WebView ?? null;
  } catch {
    return null;
  }
}

function buildEmbedPageUrl(videoId: string, shouldBootstrapPlayback: boolean) {
  const url = new URL(getGeneralServerYoutubeEmbedEndpoint(videoId));
  url.searchParams.set('bootstrap', shouldBootstrapPlayback ? '1' : '0');
  url.searchParams.set('playsinline', '1');

  return url.toString();
}

const injectedIframeControlScript = `
  (function() {
    var player = null;
    var playerReady = false;
    var progressTimer = null;
    var pendingState = 'ready';
    var pendingRestartFromStart = false;
    var pendingSeekSeconds = 0;

    function getIframe() {
      return document.querySelector('iframe');
    }

    function postToReactNative(payload) {
      if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
        return;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }

    function startProgressTimer() {
      if (progressTimer || !playerReady || !player) {
        return;
      }

      progressTimer = setInterval(function() {
        try {
          postToReactNative({
            type: 'progress',
            currentTime: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0
          });
        } catch (error) {
          void error;
        }
      }, 1000);
    }

    function applyPlaybackState(state, restartFromStart, seekSeconds) {
      pendingState = state;
      pendingRestartFromStart = Boolean(restartFromStart);
      pendingSeekSeconds = typeof seekSeconds === 'number' ? seekSeconds : 0;

      if (!playerReady || !player) {
        return false;
      }

      var shouldSeekToSavedPosition = !pendingRestartFromStart && pendingSeekSeconds > 0.25;

      if (state === 'countdown') {
        if (pendingRestartFromStart) {
          player.seekTo(0, true);
        } else if (shouldSeekToSavedPosition) {
          player.seekTo(pendingSeekSeconds, true);
        }
        player.mute();
        player.playVideo();
        return true;
      }

      if (state === 'playing') {
        if (pendingRestartFromStart) {
          player.seekTo(0, true);
        } else if (shouldSeekToSavedPosition) {
          player.seekTo(pendingSeekSeconds, true);
        }
        player.unMute();
        player.playVideo();
        return true;
      }

      if (state === 'paused') {
        if (shouldSeekToSavedPosition) {
          player.seekTo(pendingSeekSeconds, true);
        }
        player.pauseVideo();
        return true;
      }

      player.pauseVideo();
      player.seekTo(0, true);
      player.mute();
      return true;
    }

    window.__RN_EMBED_CONTROL__ = {
      sync: function(state, restartFromStart, seekSeconds) {
        applyPlaybackState(state, Boolean(restartFromStart), Number(seekSeconds || 0));
        setTimeout(function() {
          applyPlaybackState(state, false, Number(seekSeconds || 0));
        }, 150);
        setTimeout(function() {
          applyPlaybackState(state, false, Number(seekSeconds || 0));
        }, 500);
      }
    };

    function ensurePlayer(iframe) {
      if (!iframe) {
        return false;
      }

      if (!iframe.id) {
        iframe.id = 'rn-youtube-embed-frame';
      }

      if (!window.YT || !window.YT.Player || player) {
        return Boolean(player);
      }

      player = new window.YT.Player(iframe.id, {
        events: {
          onReady: function() {
            playerReady = true;
            startProgressTimer();
            applyPlaybackState(pendingState, pendingRestartFromStart, pendingSeekSeconds);
          },
          onStateChange: function() {
            try {
              postToReactNative({
                type: 'progress',
                currentTime: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0
              });
            } catch (error) {
              void error;
            }
          }
        }
      });

      return true;
    }

    function ensureYoutubeApi(iframe) {
      if (window.YT && window.YT.Player) {
        ensurePlayer(iframe);
        return;
      }

      if (!window.__RN_YT_API_LOADING__) {
        window.__RN_YT_API_LOADING__ = true;

        var previousApiReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
          if (typeof previousApiReady === 'function') {
            previousApiReady();
          }
          ensurePlayer(getIframe());
        };

        var script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    function updateIframeSource() {
      var iframe = getIframe();
      if (!iframe || !iframe.src) {
        return false;
      }

      var pageParams = new URLSearchParams(window.location.search);
      var iframeUrl = new URL(iframe.src, window.location.href);
      var shouldBootstrap = pageParams.get('bootstrap') === '1';

      iframeUrl.searchParams.set('playsinline', pageParams.get('playsinline') || '1');
      iframeUrl.searchParams.set('rel', '0');
      iframeUrl.searchParams.set('modestbranding', '1');
      iframeUrl.searchParams.set('controls', '1');
      iframeUrl.searchParams.set('enablejsapi', '1');
      iframeUrl.searchParams.set('autoplay', shouldBootstrap ? '1' : '0');
      iframeUrl.searchParams.set('mute', shouldBootstrap ? '1' : '0');

      if (iframe.src !== iframeUrl.toString()) {
        iframe.src = iframeUrl.toString();
      }

      ensureYoutubeApi(iframe);
      return true;
    }

    function startWatching() {
      if (updateIframeSource()) {
        return;
      }

      var observer = new MutationObserver(function() {
        if (updateIframeSource()) {
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startWatching, { once: true });
    } else {
      startWatching();
    }
  })();
  true;
`;

function YoutubeEmbedPlayerComponent({
  videoId,
  youtubeUrl,
  playbackState = 'ready',
  playbackPositionSeconds = 0,
  onPlaybackPositionChange,
}: YoutubeEmbedPlayerProps) {
  const resolvedVideoId = useMemo(() => {
    if (videoId && videoId.trim()) {
      return videoId.trim();
    }

    if (youtubeUrl && youtubeUrl.trim()) {
      return extractVideoId(youtubeUrl.trim());
    }

    return null;
  }, [videoId, youtubeUrl]);

  const fallbackUrl = useMemo(() => {
    if (youtubeUrl && youtubeUrl.trim()) {
      return youtubeUrl.trim();
    }

    if (!resolvedVideoId) {
      return null;
    }

    return `https://www.youtube.com/watch?v=${resolvedVideoId}`;
  }, [resolvedVideoId, youtubeUrl]);

  const SafeWebView = useMemo(() => getSafeWebView(), []);
  const SafeWebViewComponent = SafeWebView as React.ComponentType<any> | null;
  const webViewRef = useRef<{ injectJavaScript?: (script: string) => void } | null>(null);
  const previousPlaybackStateRef = useRef<NonNullable<YoutubeEmbedPlayerProps['playbackState']>>(playbackState);
  const playbackPositionSecondsRef = useRef(playbackPositionSeconds);
  const lastForwardedProgressSecondsRef = useRef(-1);
  const shouldBootstrapPlayback = playbackState !== 'ready';
  const embedPageUrl = useMemo(
    () => (resolvedVideoId ? buildEmbedPageUrl(resolvedVideoId, shouldBootstrapPlayback) : null),
    [resolvedVideoId, shouldBootstrapPlayback]
  );
  const fallbackTitle = SafeWebViewComponent
    ? 'This video could not be embedded'
    : 'In-app player needs a rebuilt app';
  const fallbackBody = SafeWebViewComponent
    ? 'This class still has a YouTube link, so you can open the original video directly instead.'
    : 'This build does not include the WebView native module yet, so the YouTube video cannot play inside the app until you reinstall a new dev build.';

  useEffect(() => {
    playbackPositionSecondsRef.current = playbackPositionSeconds;
  }, [playbackPositionSeconds]);

  useEffect(() => {
    const previousPlaybackState = previousPlaybackStateRef.current;
    const shouldRestartFromStart =
      playbackState === 'countdown' ||
      (playbackState === 'playing' && previousPlaybackState !== 'playing' && previousPlaybackState !== 'paused') ||
      playbackState === 'ready';

    webViewRef.current?.injectJavaScript?.(
      `window.__RN_EMBED_CONTROL__ && window.__RN_EMBED_CONTROL__.sync(${JSON.stringify(playbackState)}, ${shouldRestartFromStart ? 'true' : 'false'}, ${JSON.stringify(playbackPositionSecondsRef.current)}); true;`
    );

    previousPlaybackStateRef.current = playbackState;
  }, [playbackState]);

  if (!embedPageUrl || !SafeWebViewComponent) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>{fallbackTitle}</Text>
        <Text style={styles.fallbackBody}>{fallbackBody}</Text>
        {fallbackUrl ? (
          <TouchableOpacity
            style={styles.fallbackButton}
            activeOpacity={0.85}
            onPress={() => {
              void Linking.openURL(fallbackUrl);
            }}>
            <Text style={styles.fallbackButtonText}>Open YouTube for now</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.playerShell}>
      <SafeWebViewComponent
        key={embedPageUrl}
        ref={(instance: { injectJavaScript?: (script: string) => void } | null) => {
          webViewRef.current = instance;
        }}
        source={{ uri: embedPageUrl }}
        style={styles.webview}
        originWhitelist={['https://*', 'http://*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        injectedJavaScript={injectedIframeControlScript}
        onMessage={(event: { nativeEvent?: { data?: string } }) => {
          const rawData = event.nativeEvent?.data;
          if (!rawData) {
            return;
          }

          try {
            const payload = JSON.parse(rawData) as { type?: string; currentTime?: number };
            if (payload.type === 'progress' && typeof payload.currentTime === 'number' && Number.isFinite(payload.currentTime)) {
              if (Math.abs(payload.currentTime - lastForwardedProgressSecondsRef.current) >= 0.75) {
                lastForwardedProgressSecondsRef.current = payload.currentTime;
                onPlaybackPositionChange?.(payload.currentTime);
              }
            }
          } catch {
            // Ignore malformed bridge events from the embedded page.
          }
        }}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript?.(
            `window.__RN_EMBED_CONTROL__ && window.__RN_EMBED_CONTROL__.sync(${JSON.stringify(playbackState)}, ${playbackState === 'countdown' || playbackState === 'ready' ? 'true' : 'false'}, ${JSON.stringify(playbackPositionSeconds)}); true;`
          );
        }}
      />
      <Pressable
        style={styles.interactionBlocker}
        onPress={() => {}}
        android_disableSound
        accessible={false}
      />
    </View>
  );
}

export const YoutubeEmbedPlayer = React.memo(YoutubeEmbedPlayerComponent);

const styles = StyleSheet.create({
  playerShell: {
    flex: 1,
    backgroundColor: '#09090c',
  },
  webview: {
    flex: 1,
    backgroundColor: '#09090c',
  },
  interactionBlocker: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    flex: 1,
    backgroundColor: '#09090c',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fallbackTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  fallbackBody: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  fallbackButton: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4242',
  },
  fallbackButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
