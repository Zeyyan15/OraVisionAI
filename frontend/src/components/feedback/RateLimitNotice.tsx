/**
 * OraVisionAI — HTTP 429 Rate Limit Cooldown Banner
 * Active countdown timer driving client-side cooldown notices.
 */

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Alert } from '../ui/Alert';

export interface RateLimitNoticeProps {
  initialSeconds: number;
  onCooldownComplete?: () => void;
}

export const RateLimitNotice: React.FC<RateLimitNoticeProps> = ({
  initialSeconds,
  onCooldownComplete,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialSeconds);

  useEffect(() => {
    setSecondsRemaining(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      if (onCooldownComplete) {
        onCooldownComplete();
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, onCooldownComplete]);

  if (secondsRemaining <= 0) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      icon={Clock}
      title="Request Cooldown in Progress"
      className="my-3"
    >
      To preserve clinical AI service stability, requests are temporarily throttled. Normal operation will resume in <strong>{secondsRemaining}s</strong>.
    </Alert>
  );
};

export default RateLimitNotice;
