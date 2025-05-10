import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types'; // Import User type

// Updated ProfileInfo to better match User type and what we can edit
interface EditableProfileInfo {
    name: string;
    email: string; // Assuming email is user.id and might not be directly editable here
    avatar: string; // This will hold the URL (existing or blob preview)
    avatarFile?: File | null; // To hold the new file if one is selected
    phone?: string;
    address: string;
}

interface ProfilePageProps {
  user: User | null;
}

const Profile: React.FC<ProfilePageProps> = ({ user }) => {
  const initialProfileState: EditableProfileInfo = {
    name: user?.name || "User Name",
    email: user?.id || "user@example.com",
    avatar: user?.avatar || "/src/assets/avatar.png", // Updated fallback
    avatarFile: null,
    phone: "", // Placeholder, not in User type
    address: "", // Placeholder, not in User type
  };

  const [editFormData, setEditFormData] = useState<EditableProfileInfo>(initialProfileState);
  const [isEditing, setIsEditing] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Effect to reset form data if the user prop changes (e.g., on logout/login)
  useEffect(() => {
    setEditFormData({
      name: user?.name || "User Name",
      email: user?.id || "user@example.com",
      avatar: user?.avatar || "/src/assets/avatar.png", // Updated fallback
      avatarFile: null,
      phone: "", // Reset placeholder
      address: "", // Reset placeholder
    });
  }, [user]);

  // Clean up avatar blob URL if it exists in editFormData
  useEffect(() => {
    return () => {
      if (editFormData.avatar && editFormData.avatar.startsWith('blob:')) {
        URL.revokeObjectURL(editFormData.avatar);
      }
    };
  }, [editFormData.avatar]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Revoke previous blob URL if one exists from a previous selection in this session
      if (editFormData.avatar && editFormData.avatar.startsWith('blob:')) {
        URL.revokeObjectURL(editFormData.avatar);
      }
      const tempImageUrl = URL.createObjectURL(file);
      setEditFormData(prev => ({
        ...prev,
        avatar: tempImageUrl,
        avatarFile: file,
      }));
    } else {
        // If no file is selected (e.g., user cancels file dialog), 
        // optionally revert to original avatar or do nothing.
        // For now, we'll just clear any selected file.
        setEditFormData(prev => ({
            ...prev,
            avatarFile: null,
            // Potentially revert avatar to user.avatar if a blob was previously shown
            // avatar: user?.avatar || (user?.role === 'manager' ? "/src/assets/manager-avatar.jpg" : "/src/assets/person.svg"),
        }));
    }
    e.target.value = ''; // Reset file input to allow re-selection of the same file
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = () => {
      // editFormData is already initialized and updated by useEffect based on the user prop.
      // When entering edit mode, we simply allow these fields to be changed.
      setIsEditing(true);
  };

  const handleCancelClick = () => {
      setIsEditing(false);
      // Reset editFormData to reflect the current user prop, discarding changes
      setEditFormData({
        name: user?.name || "User Name",
        email: user?.id || "user@example.com",
        avatar: user?.avatar || "/src/assets/avatar.png", // Updated fallback
        avatarFile: null, // Clear any selected file
        phone: "", // Reset placeholder
        address: "", // Reset placeholder
      });
  };

  const handleSaveClick = (e: React.FormEvent) => {
      e.preventDefault();
      console.log("Saving profile data:", editFormData);
      // TODO: Implement API call to save data (name, phone, address, avatar) to backend.
      // If editFormData.avatarFile exists, it needs to be uploaded.
      // The server would then return a new URL for editFormData.avatar to be updated with.
      alert("Profile changes saved (simulated). Check console for data including new avatar file/URL.");
      setIsEditing(false);
      // After successful save, avatarFile should be cleared
      // setEditFormData(prev => ({ ...prev, avatarFile: null })); 
      // And editFormData.avatar should reflect the new persistent URL from the server, not the blob.
      // For demo, if we had a global user update fn: updateUser({ ...user, name: editFormData.name, avatar: editFormData.avatar (if new)})
  };
  
  // Helper to get a display-friendly role name
  const getDisplayRole = (role: string | undefined) => {
    if (!role) return 'Guest';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (!user) {
    return <div className="p-6">Please log in to view your profile.</div>; // Or redirect
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
       <HiddenAvatarInput ref={avatarInputRef} onChange={handleAvatarChange} />
       <div className="bg-emerald-200 p-6 flex items-center space-x-6 relative">
            <div className="relative w-24 h-24">
                <img 
                    src={editFormData.avatar} // Always show avatar from editFormData for consistency in edit mode
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover border-4 border-white shadow-md"
                />
                {isEditing && (
                    <button 
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 text-white rounded-full text-xs hover:bg-opacity-50 transition-opacity"
                    >
                        Edit Image
                    </button>
                )}
            </div>
            <div>
                <h2 className="text-2xl font-semibold text-white">{isEditing ? editFormData.name : user.name}</h2>
                {/* Display user ID or a placeholder for customer ID */}
                <p className="text-brown-200 text-sm">{user.id}</p> 
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
                          >
                             <img src="/src/assets/edit.svg" alt="" className="w-3.5 h-3.5"/> Edit Profile
                          </button>
                      )}
                   </div>
                   
                   <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormGroup label="Full Name">
                               {isEditing ? (
                                  <input type="text" name="name" value={editFormData.name} onChange={handleInputChange} className="form-input" required />
                               ) : (
                                  <p className="profile-text">{user.name}</p>
                               )}
                           </FormGroup>
                           <FormGroup label="Email Address">
                               {/* Email (user.id) is typically not editable directly through profile edit */}
                               <p className="profile-text text-gray-500">{user.id}</p>
                           </FormGroup>
                           <FormGroup label="Phone Number">
                               {isEditing ? (
                                  <input type="tel" name="phone" value={editFormData.phone || ''} onChange={handleInputChange} className="form-input" />
                               ) : (
                                  <p className="profile-text">{editFormData.phone || 'N/A'}</p> // Display current phone from state
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
                                   <textarea name="address" value={editFormData.address} onChange={handleInputChange} className="form-input min-h-[60px]" />
                               ) : (
                                   <p className="profile-text">{editFormData.address || 'N/A'}</p> // Display current address from state
                               )}
                           </FormGroup>
                       </div>

                       {isEditing && (
                           <div className="pt-4 border-t border-gray-100 flex space-x-3 justify-end">
                              <button type="button" onClick={handleCancelClick} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                 Cancel
                              </button>
                              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                 Save Changes
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