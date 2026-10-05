import React, { useState } from 'react';

// The Approve / Request changes controls. Calls the review_video database
// function, which is the only way a reviewer can change a video.
export default function ReviewBox({ video, onReview }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isScript = video.stage === 'client_approval';

  async function send(decision) {
    setBusy(true);
    await onReview(video.id, decision, note.trim());
    setBusy(false);
    setNote('');
  }

  return (
    <div className="mini-form">
      <textarea
        rows="2" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', marginBottom: '8px' }}
        placeholder={isScript ? 'Notes on the script (required if you request changes)' : 'Notes on the video (required if you request changes)'}
      />
      <div className="row-actions">
        <button className="btn sm accent" disabled={busy} onClick={() => send('approved')}>
          {isScript ? 'Approve script' : 'Approve video'}
        </button>
        <button className="btn sm ghost" disabled={busy || !note.trim()} onClick={() => send('changes')}>
          Request changes
        </button>
      </div>
    </div>
  );
}
