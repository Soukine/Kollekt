import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, AlertCircle, RefreshCw, Zap, X } from 'lucide-react';

interface QrCameraScannerProps {
  active: boolean;
  onScan: (decodedText: string) => void;
  onError?: (errorMessage: string) => void;
  onClose?: () => void;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({
  active,
  onScan,
  onError,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ text: string; time: number } | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const now = Date.now();
        // Prevent repeat scanning the same token within 2 seconds
        if (
          !lastScannedRef.current ||
          lastScannedRef.current.text !== code.data ||
          now - lastScannedRef.current.time > 2000
        ) {
          lastScannedRef.current = { text: code.data, time: now };
          if (navigator.vibrate) {
            try {
              navigator.vibrate([40, 30, 40]);
            } catch {
              // Ignore vibration failure
            }
          }
          onScan(code.data);
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [onScan]);

  const startStream = useCallback(async () => {
    stopStream();
    setErrorMessage(null);

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = 'Caméra non supportée par ce navigateur ou environnement sécurisé (HTTPS requis).';
      setErrorMessage(err);
      setHasPermission(false);
      onError?.(err);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() as { torch?: boolean }) || {};
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        animFrameRef.current = requestAnimationFrame(tick);
      }
    } catch (err: unknown) {
      let friendlyError = 'Accès à la caméra refusé ou non disponible. Veuillez autoriser la caméra dans votre navigateur ou utiliser la saisie manuelle ci-dessous.';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          friendlyError = 'Permission caméra refusée par l’utilisateur ou le navigateur. Activez l’accès à la caméra ou utilisez la saisie manuelle.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          friendlyError = 'Aucune caméra détectée sur cet appareil. Utilisez la saisie manuelle ci-dessous.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          friendlyError = 'La caméra est déjà utilisée par une autre application. Veuillez fermer les autres onglets ou saisir le pass manuellement.';
        }
      }
      setErrorMessage(friendlyError);
      setHasPermission(false);
      onError?.(friendlyError);
    }
  }, [facingMode, onError, stopStream, tick]);

  useEffect(() => {
    if (active) {
      startStream();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [active, startStream, stopStream]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const newTorch = !isTorchOn;
        await (track as MediaStreamTrack & { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: newTorch }],
        });
        setIsTorchOn(newTorch);
      } catch {
        // Torch toggle failed
      }
    }
  };

  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!active) return null;

  return (
    <div className="relative rounded-2xl bg-[#1A1715] border-2 border-[#FF765F]/40 overflow-hidden min-h-[220px] flex flex-col items-center justify-center">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {errorMessage ? (
        <div className="p-5 text-center flex flex-col items-center max-w-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center">
            <CameraOff className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-red-300">Caméra indisponible</h4>
            <p className="text-[11px] text-[#A9A39D] mt-1 leading-relaxed">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={startStream}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#F7F4F0] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Réessayer</span>
          </button>
        </div>
      ) : (
        <div className="relative w-full h-[220px] flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Scanner Overlay & Sight box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened edges */}
            <div className="w-48 h-48 border-2 border-[#FF765F] rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#FF765F] rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#FF765F] rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#FF765F] rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#FF765F] rounded-br" />

              {/* Animated Laser beam */}
              <div className="absolute left-2 right-2 h-0.5 bg-[#FF765F] shadow-[0_0_10px_#FF765F] animate-bounce top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md transition-colors cursor-pointer ${
                  isTorchOn ? 'bg-amber-400 text-black' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
                title="Activer la torche"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={flipCamera}
              className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-colors cursor-pointer"
              title="Changer de caméra"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-colors cursor-pointer"
                title="Fermer la caméra"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="absolute bottom-2 left-0 right-0 text-center z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-bold text-[#F7F4F0] border border-white/10">
              Cadrez le QR Code client au centre
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
