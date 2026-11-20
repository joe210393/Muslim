import { youtubeVideoId } from "@mf/contracts";
import { useEffect, useRef } from "react";

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
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YtPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
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
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
    if (window.YT?.Player) resolve(window.YT);
  });
  return apiPromise;
}

export function YoutubeWatchPlayer({
  youtubeUrl,
  title,
  enabled,
  onProgress,
}: {
  youtubeUrl: string;
  title: string;
  enabled: boolean;
  onProgress: (watchedSeconds: number, videoDurationSeconds: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const videoId = youtubeVideoId(youtubeUrl);

  useEffect(() => {
    if (!enabled || !videoId || !hostRef.current) return;
    let cancelled = false;
    let timer: number | null = null;
    function report(player: YtPlayer) {
      const seconds = Math.floor(player.getCurrentTime() || 0);
      const duration = Math.floor(player.getDuration() || 0);
      if (seconds > 0 && duration > 0) onProgressRef.current(seconds, duration);
    }
    void loadYoutubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current?.destroy();
      const player = new YT.Player(hostRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange(event) {
            if (event.data === YT.PlayerState.PLAYING) {
              if (timer != null) window.clearInterval(timer);
              timer = window.setInterval(() => report(player), 2000);
            } else if (timer != null) {
              window.clearInterval(timer);
              timer = null;
              report(player);
            }
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [enabled, videoId]);

  if (!videoId) return null;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
      <div ref={hostRef} title={title} className="h-full w-full" />
    </div>
  );
}
