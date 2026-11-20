import { youtubeVideoId } from "@mf/contracts";
import { useEffect, useRef, useState } from "react";

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
};

type YtNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YtPlayer }) => void;
        onStateChange?: (event: { data: number; target: YtPlayer }) => void;
        onError?: () => void;
      };
    },
  ) => YtPlayer;
  PlayerState: { UNSTARTED: number; ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YtNamespace> | null = null;

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => {
      reject(new Error("YouTube API 載入逾時"));
    }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previous?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube API 無法使用"));
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("無法載入 YouTube API"));
      };
      document.body.appendChild(script);
    }
    if (window.YT?.Player) {
      window.clearTimeout(timeout);
      resolve(window.YT);
    }
  });
  return apiPromise;
}

const MIN_REPORT_DURATION = 30;

export function YoutubeWatchPlayer({
  youtubeUrl,
  title,
  trackProgress,
  onProgress,
}: {
  youtubeUrl: string;
  title: string;
  trackProgress: boolean;
  onProgress: (watchedSeconds: number, videoDurationSeconds: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const onProgressRef = useRef(onProgress);
  const trackRef = useRef(trackProgress);
  const maxDurationRef = useRef(0);
  onProgressRef.current = onProgress;
  trackRef.current = trackProgress;
  const videoId = youtubeVideoId(youtubeUrl);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!videoId || !mountRef.current || useFallback) return;
    let cancelled = false;
    let timer: number | null = null;
    const host = document.createElement("div");
    host.className = "h-full w-full";
    mountRef.current.replaceChildren(host);

    function report(player: YtPlayer) {
      if (!trackRef.current) return;
      const seconds = Math.floor(player.getCurrentTime() || 0);
      const rawDuration = Math.floor(player.getDuration() || 0);
      if (rawDuration > maxDurationRef.current) maxDurationRef.current = rawDuration;
      const duration = maxDurationRef.current;
      if (seconds < 1 || duration < MIN_REPORT_DURATION) return;
      onProgressRef.current(Math.min(seconds, duration), duration);
    }

    void loadYoutubeApi().then((YT) => {
      if (cancelled || !host.isConnected) return;
      playerRef.current?.destroy();
      const player = new YT.Player(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady() {
            setError(null);
          },
          onStateChange(event) {
            if (event.data === YT.PlayerState.PLAYING) {
              if (timer != null) window.clearInterval(timer);
              timer = window.setInterval(() => report(event.target), 2000);
              report(event.target);
            } else if (timer != null) {
              window.clearInterval(timer);
              timer = null;
              if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                report(event.target);
              }
            }
          },
          onError() {
            setError("這支 YouTube 影片目前無法嵌入播放，請改貼可公開觀看的影片連結。");
            setUseFallback(true);
          },
        },
      });
      playerRef.current = player;
    }).catch(() => {
      if (!cancelled) {
        setError("無法載入 YouTube 播放器，改用一般嵌入。");
        setUseFallback(true);
      }
    });

    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      playerRef.current?.destroy();
      playerRef.current = null;
      maxDurationRef.current = 0;
    };
  }, [videoId, useFallback]);

  if (!videoId) {
    return <p className="text-sm text-[var(--muted)]">YouTube 連結格式不正確，請使用 youtube.com 或 youtu.be 影片網址。</p>;
  }

  return (
    <div className="space-y-2">
      <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
        {useFallback ? (
          <iframe
            title={title}
            className="h-full w-full border-0"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div ref={mountRef} className="h-full w-full" />
        )}
      </div>
      {error ? <p className="text-sm text-amber-900">{error}</p> : null}
      {useFallback && trackProgress ? (
        <p className="text-sm text-amber-900">目前改用一般嵌入，觀看進度可能無法累計。請改貼可公開嵌入的影片連結。</p>
      ) : null}
    </div>
  );
}
