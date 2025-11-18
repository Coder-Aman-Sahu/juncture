import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Tooltip, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { 
    VideocamRounded, VideocamOffRounded, MicRounded, MicOffRounded, 
    CallEndRounded, ScreenShareRounded, StopScreenShareRounded, 
    ChatBubbleRounded, SendRounded, CloseRounded, ContentCopyRounded,
    FullscreenRounded, FullscreenExitRounded,
    PictureInPictureAltRounded, GridViewRounded,
    BackHandRounded, GetAppRounded, Check, Block // Added Check/Block icons
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import styles from "../styles/videoComponent.module.css";
import server from '../environment';

const server_url = `${server}`;

const defaultIceServers = [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" }
];

// 1. HELPER: Timer Hook
const useMeetingTimer = () => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    return formatTime(seconds);
};

const VideoPlayer = ({ stream, username, isLocal = false, onPiP, isPiPMode, isHandRaised, isMutedRemote }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={styles.videoWrapper} onClick={onPiP}>
            {onPiP && <div className={styles.pinIcon}>{isPiPMode ? <GridViewRounded /> : <PictureInPictureAltRounded />}</div>}
            
            <div className={styles.statusIcons}>
                {isMutedRemote && <div className={styles.statusIcon}><MicOffRounded fontSize="small" color="error" /></div>}
                {isHandRaised && <div className={styles.statusIcon}><BackHandRounded fontSize="small" color="warning" /></div>}
            </div>

            <video ref={videoRef} autoPlay muted={isLocal} />
            <div className={styles.displayName}>
                {username || "User"} {isLocal && "(You)"}
            </div>
        </div>
    );
};

export default function VideoMeetComponent() {
    const routeTo = useNavigate();
    const { url: meetingCode } = useParams();
    const timerString = useMeetingTimer(); 
    
    // Refs
    const connectionsRef = useRef({});
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoRef = useRef();
    let chatScrollRef = useRef();

    // Media States
    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(true);
    let [audio, setAudio] = useState(true);
    let [screen, setScreen] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState();
    
    // UI States
    let [showModal, setModal] = useState(false);
    let [messages, setMessages] = useState([])
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [isFullScreen, setIsFullScreen] = useState(false);
    let [isPiP, setIsPiP] = useState(false); 
    
    // FEATURE STATES
    let [videos, setVideos] = useState([]);
    let [isWaiting, setIsWaiting] = useState(false); 
    let [isEntryRejected, setIsEntryRejected] = useState(false); // REJECTION STATE
    let [isAdmin, setIsAdmin] = useState(false);    
    let [waitingQueue, setWaitingQueue] = useState([]); 
    let [handRaised, setHandRaised] = useState(false);
    let [remoteHands, setRemoteHands] = useState({}); 
    let [remoteMutes, setRemoteMutes] = useState({}); 

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, showModal]);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(!!videoPermission);
            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(!!audioPermission);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

            if (videoPermission || audioPermission) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: videoPermission ? true : false, 
                    audio: audioPermission ? true : false 
                });
                
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (err) {
            console.error("Error accessing media devices.", err);
        }
    }

    useEffect(() => { getPermissions(); }, [])

    const handleVideoToggle = () => {
        if(window.localStream) {
            const videoTrack = window.localStream.getVideoTracks()[0];
            if(videoTrack) {
                videoTrack.enabled = !video;
                setVideo(!video);
            }
        }
    };

    const handleAudioToggle = () => {
        if(window.localStream) {
            const audioTrack = window.localStream.getAudioTracks()[0];
            if(audioTrack) {
                audioTrack.enabled = !audio;
                setAudio(!audio);
                socketRef.current.emit("toggle-mute-status", window.location.href, !audio);
            }
        }
    };

    const handleHandRaise = () => {
        const newState = !handRaised;
        setHandRaised(newState);
        socketRef.current.emit("toggle-hand", window.location.href, newState);
    };

    const handleAdmitUser = (socketId) => {
        socketRef.current.emit("admit-user", { roomPath: window.location.href, socketId });
    };

    const handleRejectUser = (socketId) => {
        socketRef.current.emit("reject-user", { roomPath: window.location.href, socketId });
    };

    // 2. HELPER: Chat Download
    const downloadChat = () => {
        if (messages.length === 0) return;
        const chatContent = messages.map(m => `[${m.sender}]: ${m.data}`).join('\n');
        const blob = new Blob([chatContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-chat-${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
    };

    const handleScreen = async () => {
        if (!screen) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
                const screenTrack = stream.getVideoTracks()[0];

                Object.values(connectionsRef.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track.kind === 'video');
                    if(sender) sender.replaceTrack(screenTrack);
                });

                if(localVideoRef.current) localVideoRef.current.srcObject = stream;
                setScreen(true);

                screenTrack.onended = () => { stopScreenShare(); };
            } catch (err) { console.log(err); }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = () => {
        if(!window.localStream) return;
        const videoTrack = window.localStream.getVideoTracks()[0];
        
        Object.values(connectionsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if(sender) sender.replaceTrack(videoTrack);
        });
        
        if(localVideoRef.current) localVideoRef.current.srcObject = window.localStream;
        setScreen(false);
    };

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
            setIsFullScreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(e => console.log(e));
                setIsFullScreen(false);
            }
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(window.location.href);
    }

    const connectToSocketServer = (iceServersConfig) => {
        socketRef.current = io.connect(server_url, { secure: false });
        
        socketRef.current.on('signal', (fromId, message) => {
            const signal = JSON.parse(message);
            if (fromId !== socketIdRef.current) {
                if (signal.sdp) {
                    connectionsRef.current[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                        if (signal.sdp.type === 'offer') {
                            connectionsRef.current[fromId].createAnswer().then((description) => {
                                connectionsRef.current[fromId].setLocalDescription(description).then(() => {
                                    socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connectionsRef.current[fromId].localDescription }))
                                });
                            });
                        }
                    });
                }
                if (signal.ice) connectionsRef.current[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
            }
        });

        socketRef.current.on("connect", () => {
            socketRef.current.emit("join-call", window.location.href, username);
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on("wait-for-admin", () => {
                setIsWaiting(true);
            });
            
            socketRef.current.on("entry-accepted", () => {
                setIsWaiting(false);
            });

            // NEW: Handle Rejection
            socketRef.current.on("entry-rejected", () => {
                setIsWaiting(false);
                setIsEntryRejected(true);
            });

            socketRef.current.on("you-are-admin", () => {
                setIsAdmin(true);
            });
            socketRef.current.on("user-waiting", (queue) => {
                setWaitingQueue(queue); 
            });

            socketRef.current.on("hand-update", (id, state) => {
                setRemoteHands(prev => ({ ...prev, [id]: state }));
            });
            socketRef.current.on("mute-update", (id, state) => {
                setRemoteMutes(prev => ({ ...prev, [id]: state }));
            });

            socketRef.current.on("chat-message", (data, sender, socketIdSender) => {
                setMessages(prev => [...prev, { sender, data }]);
                if (socketIdSender !== socketIdRef.current) setNewMessages(prev => prev + 1);
            });

            socketRef.current.on("user-left", (id) => {
                setVideos(prev => prev.filter(v => v.socketId !== id));
                if (connectionsRef.current[id]) {
                    connectionsRef.current[id].close();
                    delete connectionsRef.current[id];
                }
                setRemoteHands(prev => { const n = {...prev}; delete n[id]; return n; });
                setRemoteMutes(prev => { const n = {...prev}; delete n[id]; return n; });
            });

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((client) => {
                    const targetId = client.id;
                    const targetName = client.username;
                    if (targetId === socketIdRef.current) return;
                    
                    if (!connectionsRef.current[targetId]) {
                        connectionsRef.current[targetId] = new RTCPeerConnection({ 
                            iceServers: iceServersConfig 
                        });
                        
                        connectionsRef.current[targetId].onicecandidate = (event) => {
                            if (event.candidate) socketRef.current.emit("signal", targetId, JSON.stringify({ 'ice': event.candidate }));
                        };
                        
                        connectionsRef.current[targetId].ontrack = (event) => {
                            const stream = event.streams[0];
                            setVideos(prev => {
                                const existing = prev.find(v => v.socketId === targetId);
                                if (existing) return prev.map(v => v.socketId === targetId ? { ...v, stream: stream } : v);
                                return [...prev, { socketId: targetId, stream: stream, username: targetName }];
                            });
                        };
                        
                        if (window.localStream) {
                            window.localStream.getTracks().forEach(track => connectionsRef.current[targetId].addTrack(track, window.localStream));
                        }
                    }
                });

                if (id === socketIdRef.current) {
                     clients.forEach((client) => {
                         if(client.id !== socketIdRef.current){
                             connectionsRef.current[client.id].createOffer().then(description => {
                                 connectionsRef.current[client.id].setLocalDescription(description).then(() => {
                                     socketRef.current.emit("signal", client.id, JSON.stringify({'sdp': connectionsRef.current[client.id].localDescription}));
                                 });
                             });
                         }
                     })
                }
            });
        });
    };

    const connect = async () => {
        if (!username.trim()) return alert("Name is required");
        setAskForUsername(false);

        try {
            const response = await fetch(`${server_url}/api/v1/users/get_turn_credentials`);
            const data = await response.json();
            if (data.iceServers) {
                connectToSocketServer(data.iceServers);
            } else {
                connectToSocketServer(defaultIceServers);
            }
        } catch (err) {
            console.error("Failed to fetch TURN credentials, using default STUN.", err);
            connectToSocketServer(defaultIceServers);
        }
    };

    const sendMessage = () => {
        if (!message.trim()) return;
        socketRef.current.emit("chat-message", message, username);
        setMessage("");
    };

    const handleEndCall = () => {
        try {
            if(window.localStream) window.localStream.getTracks().forEach(track => track.stop());
            Object.keys(connectionsRef.current).forEach(key => {
                connectionsRef.current[key].close();
            });
            connectionsRef.current = {};
        } catch(e) {}
        routeTo('/home');
    }

    // 3. SCREEN: Rejected
    if (isEntryRejected) {
        return (
            <div className={styles.lobbyContainer}>
                 <div className={styles.lobbyCard} style={{textAlign:'center'}}>
                    <Block style={{fontSize: 60, color: '#e53935', marginBottom: 20}} />
                    <h2>Access Denied</h2>
                    <p>The host has not approved your request to join this meeting.</p>
                    <Button 
                        variant="outlined" 
                        onClick={() => routeTo('/home')}
                        style={{marginTop: 20}}
                    >
                        Go Back Home
                    </Button>
                 </div>
            </div>
        )
    }

    // 4. SCREEN: Waiting
    if (isWaiting) {
        return (
            <div className={styles.lobbyContainer}>
                 <div className={styles.lobbyCard} style={{textAlign:'center'}}>
                    <CircularProgress color="inherit" style={{marginBottom:20}} />
                    <h2>Waiting for host to admit you...</h2>
                    <p>Please stay on this screen.</p>
                 </div>
            </div>
        )
    }

    return (
        <div className={styles.meetPageContainer}>
            {askForUsername ? (
                <div className={styles.lobbyContainer}>
                    <div className={styles.lobbyCard}>
                         <img src="/logo.png" alt="Logo" style={{width:60, borderRadius:12, marginBottom:20}} />
                         <h2 style={{margin:'0 0 20px'}}>Join Meeting</h2>
                         <div className={styles.videoPreview}>
                             <video ref={localVideoRef} autoPlay muted style={{width:'100%', height:'100%', objectFit:'cover'}} />
                        </div>
                        <TextField 
                            fullWidth label="Display Name" 
                            value={username} onChange={e => setUsername(e.target.value)} 
                            variant="outlined" sx={{ marginBottom: 2 }}
                        />
                        <Button variant="contained" fullWidth onClick={connect} size="large" style={{background:'black', color:'white'}}>
                            Join Now
                        </Button>
                    </div>
                </div>
            ) : (
                <div className={styles.conferenceContainer}>
                    
                    {/* 5. ADMIN NOTIFICATION UI */}
                    {isAdmin && waitingQueue.length > 0 && (
                         <Snackbar open={true} anchorOrigin={{vertical:'top', horizontal:'center'}}>
                             <Alert 
                                severity="info" 
                                variant="filled" 
                                icon={false} // Remove default icon for cleaner look
                                sx={{ 
                                    width: '100%', 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    '& .MuiAlert-message': { width: '100%' }
                                }}
                             >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 300 }}>
                                    <span style={{ fontWeight: 500 }}>
                                        {waitingQueue[0].username} wants to join
                                    </span>
                                    <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            color="success"
                                            startIcon={<Check />}
                                            onClick={() => handleAdmitUser(waitingQueue[0].id)}
                                            style={{ backgroundColor: '#4caf50', color: 'white' }}
                                        >
                                            Admit
                                        </Button>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            color="error"
                                            startIcon={<Block />}
                                            onClick={() => handleRejectUser(waitingQueue[0].id)}
                                            style={{ backgroundColor: '#ef5350', color: 'white' }}
                                        >
                                            Deny
                                        </Button>
                                    </div>
                                </div>
                             </Alert>
                         </Snackbar>
                    )}

                    <div className={styles.header}>
                        <div className={styles.headerBrand}>
                            <img src="/logo.png" alt="Logo" style={{height: 28, borderRadius: 6}} />
                            <span>Juncture</span>
                            {isAdmin && <Badge badgeContent="Host" color="primary" style={{marginLeft:10}} />}
                        </div>
                        
                        {/* TIMER DISPLAY */}
                        <div style={{ color: 'white', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                            {timerString}
                        </div>

                        <Tooltip title="Copy Meeting URL">
                            <div className={styles.meetingCode} onClick={copyToClipboard}>
                                {meetingCode} <ContentCopyRounded fontSize="small" style={{marginLeft:6, opacity:0.7}} />
                            </div>
                        </Tooltip>
                    </div>

                    <div className={styles.mainGrid}>
                        <div className={`${styles.videoArea} ${showModal ? styles.videoAreaShrink : ''}`}>
                             <div className={styles.gridContainer}>
                                {/* Self View */}
                                {!isPiP && (
                                    <VideoPlayer 
                                        stream={window.localStream} 
                                        username={username} 
                                        isLocal={true} 
                                        onPiP={() => setIsPiP(true)}
                                        isPiPMode={false}
                                        isHandRaised={handRaised}
                                        isMutedRemote={!audio}
                                    />
                                )}

                                {/* Remote Views */}
                                {videos.map((v) => (
                                    <VideoPlayer 
                                        key={v.socketId}
                                        stream={v.stream}
                                        username={v.username}
                                        isHandRaised={remoteHands[v.socketId]}
                                        isMutedRemote={remoteMutes[v.socketId]}
                                    />
                                ))}
                                
                                {videos.length === 0 && !isPiP && (
                                    <div className={styles.waitingMessage}>Waiting for others...</div>
                                )}
                             </div>
                        </div>

                        {isPiP && (
                            <div className={`${styles.selfViewContainer} ${showModal ? styles.selfViewShift : ''}`}>
                                 <VideoPlayer 
                                    stream={window.localStream} 
                                    username={username} 
                                    isLocal={true} 
                                    onPiP={() => setIsPiP(false)}
                                    isPiPMode={true}
                                    isHandRaised={handRaised}
                                    isMutedRemote={!audio}
                                 />
                            </div>
                        )}

                        <div className={`${styles.chatSidebar} ${showModal ? styles.chatOpen : ''}`}>
                            <div className={styles.chatHeader}>
                                <span>Messages</span>
                                <div>
                                    <Tooltip title="Save Chat">
                                        <IconButton onClick={downloadChat} size="small" style={{color:'white'}}>
                                            <GetAppRounded />
                                        </IconButton>
                                    </Tooltip>
                                    <IconButton onClick={() => setModal(false)} size="small"><CloseRounded /></IconButton>
                                </div>
                            </div>
                            <div className={styles.chatBody} ref={chatScrollRef}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={msg.sender === username ? styles.myMsg : styles.theirMsg}>
                                        <div className={styles.msgName}>{msg.sender}</div>
                                        <div className={styles.msgBubble}>{msg.data}</div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.chatInput}>
                                <TextField 
                                    fullWidth placeholder="Type a message..." value={message} 
                                    onChange={e => setMessage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    variant="standard" InputProps={{ disableUnderline: true }}
                                />
                                <IconButton onClick={sendMessage} color="primary"><SendRounded /></IconButton>
                            </div>
                        </div>
                    </div>

                    <div className={styles.controls}>
                        <div className={styles.controlsGroup}>
                            <Tooltip title="Camera">
                                <IconButton onClick={handleVideoToggle} className={!video ? styles.btnErr : styles.btnDark}>
                                    {video ? <VideocamRounded /> : <VideocamOffRounded />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Microphone">
                                <IconButton onClick={handleAudioToggle} className={!audio ? styles.btnErr : styles.btnDark}>
                                    {audio ? <MicRounded /> : <MicOffRounded />}
                                </IconButton>
                            </Tooltip>
                            {screenAvailable && (
                                <Tooltip title="Share Screen">
                                    <IconButton onClick={handleScreen} className={screen ? styles.btnSuccess : styles.btnDark}>
                                        {screen ? <StopScreenShareRounded /> : <ScreenShareRounded />}
                                    </IconButton>
                                </Tooltip>
                            )}
                            
                            <Tooltip title="Raise Hand">
                                <IconButton onClick={handleHandRaise} className={handRaised ? styles.btnActive : styles.btnDark}>
                                    <BackHandRounded />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title={showModal ? "Hide Chat" : "Show Chat"}>
                                <Badge badgeContent={newMessages} color="error">
                                    <IconButton onClick={() => {setModal(!showModal); setNewMessages(0)}} className={showModal ? styles.btnActive : styles.btnDark}>
                                        <ChatBubbleRounded />
                                    </IconButton>
                                </Badge>
                            </Tooltip>
                            <Tooltip title="Full Screen">
                                <IconButton onClick={toggleFullScreen} className={styles.btnDark}>
                                    {isFullScreen ? <FullscreenExitRounded /> : <FullscreenRounded />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Leave">
                                <IconButton onClick={handleEndCall} className={styles.btnEnd}>
                                    <CallEndRounded />
                                </IconButton>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}