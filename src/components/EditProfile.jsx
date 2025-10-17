import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar.jsx'; // Import the Navbar component

const EditProfile = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState('https://via.placeholder.com/150');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userRole, setUserRole] = useState(null);

  // State for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Define your API URL from environment variables
  const apiUrl = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedRole = localStorage.getItem('userRole');
        setUserRole(storedRole);

        const response = await axios.get(`${apiUrl}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = response.data.user;
        setName(user.name);
        setEmail(user.email);

        if (user.profilePhoto) {
          // If the profilePhoto is already a full URL, use it as-is.
          if (
            user.profilePhoto.startsWith('http://') ||
            user.profilePhoto.startsWith('https://')
          ) {
            setPreviewPhoto(user.profilePhoto);
          } else {
            // Ensure there's a leading slash if not provided
            const photoPath = user.profilePhoto.startsWith('/')
              ? user.profilePhoto
              : `/${user.profilePhoto}`;
            const fullPhotoUrl = `${apiUrl}${photoPath}`;
            setPreviewPhoto(fullPhotoUrl);
          }
        } else {
          setPreviewPhoto('https://via.placeholder.com/150');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [apiUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      setPreviewPhoto(URL.createObjectURL(file));
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    if (profilePhoto) {
      // Ensure the field name here matches the backend's expected field name ("profilePhoto")
      formData.append('profilePhoto', profilePhoto);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${apiUrl}/users/edit-profile`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccessMessage('Profile updated successfully!');
      setErrorMessage('');
      console.log('Profile update response:', response.data);

      setTimeout(() => {
        if (userRole === "student") {
          navigate('/student-dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage('Failed to update profile. Please try again.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Check that the new password fields match
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${apiUrl}/users/edit-profile`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPasswordMessage('Password updated successfully!');
      // Clear the password fields after successful update
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      console.log('Password change response:', response.data);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordMessage('Failed to update password. Please try again.');
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mt-5">
        <h2>Edit Profile</h2>
        {successMessage && <div className="alert alert-success">{successMessage}</div>}
        {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
        <form onSubmit={handleProfileSubmit} encType="multipart/form-data">
          <div className="mb-3">
            <label htmlFor="name" className="form-label">Name</label>
            <input
              type="text"
              id="name"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="profilePhoto" className="form-label">Profile Photo</label>
            <input
              type="file"
              id="profilePhoto"
              className="form-control"
              onChange={handleFileChange}
            />
          </div>
          {previewPhoto && (
            <div className="mb-3">
              <img
                src={previewPhoto}
                alt="Profile Preview"
                style={{ width: '150px', height: '150px', borderRadius: '50%' }}
              />
            </div>
          )}
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </form>

        <hr />

        <h3>Change Password</h3>
        {passwordMessage && <div className="alert alert-info">{passwordMessage}</div>}
        <form onSubmit={handlePasswordChange}>
          <div className="mb-3">
            <label htmlFor="currentPassword" className="form-label">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              className="form-control"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="newPassword" className="form-label">New Password</label>
            <input
              type="password"
              id="newPassword"
              className="form-control"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Change Password
          </button>
        </form>
      </div>
    </>
  );
};

export default EditProfile;
