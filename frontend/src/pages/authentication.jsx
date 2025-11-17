import * as React from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { AuthContext } from '../contexts/AuthContext.jsx'
import "../App.css";

export default function Authentication() {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [formState, setFormState] = React.useState(0);
    const [open, setOpen] = React.useState(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    let handleAuth = async () => {
        try {
            if (formState === 0) {
                await handleLogin(username, password);
            }
            if (formState === 1) {
                let result = await handleRegister(name, username, password);
                setUsername("");
                setMessage(result);
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
            }
        } catch (err) {
            let msg = err.response ? err.response.data.message : "Network error";
            setError(msg);
        }
    }

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--bg-gradient)' 
        }}>
            <Paper className="glass-panel" style={{ 
                padding: '3rem', 
                borderRadius: '32px', 
                width: '100%', 
                maxWidth: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <img src="/logo.png" alt="Logo" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: '1.5rem', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }} />
                
                <h2 style={{ margin: '0 0 2rem 0', fontSize: '1.8rem' }}>
                    {formState === 0 ? "Welcome Back" : "Join Juncture"}
                </h2>

                <div style={{ width: '100%', display: 'flex', gap: 10, marginBottom: 20, background: '#f1f2f6', padding: 4, borderRadius: 12 }}>
                    <Button 
                        fullWidth 
                        onClick={() => setFormState(0)}
                        style={{ borderRadius: 10, background: formState === 0 ? 'white' : 'transparent', color: formState === 0 ? 'black' : '#888', boxShadow: formState === 0 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        Sign In
                    </Button>
                    <Button 
                        fullWidth 
                        onClick={() => setFormState(1)}
                        style={{ borderRadius: 10, background: formState === 1 ? 'white' : 'transparent', color: formState === 1 ? 'black' : '#888', boxShadow: formState === 1 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        Sign Up
                    </Button>
                </div>

                <Box component="form" noValidate sx={{ width: '100%' }}>
                    {formState === 1 && (
                        <TextField
                            margin="normal" required fullWidth label="Full Name"
                            className="input-minimal"
                            onChange={(e) => setName(e.target.value)}
                            variant="outlined"
                        />
                    )}
                    <TextField
                        margin="normal" required fullWidth label="Username"
                        className="input-minimal"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        variant="outlined"
                    />
                    <TextField
                        margin="normal" required fullWidth label="Password"
                        type="password"
                        className="input-minimal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        variant="outlined"
                    />
                    
                    {error && <p style={{ color: "#ff4757", textAlign:'center', fontSize: '0.9rem' }}>{error}</p>}
                    
                    <Button
                        type="button"
                        fullWidth
                        className="btn-primary"
                        sx={{ mt: 3, mb: 2 }}
                        onClick={handleAuth}
                    >
                        {formState === 0 ? "Sign In" : "Create Account"}
                    </Button>
                </Box>
            </Paper>
            <Snackbar open={open} autoHideDuration={4000} message={message} onClose={() => setOpen(false)} />
        </div>
    );
}