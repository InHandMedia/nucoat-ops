import React, { useState } from 'react';
import { supabase, isDemo } from '../supabaseClient.js';
import { roleLabel } from '../constants.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="mark">NC</div>
        <h1 className="disp">NuCoat Ops</h1>
        {isDemo ? (
          <>
            <p>Demo mode with sample data. Pick who to look at the app as.</p>
            <div className="demo-picker">
              {supabase.demoUsers.map((u) => (
                <button key={u.id} className="btn accent" onClick={() => supabase.demoSignInAs(u.id)}>
                  {u.display_name} <small>{roleLabel(u.role)}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p>Sign in with your own account.</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <div className="error">{error}</div>}
              <button className="btn accent" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
