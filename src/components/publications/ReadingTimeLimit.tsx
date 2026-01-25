import { useState, useEffect, useCallback } from "react";
import { Clock, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentInstructions } from "./PaymentInstructions";

const READING_LIMIT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // Show warning at 5 minutes remaining
const STORAGE_KEY = "plume_dor_reading_session";

interface ReadingSession {
  startTime: number;
  elapsedTime: number;
  lastActiveTime: number;
}

interface ReadingTimeLimitProps {
  publicationId: string;
  onTimeExpired: () => void;
}

export function ReadingTimeLimit({ publicationId, onTimeExpired }: ReadingTimeLimitProps) {
  const [remainingTime, setRemainingTime] = useState<number>(READING_LIMIT_MS);
  const [showWarning, setShowWarning] = useState(false);
  const [showExpiredDialog, setShowExpiredDialog] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const getSession = useCallback((): ReadingSession | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }, []);

  const saveSession = useCallback((session: ReadingSession) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const initializeSession = useCallback(() => {
    const existing = getSession();
    const now = Date.now();

    if (existing) {
      // Check if session is from more than 24 hours ago - reset if so
      if (now - existing.lastActiveTime > 24 * 60 * 60 * 1000) {
        const newSession: ReadingSession = {
          startTime: now,
          elapsedTime: 0,
          lastActiveTime: now,
        };
        saveSession(newSession);
        return newSession;
      }
      return existing;
    }

    const newSession: ReadingSession = {
      startTime: now,
      elapsedTime: 0,
      lastActiveTime: now,
    };
    saveSession(newSession);
    return newSession;
  }, [getSession, saveSession]);

  useEffect(() => {
    const session = initializeSession();
    const initialRemaining = READING_LIMIT_MS - session.elapsedTime;
    
    if (initialRemaining <= 0) {
      setRemainingTime(0);
      setShowExpiredDialog(true);
      onTimeExpired();
      return;
    }

    setRemainingTime(initialRemaining);

    const interval = setInterval(() => {
      if (!isActive) return;

      const currentSession = getSession();
      if (!currentSession) return;

      const newElapsedTime = currentSession.elapsedTime + 1000;
      const newRemaining = READING_LIMIT_MS - newElapsedTime;

      saveSession({
        ...currentSession,
        elapsedTime: newElapsedTime,
        lastActiveTime: Date.now(),
      });

      setRemainingTime(newRemaining);

      if (newRemaining <= WARNING_THRESHOLD_MS && newRemaining > 0) {
        setShowWarning(true);
      }

      if (newRemaining <= 0) {
        setShowExpiredDialog(true);
        onTimeExpired();
        clearInterval(interval);
      }
    }, 1000);

    // Pause timer when tab is hidden
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initializeSession, getSession, saveSession, isActive, onTimeExpired]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const isLowTime = remainingTime <= WARNING_THRESHOLD_MS;

  return (
    <>
      {/* Timer display */}
      <div
        className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
          isLowTime
            ? "bg-destructive text-destructive-foreground animate-pulse"
            : "bg-background/95 backdrop-blur-sm border border-border text-foreground"
        }`}
      >
        <Clock className="h-4 w-4" />
        <span className="font-mono text-sm font-medium">
          {formatTime(remainingTime)}
        </span>
        {isLowTime && (
          <span className="text-xs">restantes</span>
        )}
      </div>

      {/* Warning notification */}
      {showWarning && remainingTime > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top-2">
          <div className="bg-amber-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Temps de lecture limité</p>
              <p className="text-xs mt-1 opacity-90">
                Il vous reste {formatTime(remainingTime)} de lecture gratuite. 
                Payez pour un accès illimité.
              </p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="text-white/80 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Expired dialog */}
      <Dialog open={showExpiredDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="text-center text-xl">
              Temps de lecture écoulé
            </DialogTitle>
            <DialogDescription className="text-center">
              Votre session de lecture gratuite de 30 minutes est terminée.
              Pour continuer à lire et télécharger ce document, veuillez effectuer le paiement.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <PaymentInstructions />
          </div>

          <div className="mt-4 text-center">
            <Button variant="outline" className="border-border" onClick={() => window.location.href = "/bibliotheque"}>
              Retour à la bibliothèque
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
