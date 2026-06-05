import { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import './Profile.css';

function Profile() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    avatar: '',
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const [profileData, statsData, historyData] = await Promise.all([
        userService.getProfile(),
        userService.getStats(),
        userService.getHistory(1, 10),
      ]);
      setProfile(profileData);
      setStats(statsData);
      setHistory(historyData.games || []);
      setFormData({
        username: profileData.username || '',
        email: profileData.email || '',
        avatar: profileData.avatar || '',
      });
    } catch (err) {
      setError('Failed to load profile data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await userService.updateProfile(formData);
      setProfile({ ...profile, ...formData });
      setEditMode(false);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      username: profile?.username || '',
      email: profile?.email || '',
      avatar: profile?.avatar || '',
    });
    setEditMode(false);
  };

  if (loading && !profile) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        {editMode ? (
          <div className="edit-profile-form">
            <h2>Edit Profile</h2>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Avatar URL:</label>
              <input
                type="text"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
              <button className="btn btn-outline" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <div className="avatar">
              <img
                src={profile?.avatar || '/default-avatar.png'}
                alt="Avatar"
              />
            </div>
            <h2>{profile?.username || 'Guest'}</h2>
            <p>{profile?.email || 'No email set'}</p>
            <button
              className="btn btn-secondary"
              onClick={() => setEditMode(true)}
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {stats && (
        <div className="stats-section">
          <h3>Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.totalGames || 0}</span>
              <span className="stat-label">Total Games</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.wins || 0}</span>
              <span className="stat-label">Wins</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {stats.winRate ? `${Math.round(stats.winRate)}%` : '0%'}
              </span>
              <span className="stat-label">Win Rate</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.highScore || 0}</span>
              <span className="stat-label">High Score</span>
            </div>
          </div>
        </div>
      )}

      <div className="history-section">
        <h3>Game History</h3>
        {history.length === 0 ? (
          <p className="no-history">No games played yet</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Score</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {history.map((game, index) => (
                <tr key={index}>
                  <td>{new Date(game.date).toLocaleDateString()}</td>
                  <td>{game.mode}</td>
                  <td>{game.score}</td>
                  <td className={game.result === 'win' ? 'win' : 'loss'}>
                    {game.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Profile;
