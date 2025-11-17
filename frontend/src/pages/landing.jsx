import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../App.css";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { ArrowForward, Keyboard } from '@mui/icons-material';

export default function LandingPage() {
    const router = useNavigate();
    const [joinCode, setJoinCode] = useState("");

    return (
        <div style={{ minHeight: '100vh', background: 'white' }}>
            <nav className="navBar">
                {/* UPDATED: Click logo to go to Home */}
                <div className="logoBox" onClick={() => router("/home")} style={{cursor: 'pointer'}}>
                    <img src="/logo.png" alt="Juncture Logo" className="logoImage" />
                    <span className="logoText">Juncture</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Button className="btn-secondary" onClick={() => router("/auth")}>Sign In</Button>
                    <Button className="btn-primary" onClick={() => router("/auth")}>Get Started</Button>
                </div>
            </nav>

            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textAlign: 'center', 
                padding: '6rem 2rem',
                maxWidth: '1000px',
                margin: '0 auto'
            }}>
                <div style={{ 
                    width: '120px', 
                    height: '120px', 
                    marginBottom: '2rem', 
                    borderRadius: '28px', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>

                <h1 style={{ 
                    fontSize: 'clamp(3rem, 8vw, 5rem)', 
                    fontWeight: 800, 
                    lineHeight: 1, 
                    margin: '0 0 1.5rem 0',
                    background: '-webkit-linear-gradient(45deg, #1d1d1f, #434344)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    Close the distance.
                </h1>
                
                <p style={{ 
                    fontSize: '1.4rem', 
                    color: 'var(--text-muted)', 
                    maxWidth: '600px', 
                    marginBottom: '3rem',
                    lineHeight: 1.5
                }}>
                    Experience video calls that feel like you're in the same room.
                    Crystal clear, secure, and beautifully simple.
                </p>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    <Button 
                        className="btn-primary" 
                        style={{ padding: '16px 40px', fontSize: '1.1rem' }}
                        onClick={() => {
                            const code = Math.random().toString(36).substring(2, 8);
                            router(`/${code}`);
                        }}
                        endIcon={<ArrowForward />}
                    >
                        Start Meeting
                    </Button>

                    {/* UPDATED: Join Meeting Inputs */}
                    <div style={{ display: 'flex', gap: '10px', background: '#f5f5f7', padding: '5px', borderRadius: '50px' }}>
                        <TextField 
                            placeholder="Enter code" 
                            variant="standard"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            InputProps={{ 
                                disableUnderline: true,
                                startAdornment: <Keyboard style={{ color: '#aaa', marginLeft: 15, marginRight: 5 }} />
                            }}
                            style={{ padding: '10px' }}
                        />
                        <Button 
                            className="btn-secondary"
                            disabled={!joinCode}
                            onClick={() => router(`/${joinCode}`)}
                            style={{ borderRadius: '40px', height: '100%' }}
                        >
                            Join
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}