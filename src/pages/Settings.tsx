import React, { useState, useEffect } from 'react';
import { SettingsData, User } from '../types'; // Import SettingsData and User
import { uploadImage } from '../utils/imageUpload'; // Import the uploadImage utility
import { toast } from 'react-toastify';

type SettingsCategory = 'General' | 'Display' | 'Privacy and security' | 'Notifications' | 'Support' | 'About';

// Interface for settings data (can be expanded)
// interface SettingsData {
//     notifications: {
//         email: boolean;
//         sms: boolean;
//     };
//     theme: 'light' | 'dark';
//     profileBanner: {
//         type: 'color' | 'image';
//         value: string; // Hex color code or image URL/path
//     };
// }

// Component props
interface SettingsProps {
  user?: User | null; // Add user prop
  updateUser?: (userData: Partial<User>) => void; // Add updateUser prop
}

const Settings: React.FC<SettingsProps> = ({ user, updateUser }) => {
  const [activeSetting, setActiveSetting] = useState<SettingsCategory>('General');
  const [settings, setSettings] = useState<SettingsData>({
    autoSave: false,
    theme: 'light',
    profileBanner: {
      type: 'color', // Default to color
      value: '#a7f3d0', // Default to emerald-100 hex
    }
  });
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const settingCategories: SettingsCategory[] = [
    'General',
    'Display',
    'Privacy and security',
    'Notifications',
    'Support',
    'About'
  ];
  
  // Fetch user settings when component mounts or user changes
  useEffect(() => {
    if (user?.internalId) {
      fetchUserSettings();
    }
  }, [user?.internalId]);
  
  const fetchUserSettings = async () => {
    if (!user?.internalId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token missing. Please log in again.");
      }
      
      const response = await fetch(`http://localhost:3001/api/users/${user.internalId}/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      
      const userSettings = await response.json();
      setSettings(userSettings);
    } catch (error: any) {
      console.error("Error fetching user settings:", error);
      setError(error.message || "Failed to fetch user settings.");
      toast.error(error.message || "Failed to fetch user settings.");
    } finally {
      setLoading(false);
    }
  };

  const renderSettingContent = () => {
    switch (activeSetting) {
      case 'General':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">General Settings</h2>
            <p className="text-gray-600 mb-4">Configure basic application settings here.</p>
            <div className="space-y-4">
              <label className="flex items-center">
                <input 
                  type="checkbox" 
                  checked={settings.autoSave} 
                  onChange={handleNotificationChange} 
                  className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                />
                <span className="ml-2 text-sm text-gray-700">Enable Auto-Save</span>
              </label>
              {/* We'll leave language implementation for later */}
            </div>
          </div>
        );
      case 'Display':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">Display Settings</h2>
            <p className="text-gray-600 mb-4">Adjust theme and layout options.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Theme</span>
                <select 
                  value={settings.theme} 
                  onChange={handleThemeChange} 
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-2 px-3"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  {/* <option value="system">System</option> */}
                </select>
              </label>
              {/* Profile Banner Customization */}
              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-gray-700 mb-2">Profile Banner Style</legend>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <label className="flex items-center">
                      <input 
                        type="radio" 
                        name="bannerType" 
                        value="color" 
                        checked={settings.profileBanner.type === 'color'} 
                        onChange={handleBannerTypeChange} 
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Color</span>
                    </label>
                    {settings.profileBanner.type === 'color' && (
                      <input 
                        type="color" 
                        value={settings.profileBanner.value} 
                        onChange={handleBannerValueChange} 
                        className="ml-6 h-8 w-16 rounded border-gray-300" 
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="flex items-center">
                      <input 
                        type="radio" 
                        name="bannerType" 
                        value="image" 
                        checked={settings.profileBanner.type === 'image'} 
                        onChange={handleBannerTypeChange} 
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Image</span>
                    </label>
                    
                    {settings.profileBanner.type === 'image' && (
                      <div className="mt-3 ml-6">
                        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {loading ? 'Uploading...' : 'Choose Image'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleBannerImageChange} 
                            className="hidden" 
                            disabled={loading}
                          />
                        </label>
                        
                        {error && (
                          <p className="mt-2 text-sm text-red-600">{error}</p>
                        )}
                        
                        {settings.profileBanner.value && (
                          <div className="mt-3">
                            <div className="relative w-full max-w-md h-32 rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={settings.profileBanner.value.startsWith('http') 
                                  ? settings.profileBanner.value 
                                  : `http://localhost:3001${settings.profileBanner.value}`} 
                                alt="Banner preview" 
                                className="w-full h-full object-cover" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
            </div>
          </div>
        );
      case 'Privacy and security':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">Privacy and Security</h2>
            <p className="text-gray-600 mb-6">Manage your account security and data privacy.</p>
            
            {/* Change Password Section */}
            <div className="border-t border-gray-200 pt-6">
                 <h3 className="text-lg font-medium text-gray-900 mb-3">Change Password</h3>
                 <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                     <div>
                         <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                         <input type="password" id="currentPassword" name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm" />
                     </div>
                     <div>
                         <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                         <input type="password" id="newPassword" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm" />
                     </div>
                     <div>
                         <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                         <input type="password" id="confirmPassword" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm" />
                     </div>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                         Update Password
                     </button>
                 </form>
            </div>

             {/* TODO: Add other security settings like 2FA later */}
          </div>
        );
      case 'Notifications':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">Notifications</h2>
            <p className="text-gray-600 mb-4">Notification settings will be implemented later with React Toastify.</p>
            
            <div className="mt-6">
              <button 
                onClick={handleSaveChanges} 
                disabled={loading} 
                className={`px-4 py-2 rounded-lg text-white text-sm ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              
              {saveSuccess && (
                <span className="ml-3 text-sm text-green-600">Settings saved successfully!</span>
              )}
              
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>
        );
      case 'Support':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">Support</h2>
            <p className="text-gray-600 mb-4">Get help and access resources.</p>
             {/* Add support links/info */}
          </div>
        );
      case 'About':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">About EspressoLane</h2>
            <p className="text-gray-600">Version 1.0.0</p>
            <p className="text-gray-600">© 2024 EspressoLane. All rights reserved.</p>
          </div>
        );
      default:
        return <p className="text-gray-500">Select a category from the left.</p>;
    }
  };

  // --- Handlers ---
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({
      ...prev,
      theme: e.target.value as 'light' | 'dark'
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleBannerTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = e.target.value as 'color' | 'image';
    setSettings(prev => ({
      ...prev,
      profileBanner: {
        ...prev.profileBanner,
        type: type,
        value: type === 'color' ? '#a7f3d0' : '' 
      }
    }));
  };

  const handleBannerValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSettings(prev => ({
      ...prev,
      profileBanner: { ...prev.profileBanner, value: value }
    }));
  };

  const handleBannerImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setError("Only image files are allowed.");
      toast.error("Only image files are allowed.");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Upload the image and get the server-side URL
      const imageUrl = await uploadImage(file);
      
      // Update settings with the server-side image URL
      setSettings(prev => ({
        ...prev,
        profileBanner: { 
          ...prev.profileBanner, 
          type: 'image', 
          value: imageUrl 
        }
      }));
      
      toast.success("Banner image uploaded successfully.");
    } catch (err: any) {
      console.error("Error uploading banner image:", err);
      setError("Failed to upload banner image. Please try again.");
      toast.error("Failed to upload banner image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Banner images are now stored on the server, no need to cleanup blob URLs

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Make sure user is logged in
    if (!user || !user.internalId) {
      toast.error("You must be logged in to change your password.");
      return;
    }
    
    // Validate password match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match!");
      return;
    }
    
    // Validate password length
    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token missing. Please log in again.");
      }
      
      const response = await fetch(`http://localhost:3001/api/users/${user.internalId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      toast.success(data.message || "Password updated successfully!");
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password. Please try again.");
    }
  };

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // This is now used for autoSave
    setSettings(prev => ({
      ...prev,
      autoSave: e.target.checked
    }));
  };

  const handleSaveChanges = async () => {
    if (!user?.internalId) {
      toast.error("You must be logged in to save settings.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token missing. Please log in again.");
      }
      
      const response = await fetch(`http://localhost:3001/api/users/${user.internalId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Settings saved:", data);
      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      
      // Apply theme changes immediately
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(settings.theme);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setError(error.message || "Failed to save settings.");
      toast.error(error.message || "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-brown-800 p-6">
      <h1 className="text-3xl font-medium mb-8">Settings</h1>
      
      {!user ? (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-800">
          Please log in to access your settings.
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Settings Categories Sidebar */}
          <div className="w-64 bg-white rounded-2xl p-4 shadow-sm flex flex-col relative border border-gray-100 min-h-[60vh]">
            <nav className="space-y-1 flex-1">
              {settingCategories.map(category => (
                <button 
                    key={category} 
                    onClick={() => setActiveSetting(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex justify-between items-center transition-colors ${ 
                        activeSetting === category 
                        ? 'bg-amber-100/60 text-brown-800' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    {category}
                    {/* Indicator Bar (moved absolute positioning relative to button if needed, or keep here) */} 
                    {activeSetting === category && (
                       <span className="w-1 h-6 bg-brown-800 rounded-full absolute right-0 mr-[-16px]"></span> 
                     )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Settings Content Area */}
          <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[60vh]">
            {/* Render content based on selection */}
            {renderSettingContent()}
            
            {/* Common Save Button (except for About and Support sections) */}
            {(activeSetting !== 'About' && activeSetting !== 'Support' && activeSetting !== 'Privacy and security' && activeSetting !== 'Notifications') && (
              <div className="mt-8 pt-4 border-t border-gray-200">
                <button 
                  onClick={handleSaveChanges} 
                  disabled={loading} 
                  className={`px-4 py-2 rounded-lg text-white text-sm ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} transition-colors`}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                
                {saveSuccess && (
                  <span className="ml-3 text-sm text-green-600">Settings saved successfully!</span>
                )}
                
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 