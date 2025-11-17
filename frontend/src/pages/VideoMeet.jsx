import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField, Tooltip, Button } from '@mui/material';
import { 
    VideocamRounded, VideocamOffRounded, MicRounded, MicOffRounded, 
    CallEndRounded, ScreenShareRounded, StopScreenShareRounded, 
    ChatBubbleRounded, SendRounded, CloseRounded, ContentCopyRounded,
    FullscreenRounded, FullscreenExitRounded,
    PictureInPictureAltRounded, GridViewRounded
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import styles from "../styles/videoComponent.module.css";
import server from '../environment';

const server_url = `${server}`;

const peerConfigConnections = {
    "iceServers": [{ "urls": "stun:stun1.l.google.com:19302" }]
}

// HELPER COMPONENT: Prevents flickering by isolating video rendering
// This only updates the video source if the 'stream' prop changes
const VideoPlayer = ({ stream, username, isLocal = false, onPiP, isPiPMode }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={styles.videoWrapper} onClick={onPiP}>
            {/* Only show PiP icon if passed */}
            {onPiP && <div className={styles.pinIcon}>{isPiPMode ? <GridViewRounded /> : <PictureInPictureAltRounded />}</div>}
            
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
    
    // FIX 2: Move connections INSIDE the component using useRef
    // This ensures connections are cleared when you leave the page
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
    
    let [videos, setVideos] = useState([]);

    // FIX 1 (Part A): Removed the `useEffect` that had no dependency array.
    // We will handle local stream attachment inside the 'getPermissions' or the new VideoPlayer component.

    // Auto-scroll chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [messages, showModal]);

    // 1. Get Permissions & Initial Stream
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
                    // Manually set ref once initialized
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

    // 2. Handle Media Toggles
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
            }
        }
    };

    const handleScreen = async () => {
        if (!screen) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
                const screenTrack = stream.getVideoTracks()[0];

                // Update all peer connections with the screen track
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

    // 3. Socket Logic
    const connectToSocketServer = () => {
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
            });

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((client) => {
                    const targetId = client.id;
                    const targetName = client.username;
                    if (targetId === socketIdRef.current) return;
                    
                    // Use connectionsRef.current here
                    if (!connectionsRef.current[targetId]) {
                        connectionsRef.current[targetId] = new RTCPeerConnection(peerConfigConnections);
                        
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

    const connect = () => {
        if (!username.trim()) return alert("Name is required");
        setAskForUsername(false);
        connectToSocketServer();
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
            connectionsRef.current = {}; // Clear connections
        } catch(e) {}
        routeTo('/home');
    }

    return (
        <div className={styles.meetPageContainer}>
            {askForUsername ? (
                <div className={styles.lobbyContainer}>
                    {/* ... (Lobby UI remains unchanged) ... */}
                    <div className={styles.lobbyCard}>
                         <img src="/logo.png" alt="Logo" style={{width:60, borderRadius:12, marginBottom:20}} />
                         <h2 style={{margin:'0 0 20px'}}>Join Meeting</h2>
                         <div className={styles.videoPreview}>
                             {/* Local Preview */}
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
                    <div className={styles.header}>
                        <div className={styles.headerBrand}>
                            <img src="/logo.png" alt="Logo" style={{height: 28, borderRadius: 6}} />
                            <span>Juncture</span>
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
                                {/* 1. Self View (GRID MODE) */}
                                {!isPiP && (
                                    // FIX 1 (Part B): Using helper component
                                    <VideoPlayer 
                                        stream={window.localStream} 
                                        username={username} 
                                        isLocal={true} 
                                        onPiP={() => setIsPiP(true)}
                                        isPiPMode={false}
                                    />
                                )}

                                {/* 2. Remote Views */}
                                {videos.map((v) => (
                                    // FIX 1 (Part C): Using helper component for remote videos
                                    <VideoPlayer 
                                        key={v.socketId}
                                        stream={v.stream}
                                        username={v.username}
                                    />
                                ))}
                                
                                {videos.length === 0 && !isPiP && (
                                    <div className={styles.waitingMessage}>Waiting for others...</div>
                                )}
                             </div>
                        </div>

                        {/* 3. Self View (PiP MODE) */}
                        {isPiP && (
                            <div className={`${styles.selfViewContainer} ${showModal ? styles.selfViewShift : ''}`}>
                                 {/* Using VideoPlayer for PiP as well */}
                                 <VideoPlayer 
                                    stream={window.localStream} 
                                    username={username} 
                                    isLocal={true} 
                                    onPiP={() => setIsPiP(false)}
                                    isPiPMode={true}
                                 />
                            </div>
                        )}

                        <div className={`${styles.chatSidebar} ${showModal ? styles.chatOpen : ''}`}>
                            <div className={styles.chatHeader}>
                                <span>Messages</span>
                                <IconButton onClick={() => setModal(false)} size="small"><CloseRounded /></IconButton>
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
                        {/* ... (Controls remain the same) ... */}
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