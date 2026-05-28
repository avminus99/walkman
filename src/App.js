import { useEffect, useState, useRef } from 'react';
import './App.css';
import walkmanImage from './walkman_image.png';

function App() {
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(sessionStorage.getItem('refresh_token'));
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const activeTrackRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (accessToken) {
      sessionStorage.setItem('spotify_token', accessToken);
      setToken(accessToken);
      if (refresh) {
        sessionStorage.setItem('refresh_token', refresh);
        setRefreshToken(refresh);
      }
      window.history.replaceState({}, document.title, '/');
    } else {
      const saved = sessionStorage.getItem('spotify_token');
      const savedRefresh = sessionStorage.getItem('refresh_token');
      if (saved) setToken(saved);
      if (savedRefresh) setRefreshToken(savedRefresh);
    }
  }, []);

  // Auto-refresh token every 50 minutes
  useEffect(() => {
    if (!refreshToken) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/auth/refresh?refresh_token=${refreshToken}`);
      const data = await res.json();
      if (data.access_token) {
        sessionStorage.setItem('spotify_token', data.access_token);
        setToken(data.access_token);
      }
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshToken]);

  useEffect(() => {
    if (!token) return;
    fetch(`https://api.spotify.com/v1/playlists/2t69U9hSF47cYrZFNnQAGr/items`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error.message); return; }
        const tracks = data.items.map(i => i.item || i.track).filter(Boolean);
        setPlaylistTracks(tracks);
      })
      .catch(err => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Walkman Simulator',
        getOAuthToken: cb => cb(token),
        volume: 0.5
      });
      spotifyPlayer.addListener('ready', ({ device_id }) => setDeviceId(device_id));
      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;
        setCurrentTrack(state.track_window.current_track);
        setIsPaused(state.paused);
      });
      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };
  }, [token]);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(async () => {
      const state = await player.getCurrentState();
      if (!state) return;
      setProgress((state.position / state.duration) * 100);
      setPosition(state.position);
      setDuration(state.duration);
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentTrack]);

  const formatTime = (ms) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playPlaylist = async () => {
    const randomIndex = Math.floor(Math.random() * playlistTracks.length);
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context_uri: `spotify:playlist:2t69U9hSF47cYrZFNnQAGr`,
        offset: { position: randomIndex }
      })
    });
  };

  const playTrack = async (uri) => {
    const trackIndex = playlistTracks.findIndex(t => t.uri === uri);

    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context_uri: `spotify:playlist:2t69U9hSF47cYrZFNnQAGr`,
        offset: { position: trackIndex }
      })
    });
  };

  const logout = () => {
    sessionStorage.removeItem('spotify_token');
    sessionStorage.removeItem('refresh_token');
    setToken(null);
    setRefreshToken(null);
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: '#1a1a2e', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ color: 'white', fontSize: '2rem' }}>🎵 Walkman Simulator</h1>
        <a href="/auth/login">
          <button style={{ padding: '12px 32px', background: '#ff6b9d', color: 'white',
            border: 'none', borderRadius: '25px', fontSize: '1rem', cursor: 'pointer' }}>
            Login with Spotify
          </button>
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1a1a2e',
      color: 'white', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '300px' : '0',
        minWidth: sidebarOpen ? '300px' : '0',
        background: '#0d0d1a',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #2a2a4a'
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #2a2a4a', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>🎵 Fav Songs</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#888' }}>
                {playlistTracks.length} tracks
              </p>
            </div>
            <button onClick={playPlaylist}
              style={{ background: '#ff6b9d', border: 'none', borderRadius: '50%',
                width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: 'white' }}>
              ▶
            </button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {playlistTracks.length === 0 && (
            <p style={{ color: '#888', padding: '20px', textAlign: 'center' }}>Loading tracks...</p>
          )}
          {playlistTracks.map((track, index) => {
            const isPlaying = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                ref={isPlaying ? activeTrackRef : null}
                onClick={() => playTrack(track.uri)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '8px 16px', cursor: 'pointer',
                  background: isPlaying ? 'rgba(255,107,157,0.15)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isPlaying) e.currentTarget.style.background = '#1a1a3a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isPlaying ? 'rgba(255,107,157,0.15)' : 'transparent'; }}
              >
                <div style={{ width: '20px', textAlign: 'center', flexShrink: 0 }}>
                  {isPlaying
                    ? <span style={{ color: '#ff6b9d' }}>♪</span>
                    : <span style={{ color: '#666', fontSize: '0.8rem' }}>{index + 1}</span>}
                </div>
                <img src={track.album.images[2]?.url || track.album.images[0]?.url}
                  alt="album" width={40} height={40} style={{ borderRadius: '4px', flexShrink: 0 }} />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', color: isPlaying ? '#ff6b9d' : 'white',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#888',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.artists.map(a => a.name).join(', ')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: sidebarOpen ? '300px' : '0',
          right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 24px', borderBottom: '1px solid #2a2a4a', transition: 'left 0.3s' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: 'white',
              fontSize: '1rem', cursor: 'pointer' }}>
            {sidebarOpen ? '◀' : '▶'} Playlist
          </button>
          <button onClick={logout}
            style={{ background: 'none', border: '1px solid #444', color: '#888',
              padding: '6px 16px', borderRadius: '25px', cursor: 'pointer', fontSize: '0.8rem' }}>
            Logout
          </button>
        </div>

        {/* Walkman Image Container */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={walkmanImage} alt="walkman"
            style={{ width: '800px', userSelect: 'none' }} />

          {/* LCD Screen Overlay */}
          <div style={{
            position: 'absolute',
            top: '26%',
            left: '22.5%',
            width: '170px',
            height: '66px',
            background: 'rgba(20, 35, 20, 1)',
            borderRadius: '4px',
            padding: '4px 6px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            {currentTrack ? (
              <>
                <div style={{ color: '#000', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 'bold',
                  background: 'rgba(255,255,255,0.8)', marginBottom: '1px', padding: '2px',
                  width: 'fit-content', borderRadius: '2px' }}>
                  {isPaused ? '⏸ PAUSED' : '▶ PLAYING'}
                </div>

                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                  {currentTrack.name.length > 18 ? (
                    <span className="marquee" style={{ color: '#fff', fontSize: '0.85rem',
                      fontFamily: 'monospace', fontWeight: 'bold' }}>♫&nbsp;
                      {currentTrack.name}&nbsp;&nbsp;&nbsp;
                    </span>
                  ) : (
                    <span style={{ color: '#fff', fontSize: '0.85rem',
                      fontFamily: 'monospace', fontWeight: 'bold' }}>♫&nbsp;
                      {currentTrack.name}
                    </span>
                  )}
                </div>

                <div style={{ color: '#fff', fontSize: '0.7rem', fontFamily: 'monospace',
                  marginTop: '2px', opacity: 0.9, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.artists[0].name}
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '4px', width: '100%', height: '3px',
                  background: 'rgba(127,255,127,0.2)', borderRadius: '2px' }}>
                  <div style={{
                    height: '100%', background: '#fff', borderRadius: '2px',
                    width: `${progress}%`, transition: 'width 1s linear'
                  }} />
                </div>

                {/* Duration */}
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  marginTop: '2px', color: '#fff', fontSize: '0.5rem', fontFamily: 'monospace' }}>
                  <span>{formatTime(position)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </>
            ) : (
              <div style={{ color: '#fff', fontSize: '0.75rem', fontFamily: 'monospace',
                textAlign: 'center' }}>
                Hi Drishya! <br /> Select a track to play
              </div>
            )}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() => player?.togglePlay()}
            onMouseDown={e => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.95)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translate(-50%, -50%)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translate(-50%, -50%)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            style={{ position: 'absolute', top: '49.2%', left: '68%',
              transform: 'translate(-50%, -50%)', background: 'transparent',
              border: 'none', borderRadius: '50%', width: '80px', height: '80px',
              cursor: 'pointer', color: 'transparent', transition: 'all 0.1s ease' }}>
          </button>

          {/* Skip Back - bottom of wheel */}
          <button
            onClick={() => fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${deviceId}`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}` }
            })}
            onMouseDown={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5)'; }}
            onMouseUp={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            style={{ position: 'absolute', top: '80%', left: '68%', transform: 'translate(-50%, -50%)',
              background: 'transparent', border: 'none', borderRadius: '4px',
              width: '40px', height: '30px', cursor: 'pointer', color: 'transparent',
              zIndex: 10, transition: 'all 0.1s ease' }}>
          ⏮</button>

          {/* Skip Forward - top of wheel */}
          <button
            onClick={() => fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}` }
            })}
            onMouseDown={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5)'; }}
            onMouseUp={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
            style={{ position: 'absolute', top: '18.75%', left: '68%', transform: 'translate(-50%, -50%)',
              background: 'transparent', border: 'none', borderRadius: '4px',
              width: '40px', height: '30px', cursor: 'pointer', color: 'transparent',
              zIndex: 10, transition: 'all 0.1s ease' }}>
          ⏭</button>

          {/* ZAP button */}
          <button onClick={playPlaylist}
            onMouseDown={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.95)'; e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.5)'; }}
            onMouseUp={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translate(-50%, -50%)'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translate(-50%, -50%)'; e.currentTarget.style.boxShadow = 'none'; }}
            style={{ position: 'absolute', top: '22%', left: '51.5%', transform: 'translate(-50%, -50%)',
              background: 'transparent', border: 'none', borderRadius: '50%',
              width: '60px', height: '60px', cursor: 'pointer', color: 'transparent',
              zIndex: 10, transition: 'all 0.1s ease' }}>
          ZAP</button>

          {/* Volume Up button */}
          <button
            onClick={() => { const v = Math.min(1, volume + 0.1); setVolume(v); player?.setVolume(v); }}
            onMouseDown={e => {
              e.currentTarget.style.height = '8px';
              e.currentTarget.style.marginTop = '1px';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.height = '10px';
              e.currentTarget.style.marginTop = '0px';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.height = '10px';
              e.currentTarget.style.marginTop = '0px';
            }}
            style={{ position: 'absolute', top: '-0.1%', left: '35%', transform: 'translate(-50%, -50%)',
              background: 'rgba(220,225,235,1)', border: '1px solid rgba(180,185,195,0.8)', borderRadius: '4px',
              width: '60px', height: '10px', cursor: 'pointer', color: 'transparent',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 10, transition: 'height 0.1s ease, margin-top 0.1s ease' }}>
          </button>

          {/* Volume Down button */}
          <button
            onClick={() => { const v = Math.max(0, volume - 0.1); setVolume(v); player?.setVolume(v); }}
            onMouseDown={e => {
              e.currentTarget.style.height = '8px';
              e.currentTarget.style.marginTop = '1px';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.height = '10px';
              e.currentTarget.style.marginTop = '0px';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.height = '10px';
              e.currentTarget.style.marginTop = '0px';
            }}
            style={{ position: 'absolute', top: '-0.4%', left: '46%', transform: 'translate(-50%, -50%)',
              background: 'rgba(220,225,235,1)', border: '1px solid rgba(180,185,195,0.8)', borderRadius: '4px',
              width: '60px', height: '10px', cursor: 'pointer', color: 'transparent',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
              zIndex: 10, transition: 'height 0.1s ease, margin-top 0.1s ease' }}>
          </button>

        </div>

        {error && (
          <div style={{ marginTop: '12px', color: '#ff4444', fontSize: '0.85rem' }}>
            ⚠️ {error}
            <button onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', color: '#ff4444',
                cursor: 'pointer', marginLeft: '8px' }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;