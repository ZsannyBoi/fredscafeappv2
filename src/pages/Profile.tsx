import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types'; // Import User type
import ImageUpload from '../components/ImageUpload';
import { uploadImage } from '../utils/imageUpload';

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
        }
      }
    } catch (err: any) {
      console.error('Error updating profile image:', err);
      setError(err.message || 'Failed to update profile image');
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
      // Explicitly check if user and user.id are valid before proceeding
      if (!user || !user.internalId) {
          console.error("Attempted to save profile with invalid user or user internalId.", user);
          setError("User information is missing or invalid. Please try logging out and back in.");
          return; // Stop the save process
      }

      setIsSaving(true); // Start loading state
      setError(null); // Clear previous errors

      // Prepare the data to send to the backend
      const dataToSave: { name: string; avatar_url?: string | null; phone_number?: string | null; address?: string | null } = {
          name: editFormData.name.trim(),
          phone_number: editFormData.phone_number?.trim() || null,
          address: editFormData.address?.trim() || null,
      };

      // Handle avatar data
      if (typeof editFormData.avatar === 'string' && !editFormData.avatar.startsWith('blob:')) {
          // Send existing string URL that's not a blob
          dataToSave.avatar_url = editFormData.avatar;
      } else if (editFormData.avatarFile) {
          // Upload new file and get URL to save
          try {
              console.log("[Profile.tsx] Uploading new avatar file");
              const avatarUrl = await uploadImage(editFormData.avatarFile);
              dataToSave.avatar_url = avatarUrl;
              console.log("[Profile.tsx] Avatar uploaded, URL:", avatarUrl);
          } catch (uploadError: any) {
              console.error("[Profile.tsx] Avatar upload error:", uploadError);
              setError(`Error uploading avatar: ${uploadError.message}`);
              setIsSaving(false);
              return;
          }
      }

      console.log("[Profile.tsx] Saving profile data:", dataToSave);

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
                  avatar: updatedData.avatar || user.avatar
              });
          }
          
          // Show success message
          alert('Profile updated successfully!');
          setIsEditing(false); // Exit edit mode
      } catch (error: any) {
          console.error("[Profile.tsx] Error saving profile:", error);
          setError(`Error saving profile: ${error.message}`);
      } finally {
          setIsSaving(false);
      }
  };
  
  // Helper to get a display-friendly role name
  const getDisplayRole = (role: string | undefined) => {
    if (!role) return 'Guest';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (!user) {
    console.log('[Profile.tsx] Rendering: User prop is null.');
    return <div className="p-6">Please log in to view your profile.</div>; // Or redirect
  }

  // Show loading state while fetching initial data
  if (isLoading) {
    console.log('[Profile.tsx] Rendering: isLoading is true.');
    return <div className="p-6 text-center text-gray-500">Loading profile...</div>;
  }

  // Show error state if fetching failed
  if (error && !isLoading) {
    console.log('[Profile.tsx] Rendering: Error is present and isLoading is false.', error);
    return <div className="p-6 text-center text-red-500">Error loading profile: {error}</div>;
  }

  console.log('[Profile.tsx] Rendering: Profile data loaded successfully.', user, editFormData);
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
       <div className="bg-emerald-200 p-6 flex items-center space-x-6 relative">
            <div className="relative w-24 h-24">
                <ImageUpload
                    currentImageUrl={isEditing ? editFormData.avatar : (user?.avatar ?? "/src/assets/avatar.png")}
                    defaultImageUrl="/src/assets/avatar.png"
                    onImageChange={handleImageChange}
                    disabled={isSaving}
                    className="w-24 h-24"
                />
            </div>
            <div>
                <h2 className="text-2xl font-semibold text-white">{isEditing ? editFormData.name : user.name}</h2>
                {/* Display user ID or a placeholder for customer ID */}
                <p className="text-brown-200 text-sm">{user.internalId}</p> 
            </div>
       </div>

       <div className="grid grid-cols-1 gap-8">
           <div className="bg-white p-6 rounded-2xl shadow border border-gray-100">
               <form onSubmit={handleSaveClick}>
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-brown-800">Profile Information</h3>
                      {!isEditing && (
                          <button 
                              onClick={handleEditClick}
                              type="button" // Added type button
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
                                  <p className="profile-text">{user.name}</p>
                               )}
                           </FormGroup>
                           <FormGroup label="Email Address">
                               {/* Email (user.id) is typically not editable directly through profile edit */}
                               <p className="profile-text text-gray-500">{user.email ?? 'N/A'}</p>{/* Display user.id (which should be the email) */}
                           </FormGroup>
                           <FormGroup label="Phone Number">
                               {isEditing ? (
                                  <input type="tel" name="phone_number" value={editFormData.phone_number || ''} onChange={handleInputChange} className="form-input" disabled={isSaving} />
                               ) : (
                                  <p className="profile-text">{user.phone_number || 'N/A'}</p> // Display phone_number from user
                               )}
                           </FormGroup>
                            <FormGroup label="Role">
                               <p className="profile-text text-gray-500">{getDisplayRole(user.role)}</p>
                           </FormGroup>
                           <FormGroup label="Your Referral Code">
                               {user.referralCode ? (
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
                           {/* Address can be multi-line */}
                           <FormGroup label="Address" className="md:col-span-2">
                               {isEditing ? (
                                   <textarea name="address" value={editFormData.address} onChange={handleInputChange} className="form-input min-h-[60px]" disabled={isSaving} />
                               ) : (
                                   <p className="profile-text">{user.address || 'N/A'}</p> // Display address from user prop
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
       </div>
    </div>
  );
};

// Hidden File Input for Avatar
const HiddenAvatarInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input type="file" accept="image/*" ref={ref} className="hidden" {...props} />
));

const FormGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        {children}
    </div>
);

export default Profile; 