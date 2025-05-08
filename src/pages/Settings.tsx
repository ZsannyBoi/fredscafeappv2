import React, { useState, useEffect } from 'react';
import { SettingsData } from '../types'; // Import SettingsData

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

const Settings: React.FC = () => {
  const [activeSetting, setActiveSetting] = useState<SettingsCategory>('General');
  const [settings, setSettings] = useState<SettingsData>({
    notifications: {
      email: true,
      sms: false,
    },
    theme: 'light',
    profileBanner: {
      type: 'color', // Default to color
      value: '#a7f3d0', // Default to emerald-100 hex
    }
  });

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

  const renderSettingContent = () => {
    switch (activeSetting) {
      case 'General':
        return (
          <div>
            <h2 className="text-xl font-semibold text-brown-800 mb-4">General Settings</h2>
            <p className="text-gray-600 mb-4">Configure basic application settings here.</p>
            <div className="space-y-4">
              <label className="flex items-center">
                <input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <span className="ml-2 text-sm text-gray-700">Enable Auto-Save</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Default Language</span>
                <select className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm py-2 px-3">
                  <option>English</option>
                  <option>Spanish</option>
                </select>
              </label>
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
              {/* Example Profile Banner Customization - can be expanded */}
              <fieldset className="mt-6">
                <legend className="text-sm font-medium text-gray-700 mb-2">Profile Banner Style</legend>
                <div className="space-y-2">
                    <label className="flex items-center">
                        <input type="radio" name="bannerType" value="color" checked={settings.profileBanner.type === 'color'} onChange={handleBannerTypeChange} className="form-radio h-4 w-4 text-blue-600"/>
                        <span className="ml-2 text-sm text-gray-700">Color</span>
                    </label>
                    {settings.profileBanner.type === 'color' && (
                        <input type="color" value={settings.profileBanner.value} onChange={handleBannerValueChange} className="ml-6 h-8 w-16 rounded border-gray-300" />
                    )}
                    <label className="flex items-center">
                        <input type="radio" name="bannerType" value="image" checked={settings.profileBanner.type === 'image'} onChange={handleBannerTypeChange} className="form-radio h-4 w-4 text-blue-600"/>
                        <span className="ml-2 text-sm text-gray-700">Image</span>
                    </label>
                    {settings.profileBanner.type === 'image' && (
                        <input type="file" accept="image/*" onChange={handleBannerImageChange} className="ml-6 text-sm" />
                    )}
                    {settings.profileBanner.type === 'image' && settings.profileBanner.value && (
                         <img src={settings.profileBanner.value} alt="Banner preview" className="ml-6 mt-2 w-full max-w-xs h-auto rounded shadow" />
                    )}
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
            <p className="text-gray-600 mb-4">Configure how you receive notifications.</p>
             {/* Add notification settings form elements */}
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
  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [name]: checked }
    }));
  };

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

  const handleBannerImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Revoke previous object URL if one exists from a previous selection in this session
      if (settings.profileBanner.type === 'image' && settings.profileBanner.value.startsWith('blob:')) {
        URL.revokeObjectURL(settings.profileBanner.value);
      }
      const tempImageUrl = URL.createObjectURL(file); 
      setSettings(prev => ({
        ...prev,
        profileBanner: { ...prev.profileBanner, type: 'image', value: tempImageUrl }
      }));
    }
  };

  useEffect(() => {
    // This effect handles the cleanup of the blob URL when the component unmounts
    // or when the banner value changes from a blob URL to something else (e.g., color or different image).
    let currentBlobUrl: string | null = null;

    if (settings.profileBanner.type === 'image' && settings.profileBanner.value.startsWith('blob:')) {
      currentBlobUrl = settings.profileBanner.value;
    }

    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        // console.log("Revoked blob URL on cleanup:", currentBlobUrl);
      }
    };
  }, [settings.profileBanner.value, settings.profileBanner.type]); // Re-run if blob URL or type changes

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    console.log("Changing password...", passwordData);
    alert("Password change submitted (check console).");
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleSaveChanges = () => {
    console.log("Saving Settings:", settings);
    alert("Settings saved (check console).");
  };

  return (
    <div className="text-brown-800 p-6">
      <h1 className="text-3xl font-medium mb-8">Settings</h1>

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
        </div>
      </div>
    </div>
  );
};

export default Settings; 