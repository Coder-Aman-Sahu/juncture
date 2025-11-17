import React,{useState} from 'react';
import withAuth from '../utils/withAuth';
import { useNavigate } from 'react-router-dom';
import "../App.css";
import IconButton from '@mui/material/IconButton';
import RestoreIcon from '@mui/icons-material/Restore';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent(){

    let navigate = useNavigate();
    const {addToUserHistory} = useContext(AuthContext);
    const [meetingCode,setMeetingCode] = useState("");
    let handleJoinVideoCall = async() => {
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`);    
    }

    return(
        <>
          <div className="navBar">
                <div style={{display: "flex", alignItems: "center"}}>

                    <h3>Juncture</h3>
                </div>

                <div style={{display: "flex", alignItems: "center"}}>
                    <IconButton onClick={() => {
                        navigate('/history')
                    }}>
                        <RestoreIcon/>
                        
                    </IconButton>
                    <p>History</p>
                    <Button onClick={() => {
                        localStorage.removeItem('token');
                        navigate('/auth')
                    }}>Logout</Button>
                </div>

            </div>  
            

            <div className="meetContainer">
                <div className="leftPanel">
                    <h2>Providing Quality Video Calls just like Quality Education</h2>
                    <div style={{display:'flex',gap:"10px"}}>

                        <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
                            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                    </div>
                </div>
                <div className="rightPanel">
                    <img srcSet='/logo3.png' alt="video-meet-illustration" className="meetIllustration"/>
                </div>
            </div>
        </>
    )
}
export default withAuth(HomeComponent)