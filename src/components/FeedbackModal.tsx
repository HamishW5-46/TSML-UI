import { FormEvent, useEffect, useRef, useState } from 'react';

import { buttonCss, formControlCss } from '../styles';
import { useSettings } from '../hooks';
import type { Meeting } from '../types';

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
  const firstInput = useRef<HTMLInputElement>(null);

  const publicUrl = settings.feedback_public_origin
    ? `${settings.feedback_public_origin.replace(/\/$/, '')}/${meeting.slug}`
    : (meeting.url ?? window.location.href);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(undefined);
    setLoadedAt(Math.floor(Date.now() / 1000));
    setSending(false);
    setSent(false);
    setTimeout(() => firstInput.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || !settings.feedback_form) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setSending(true);

    const formData = new FormData(event.currentTarget);
    formData.set('action', settings.feedback_form.action);
    formData.set('nonce', settings.feedback_form.nonce);
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
            {error && <p css={{ color: 'var(--inactive)' }}>{error}</p>}
            <div css={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                css={[buttonCss, { flex: '1 1 12rem' }]}
                disabled={sending}
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
