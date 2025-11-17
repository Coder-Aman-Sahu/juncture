import React, { useState, useContext } from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import { IconButton, Button, TextField, Typography, Paper } from '@mui/material';
import { History, Logout, AddLink, Keyboard } from '@mui/icons-material';
import { AuthContext } from '../contexts/AuthContext';
import "../App.css";

function HomeComponent() {
    let navigate = useNavigate();
    const { addToUserHistory } = useContext(AuthContext);
    const [meetingCode, setMeetingCode] = useState("");

    const handleJoin = async () => {
        if (!meetingCode) return;
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`);
    }

    const createMeeting = async () => {
        const code = Math.random().toString(36).substring(2, 8);
        await addToUserHistory(code);
        navigate(`/${code}`);
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
            <nav className="navBar">
                <div className="logoBox">
                    <img src="/logo.png" alt="Logo" className="logoImage" style={{ height: 32 }} />
                    <span className="logoText" style={{fontSize: '1.2rem'}}>Juncture</span>
                </div>
                <div style={{ display: "flex", gap: '10px' }}>
                    <IconButton onClick={() => navigate('/history')} title="History">
                        <History style={{color: 'var(--text-main)'}} />
                    </IconButton>
                    <IconButton onClick={() => {localStorage.removeItem('token'); navigate('/auth')}} title="Logout">
                        <Logout style={{color: '#ff4757'}} />
                    </IconButton>
                </div>
            </nav>

            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '80vh',
                padding: '2rem'
            }}>
                <Paper className="glass-panel" style={{ 
                    padding: '3rem', 
                    borderRadius: '32px', 
                    width: '100%', 
                    maxWidth: '500px',
                    textAlign: 'center'
                }}>
                    <img src="/logo.png" alt="Logo" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: '1.5rem' }} />
                    
                    <Typography variant="h4" fontWeight="800" gutterBottom>
                        Welcome back.
                    </Typography>
                    <Typography color="textSecondary" paragraph style={{ marginBottom: '2.5rem' }}>
                        Start a new conversation or join one.
                    </Typography>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <Button 
                            fullWidth 
                            className="btn-primary" 
                            size="large"
                            startIcon={<AddLink />}
                            onClick={createMeeting}
                            style={{ height: '56px' }}
                        >
                            New Meeting
                        </Button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
                            <div style={{ flex: 1, height: 1, background: '#e1e1e1' }}></div>
                            <span style={{ color: '#ccc', fontSize: '0.9rem' }}>OR</span>
                            <div style={{ flex: 1, height: 1, background: '#e1e1e1' }}></div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <TextField 
                                className="input-minimal"
                                fullWidth
                                placeholder="Enter code (e.g. abc-xyz)"
                                value={meetingCode}
                                onChange={(e) => setMeetingCode(e.target.value)}
                                InputProps={{
                                    startAdornment: <Keyboard style={{ color: '#ccc', marginRight: 8 }} />
                                }}
                            />
                            <Button 
                                variant="contained" 
                                disabled={!meetingCode}
                                onClick={handleJoin}
                                style={{ 
                                    background: 'var(--text-main)', 
                                    color: 'white', 
                                    borderRadius: '16px',
                                    minWidth: '80px'
                                }}
                            >
                                Join
                            </Button>
                        </div>
                    </div>
                </Paper>
            </div>
        </div>
    )
}
export default withAuth(HomeComponent)