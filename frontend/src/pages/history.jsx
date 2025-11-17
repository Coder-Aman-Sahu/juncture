import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { IconButton, Grid, Container } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import VideoCallIcon from '@mui/icons-material/VideoCall';

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([])
    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                if (Array.isArray(history)) {
                    setMeetings(history);
                } else {
                    // Handle error (e.g., invalid token)
                    console.error("Failed to fetch history:", history);
                    // Optional: Redirect to home or login if token is invalid
                    // routeTo("/home"); 
                }
            } catch { }
        }
        fetchHistory();
    }, [])

    let formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '2rem' }}>
            <Container maxWidth="md">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                    <IconButton onClick={() => routeTo("/home")} sx={{ marginRight: 2 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" fontWeight="bold">Meeting History</Typography>
                </div>

                <Grid container spacing={3}>
                    {(meetings?.length > 0) ? meetings.map((e, i) => {
                        return (
                            <Grid item xs={12} sm={6} md={4} key={i}>
                                <Card variant="elevation" sx={{ borderRadius: 3, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 3 } }}>
                                    <CardContent>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                                            <VideoCallIcon sx={{ color: '#FF9839', marginRight: 1 }} />
                                            <Typography variant="h6" component="div" fontWeight="bold">
                                                {e.meetingCode}
                                            </Typography>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', color: 'gray' }}>
                                            <CalendarTodayIcon fontSize="small" sx={{ marginRight: 1 }} />
                                            <Typography sx={{ fontSize: 14 }} color="text.secondary">
                                                {formatDate(e.date)}
                                            </Typography>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )
                    }) : (
                        <Grid item xs={12}>
                             <Typography align="center" color="text.secondary" sx={{ mt: 5 }}>
                                No meetings found. Join or start one!
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            </Container>
        </div>
    )
}