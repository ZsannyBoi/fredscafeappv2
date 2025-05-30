import React, { useState, useEffect, useRef } from 'react';
import { User, SettingsData } from '../types'; // Import SettingsData
import ImageUpload from '../components/ImageUpload';
import { uploadImage } from '../utils/imageUpload';
import { toast } from 'react-toastify';
import MembershipManager from '../components/MembershipManager';

// Updated ProfileInfo to better match User type and what we can edit
interface EditableProfileInfo {
    name: string;
    email: string; // Assuming email is user.id and might not be directly editable here
    avatar: string; // This will hold the URL (existing or blob preview)
    avatarFile?: File | null; // To hold the new file if one is selected
    phone_number?: string; // Use phone_number to match User type
    address?: string; // Include address, matches User type
}

interface ProfilePageProps {
  user: User | null;
  updateUser: (userData: Partial<User>) => void; // Add updateUser prop
}

const Profile: React.FC<ProfilePageProps> = ({ user, updateUser }) => {
  // Use empty strings as initial state while data is loading
  const initialProfileState: EditableProfileInfo = {
    name: "",
    email: "",
    avatar: "/src/assets/avatar.png", // Default fallback avatar
    avatarFile: null,
    phone_number: "",
    address: "",
  };

  const [editFormData, setEditFormData] = useState<EditableProfileInfo>(initialProfileState);
  const [isEditing, setIsEditing] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false); // New state for saving process
  const [error, setError] = useState<string | null>(null); // New state for errors
  // New state for fetching data
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add state for user settings
  const [userSettings, setUserSettings] = useState<SettingsData | null>(null);

  // Effect to fetch full user data when the component mounts or user.id changes
  useEffect(() => {
    console.log('[Profile.tsx] useEffect running. User prop:', user);
    const fetchUserData = async () => {
      console.log('[Profile.tsx] fetchUserData called.');
      console.log('[Profile.tsx] Inside fetchUserData, user prop:', user);
      if (!user?.internalId) {
        console.log('[Profile.tsx] User or user.internalId is missing. Stopping fetch.');
        setIsLoading(false);
        setError("User not logged in or user ID not available.");
        toast.error("User not logged in or user ID not available.");
        return;
      }

      // Use current user data for initial setup regardless of API success
      setEditFormData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || '/src/assets/user.svg',
        avatarFile: null,
        phone_number: user.phone_number || '',
        address: user.address || '',
      });

      console.log('[Profile.tsx] User internalId available, attempting to fetch data for:', user.internalId);
      setIsLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('authToken');
        const headers: HeadersInit = {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };

        // Fetch user data from the backend
        console.log('[Profile.tsx] Fetching user data from', `/api/users/${user.internalId}`);
        const response = await fetch(`http://localhost:3001/api/users/${user.internalId}`, { headers });
        console.log('[Profile.tsx] Fetch response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `Failed to fetch user data. Status: ${response.status}` }));
          console.error('[Profile.tsx] Fetch failed. Error data:', errorData);
          throw new Error(errorData.message || `Failed to fetch user data.`);
        }

        const userData = await response.json();
        console.log('[Profile.tsx] Fetch successful. Received data:', userData);

        // API returns user data directly, not wrapped in a 'user' field
        setEditFormData({
          name: userData.name || user.name || '',
          email: userData.email || user.email || '',
          avatar: userData.avatar || user.avatar || '/src/assets/user.svg',
          avatarFile: null,
          phone_number: userData.phone_number || user.phone_number || '',
          address: userData.address || user.address || '',
        });
        
        console.log('[Profile.tsx] Form data initialized with:', userData);
      } catch (error: any) {
        console.error('[Profile.tsx] Fetch user data catch:', error);
        console.log('Error fetching user data for profile:', error);
        // We already set up the form with user prop data, so just set the error
        setError(error.message || 'An error occurred while fetching profile data.');
        toast.error(error.message || 'An error occurred while fetching profile data.');
      } finally {
        console.log('[Profile.tsx] Fetch user data finally. Setting isLoading(false).');
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user?.internalId]);

  // Clean up avatar blob URL if it exists in editFormData
  useEffect(() => {
    return () => {
      if (editFormData.avatar && editFormData.avatar.startsWith('blob:')) {
        URL.revokeObjectURL(editFormData.avatar);
      }
    };
  }, [editFormData.avatar]);

  // Add useEffect to fetch user settings
  useEffect(() => {
    if (user?.internalId) {
      fetchUserSettings();
    }
  }, [user?.internalId]);
  
  const fetchUserSettings = async () => {
    if (!user?.internalId) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('[Profile.tsx] No auth token found for settings fetch.');
        return;
      }
      
      const response = await fetch(`http://localhost:3001/api/users/${user.internalId}/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('[Profile.tsx] Error fetching user settings:', response.status);
        return;
      }
      
      const settings = await response.json();
      console.log('[Profile.tsx] Fetched user settings:', settings);
      setUserSettings(settings);
    } catch (error) {
      console.error('[Profile.tsx] Error in fetchUserSettings:', error);
    }
  };

  const handleImageChange = async (file: File | null, previewUrl: string) => {
    if (!user?.internalId) return;

    try {
      let imageUrl = previewUrl;
      if (file) {
        // Upload the file and get the URL
        imageUrl = await uploadImage(file);
      }

      setEditFormData(prev => ({
        ...prev,
        avatar: imageUrl
      }));

      // If we're not in edit mode, update immediately
      if (!isEditing) {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`http://localhost:3001/api/users/${user.internalId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ avatar_url: imageUrl })
        });

        if (!response.ok) {
          throw new Error('Failed to update profile image');
        }

        const result = await response.json();
        if (result.user) {
          updateUser(result.user);
          toast.success('Profile image updated successfully');
        }
      }
    } catch (err: any) {
      console.error('Error updating profile image:', err);
      setError(err.message || 'Failed to update profile image');
      toast.error(err.message || 'Failed to update profile image');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      // Handle phone_number input specifically if needed, or keep general
      setEditFormData(prev => ({ ...prev, [name]: value }));
      setError(null); // Clear error on input change
  };

  const handleEditClick = () => {
      // editFormData is already initialized and updated by useEffect based on the user prop.
      // When entering edit mode, we simply allow these fields to be changed.
      setIsEditing(true);
      setError(null); // Clear errors when entering edit mode

      // When starting edit, initialize form fields from the current editFormData state (which was set by fetchUserData)
      setEditFormData(prev => ({
          ...prev,
          // No change needed here, prev state holds the fetched data
      }));
  };

  const handleCancelClick = () => {
      setIsEditing(false);
      // Reset editFormData to reflect the current user prop, discarding changes for phone_number
      // address is reset to initial empty state
      setEditFormData({
        name: user?.name ?? "", // Reset from App.tsx user state
        email: user?.email ?? "", // Reset from App.tsx user state (which is the email)
        avatar: user?.avatar ?? "/src/assets/avatar.png", // Reset from App.tsx user state
        avatarFile: null, // Clear any selected file
        phone_number: user?.phone_number || "", // Reset from App.tsx user state
        address: user?.address || "", // Reset from App.tsx user state
      });
      setError(null); // Clear errors when cancelling
  };

  const handleSaveClick = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!user?.internalId) {
          alert("You must be logged in to update your profile.");
          toast.error("You must be logged in to update your profile.");
          return;
      }
      
      console.log('[Profile.tsx] handleSaveClick: Starting save.', editFormData);
      
      setIsSaving(true);
      setError(null);
      
      // Validate form data here (this could be expanded as needed)
      if (!editFormData.name.trim()) {
          setError("Name is required.");
          setIsSaving(false);
          return;
      }
      
      // Create data object with only the fields we want to update
      const dataToSave: any = {};
      
      // Only include fields that we allow to be updated
      if (editFormData.name && editFormData.name !== user.name) {
          dataToSave.name = editFormData.name;
      }
      
      if (editFormData.phone_number !== undefined && editFormData.phone_number !== user.phone_number) {
          dataToSave.phone_number = editFormData.phone_number;
      }
      
      if (editFormData.address !== undefined && editFormData.address !== user.address) {
          dataToSave.address = editFormData.address;
      }
      
      if (editFormData.avatar && editFormData.avatar !== user.avatar) {
          dataToSave.avatar_url = editFormData.avatar;
      }
      
      // If no data to save, exit
      if (Object.keys(dataToSave).length === 0) {
          console.log('[Profile.tsx] No changes detected. Exiting save.');
          toast.info('No changes detected.');
          setIsEditing(false);
          setIsSaving(false);
          return;
      }

      console.log('[Profile.tsx] Saving profile data:', dataToSave);

      try {
          // Get auth token from localStorage
          const token = localStorage.getItem('authToken');
          if (!token) {
              throw new Error('No authentication token found.');
          }

          // Send PUT request to update user profile
          const response = await fetch(`http://localhost:3001/api/users/${user.internalId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(dataToSave)
          });

          if (!response.ok) {
              const errorText = await response.text();
              console.error("[Profile.tsx] Error response:", response.status, errorText);
              throw new Error(errorText || `HTTP error ${response.status}`);
          }

          // Parse and handle the response
          const updatedData = await response.json();
          console.log("[Profile.tsx] Profile updated successfully:", updatedData);

          // Update form data with the response
          setEditFormData({
              ...editFormData,
              name: updatedData.name || editFormData.name,
              avatar: updatedData.avatar || editFormData.avatar,
              phone_number: updatedData.phone_number || editFormData.phone_number,
              address: updatedData.address || editFormData.address
          });
          
          // Also update the user object in state to reflect changes
          if (user && updateUser) {
              updateUser({
                  ...user,
                  name: updatedData.name || user.name,
                  avatar: updatedData.avatar || user.avatar,
                  phone_number: updatedData.phone_number || user.phone_number,
                  address: updatedData.address || user.address
              });
          }
          
          // Show success message
          toast.success('Profile updated successfully!');
          setIsEditing(false); // Exit edit mode
      } catch (error: any) {
          console.error("[Profile.tsx] Error saving profile:", error);
          setError(error.message || "An error occurred while saving your profile.");
          toast.error(error.message || "An error occurred while saving your profile.");
      } finally {
          setIsSaving(false);
      }
  };

  const getDisplayRole = (role: string | undefined) => {
      if (!role) return 'Customer';
      
      // Capitalize first letter of role
      return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Function to render the profile banner based on settings
  const renderProfileBanner = () => {
    // Default banner styling
    const defaultBannerStyle = {
      backgroundColor: '#a7f3d0', // Default emerald color
      height: '160px'
    };
    
    // If no settings, use default
    if (!userSettings) {
      return <div style={defaultBannerStyle} className="w-full"></div>;
    }
    
    // Use settings to create banner
    if (userSettings.profileBanner.type === 'color') {
      return (
        <div 
          style={{ 
            backgroundColor: userSettings.profileBanner.value || defaultBannerStyle.backgroundColor,
            height: '160px'
          }} 
          className="w-full"
        ></div>
      );
    } else if (userSettings.profileBanner.type === 'image' && userSettings.profileBanner.value) {
      // For server-side images, make sure to use the full URL with the server base
      const imageUrl = userSettings.profileBanner.value.startsWith('http') 
        ? userSettings.profileBanner.value 
        : `http://localhost:3001${userSettings.profileBanner.value}`;
        
      return (
        <div 
          style={{ 
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '160px'
          }} 
          className="w-full"
        ></div>
      );
    }
    
    // Fallback to default
    return <div style={defaultBannerStyle} className="w-full"></div>;
  };

  // During the initial loading state
  if (isLoading) {
    console.log('[Profile.tsx] Rendering: Loading state.');
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  // Error fallback if we failed to fetch user data, but show it only if we didn't set form data as a fallback
  if (error && (!editFormData.name || editFormData.name === '')) {
    console.log('[Profile.tsx] Rendering: Error state.', error);
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
          <h3 className="text-lg font-medium mb-2">Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  console.log('[Profile.tsx] Rendering: Profile data loaded successfully.', user, editFormData);
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Profile Banner based on settings */}
      <div className="relative">
        {renderProfileBanner()}
        
        {/* Profile Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center space-x-6 bg-gradient-to-t from-black/40 to-transparent">
          <div className="relative z-10">
            <ImageUpload
              currentImageUrl={isEditing ? editFormData.avatar : (user?.avatar ?? "/src/assets/avatar.png")}
              defaultImageUrl="/src/assets/avatar.png"
              onImageChange={handleImageChange}
              disabled={isSaving}
              className="w-24 h-24 border-4 border-white shadow-md"
            />
          </div>
          <div className="z-10">
            <h2 className="text-2xl font-semibold text-white shadow-sm">{isEditing ? editFormData.name : user?.name}</h2>
            <p className="text-white/80 text-sm">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 p-6">
        <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
          <form onSubmit={handleSaveClick}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-brown-800">Profile Information</h3>
              {!isEditing && (
                <button 
                  onClick={handleEditClick}
                  type="button"
                  className="quick-action-button flex items-center gap-1.5"
                  disabled={isSaving}
                >
                  <img src="/src/assets/edit.svg" alt="" className="w-3.5 h-3.5"/> Edit Profile
                </button>
              )}
            </div>
            
            {/* Display Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormGroup label="Full Name">
                  {isEditing ? (
                     <input type="text" name="name" value={editFormData.name} onChange={handleInputChange} className="form-input" required disabled={isSaving} />
                  ) : (
                     <p className="profile-text">{user?.name}</p>
                  )}
                </FormGroup>
                <FormGroup label="Email Address">
                  {/* Email (user.id) is typically not editable directly through profile edit */}
                  <p className="profile-text text-gray-500">{user?.email ?? 'N/A'}</p>{/* Display user.id (which should be the email) */}
                </FormGroup>
                <FormGroup label="Phone Number">
                  {isEditing ? (
                     <input type="tel" name="phone_number" value={editFormData.phone_number || ''} onChange={handleInputChange} className="form-input" disabled={isSaving} />
                  ) : (
                     <p className="profile-text">{isEditing ? editFormData.phone_number : user?.phone_number || 'N/A'}</p>
                  )}
                </FormGroup>
                 <FormGroup label="Role">
                  <p className="profile-text text-gray-500">{getDisplayRole(user?.role)}</p>
                </FormGroup>
                <FormGroup label="Your Referral Code">
                  {user?.referralCode ? (
                    <div className="flex items-center space-x-2">
                      <p className="profile-text font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md">{user.referralCode}</p>
                      <button 
                         type="button"
                         onClick={() => navigator.clipboard.writeText(user.referralCode || '')}
                         className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-md transition-colors"
                         disabled={isSaving}
                       >
                         Copy
                      </button>
                    </div>
                  ) : (
                    <p className="profile-text text-gray-500">N/A</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Share this code with friends!</p>
                </FormGroup>
                <FormGroup label="Membership Status">
                  {user?.membershipTier ? (
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {user.membershipTier}
                      </span>
                      {user.tierJoinDate && (
                        <span className="text-xs text-gray-500">
                          since {new Date(user.tierJoinDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="profile-text text-gray-500">No active membership</p>
                  )}
                </FormGroup>
                {/* Address can be multi-line */}
                <FormGroup label="Address" className="md:col-span-2">
                  {isEditing ? (
                      <textarea name="address" value={editFormData.address} onChange={handleInputChange} className="form-input min-h-[60px]" disabled={isSaving} />
                  ) : (
                      <p className="profile-text">{isEditing ? editFormData.address : user?.address || 'N/A'}</p>
                  )}
                </FormGroup>
              </div>

              {isEditing && (
                  <div className="pt-4 border-t border-gray-100 flex space-x-3 justify-end">
                     <button type="button" onClick={handleCancelClick} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors" disabled={isSaving}>
                        Cancel
                     </button>
                     <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors" disabled={isSaving || !editFormData.name.trim()}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                     </button>
                  </div>
              )}
            </div>
          </form>
        </div>
        
        {/* Membership Manager Component */}
        <MembershipManager user={user} updateUser={updateUser} />
      </div>
    </div>
  );
};

const FormGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={`form-group ${className || ''}`}>
    <label className="block mb-1 text-sm font-medium text-gray-700">{label}</label>
    {children}
  </div>
);

export default Profile; 