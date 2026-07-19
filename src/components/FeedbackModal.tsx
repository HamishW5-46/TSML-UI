import { FormEvent, useEffect, useRef, useState } from 'react';

import { buttonCss, formControlCss } from '../styles';
import { useSettings } from '../hooks';
import type { Meeting } from '../types';

type TurnstileOptions = {
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
  sitekey: string;
  theme: 'auto';
};

declare global {
  interface Window {
    turnstile?: {
      remove: (widgetId: string) => void;
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | undefined;

function loadTurnstileScript() {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('cf-turnstile-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error()), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'cf-turnstile-script';
    script.async = true;
    script.defer = true;
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error()), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function FeedbackModal({
  meeting,
  meetingTime,
  onClose,
  open,
}: {
  meeting: Meeting;
  meetingTime?: string;
  onClose: () => void;
  open: boolean;
}) {
  const { settings, strings } = useSettings();
  const [error, setError] = useState<string>();
  const [loadedAt, setLoadedAt] = useState(Math.floor(Date.now() / 1000));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const firstInput = useRef<HTMLInputElement>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileWidget = useRef<string>();

  const publicUrl = settings.feedback_public_origin
    ? `${settings.feedback_public_origin.replace(/\/$/, '')}/${meeting.slug}`
    : (meeting.url ?? window.location.href);
  const turnstileSiteKey = settings.feedback_form?.turnstile_site_key;

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(undefined);
    setLoadedAt(Math.floor(Date.now() / 1000));
    setSending(false);
    setSent(false);
    setTurnstileToken('');
    setTimeout(() => firstInput.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !turnstileSiteKey) {
      return;
    }

    let cancelled = false;
    setTurnstileToken('');

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !turnstileContainer.current || !window.turnstile) {
          return;
        }

        turnstileWidget.current = window.turnstile.render(
          turnstileContainer.current,
          {
            callback: token => setTurnstileToken(token),
            'error-callback': () => {
              setTurnstileToken('');
              setError(strings.feedback_turnstile_error);
            },
            'expired-callback': () => setTurnstileToken(''),
            sitekey: turnstileSiteKey,
            theme: 'auto',
          }
        );
      })
      .catch(() => setError(strings.feedback_turnstile_error));

    return () => {
      cancelled = true;
      if (turnstileWidget.current && window.turnstile) {
        window.turnstile.remove(turnstileWidget.current);
        turnstileWidget.current = undefined;
      }
    };
  }, [open, strings.feedback_turnstile_error, turnstileSiteKey]);

  if (!open || !settings.feedback_form) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setSending(true);

    if (turnstileSiteKey && !turnstileToken) {
      setError(strings.feedback_turnstile_error);
      setSending(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set('action', settings.feedback_form.action);
    formData.set('nonce', settings.feedback_form.nonce);
    formData.set('cf-turnstile-response', turnstileToken);
    formData.set('loaded_at', `${loadedAt}`);
    formData.set('meeting_slug', meeting.slug);
    formData.set('meeting_name', meeting.name);
    formData.set('meeting_url', publicUrl);
    formData.set('meeting_time', meetingTime ?? '');
    formData.set('meeting_location', meeting.location ?? meeting.group ?? '');
    formData.set('meeting_address', meeting.formatted_address ?? '');
    formData.set('meeting_region', meeting.regions?.join(' > ') ?? '');

    try {
      const response = await fetch(settings.feedback_form.endpoint, {
        body: formData,
        credentials: 'same-origin',
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.data?.message ?? strings.feedback_error);
      }
      setSent(true);
    } catch (error) {
      if (turnstileWidget.current && window.turnstile) {
        window.turnstile.reset(turnstileWidget.current);
        setTurnstileToken('');
      }
      setError(error instanceof Error ? error.message : strings.feedback_error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      css={{
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        padding: '1rem',
        position: 'fixed',
        zIndex: 100000,
      }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        role="dialog"
        aria-labelledby="tsml-feedback-title"
        css={{
          backgroundColor: 'var(--background)',
          borderRadius: 'var(--border-radius)',
          boxShadow: '0 1rem 3rem rgba(0, 0, 0, 0.24)',
          color: 'var(--text)',
          maxHeight: 'calc(100dvh - 2rem)',
          maxWidth: '42rem',
          overflowY: 'auto',
          padding: '1rem',
          width: '100%',
        }}
      >
        <div
          css={{
            alignItems: 'start',
            display: 'flex',
            gap: '1rem',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 id="tsml-feedback-title">{strings.feedback_form_title}</h2>
            <p>{meeting.name}</p>
          </div>
          <button
            aria-label={strings.close}
            css={[buttonCss, { flex: '0 0 auto', width: 'auto' }]}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {sent ? (
          <div css={{ display: 'grid', gap: '1rem' }}>
            <p>{strings.feedback_success}</p>
            <button css={buttonCss} onClick={onClose} type="button">
              {strings.close}
            </button>
          </div>
        ) : (
          <form css={{ display: 'grid', gap: '0.75rem' }} onSubmit={submit}>
            <label css={{ display: 'grid', gap: '0.25rem' }}>
              <span>{strings.feedback_name}</span>
              <input
                css={formControlCss}
                maxLength={120}
                name="name"
                ref={firstInput}
                required
              />
            </label>
            <label css={{ display: 'grid', gap: '0.25rem' }}>
              <span>{strings.feedback_email}</span>
              <input
                css={formControlCss}
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
            <label css={{ display: 'grid', gap: '0.25rem' }}>
              <span>{strings.feedback_phone}</span>
              <input
                css={formControlCss}
                maxLength={80}
                name="phone"
                type="tel"
              />
            </label>
            <label css={{ display: 'grid', gap: '0.25rem' }}>
              <span>{strings.feedback_message}</span>
              <textarea
                css={[
                  formControlCss,
                  {
                    minHeight: '9rem',
                    resize: 'vertical',
                    whiteSpace: 'normal',
                  },
                ]}
                maxLength={5000}
                name="message"
                required
              />
            </label>
            <input
              autoComplete="off"
              css={{ display: 'none' }}
              name="website"
              tabIndex={-1}
            />
            {turnstileSiteKey && (
              <div css={{ minHeight: '65px' }} ref={turnstileContainer} />
            )}
            {error && <p css={{ color: 'var(--inactive)' }}>{error}</p>}
            <div css={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                css={[buttonCss, { flex: '1 1 12rem' }]}
                disabled={sending || (!!turnstileSiteKey && !turnstileToken)}
                type="submit"
              >
                {sending ? strings.feedback_sending : strings.feedback_submit}
              </button>
              <button
                css={[buttonCss, { flex: '1 1 12rem' }]}
                onClick={onClose}
                type="button"
              >
                {strings.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
