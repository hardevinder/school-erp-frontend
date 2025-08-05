import { io } from 'socket.io-client';

const token = localStorage.getItem('token');
const admissionNumber = localStorage.getItem('admissionNumber'); // Ensure this is set when the user logs in

const socket = io(process.env.REACT_APP_API_URL, {
  query: { token }
});

// When the socket connects, register using the admission number
socket.on('connect', () => {
  if (admissionNumber) {
    socket.emit('register', admissionNumber);
    console.log('Registered with admission number:', admissionNumber);
  } else {
    console.warn('No admission number found.');
  }
});

// Listen for fee-notification events and display an alert
socket.on('fee-notification', (data) => {
  console.log('Notification received:', data);
  alert(`${data.title}\n${data.message}`);
});

// Expose socket globally for debugging (remove in production)
window.socket = socket;

export default socket;
